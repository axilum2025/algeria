// ✅ Task Manager Intelligent - Gestion de tâches avec IA
// Détection automatique de priorité, deadline, sous-tâches via Llama 3.3 70B

const { getAuthEmail } = require('../utils/auth');
const taskStore = require('../utils/todoTaskStorage');
const { callGroqWithRateLimit, globalRateLimiter } = require('../utils/rateLimiter');
const { checkAndConsume } = require('../utils/planQuota');
const { getUserPlan, getPlanPriority } = require('../utils/entitlements');
const { appendAuditEvent } = require('../utils/auditStorage');
const { precheckCredit, debitAfterUsage } = require('../utils/aiCreditGuard');
const { getLangFromReq, getResponseLanguageInstruction } = require('../utils/lang');

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

const MAX_TEXT_CHARS = Math.max(200, Math.min(20_000, Number(process.env.TODO_TASKS_MAX_TEXT_CHARS || 4000) || 4000));
const MAX_HISTORY_TURNS = Math.max(0, Math.min(20, Number(process.env.TODO_TASKS_MAX_HISTORY_TURNS || 8) || 8));
const MAX_TASKS_IN_AI_CONTEXT = Math.max(10, Math.min(1000, Number(process.env.TODO_TASKS_MAX_TASKS_IN_AI_CONTEXT || 200) || 200));
const MAX_AI_CHANGES = Math.max(1, Math.min(200, Number(process.env.TODO_TASKS_MAX_AI_CHANGES || 50) || 50));
const MAX_AI_CREATED = Math.max(1, Math.min(200, Number(process.env.TODO_TASKS_MAX_AI_CREATED || 25) || 25));
const MAX_AI_DELETED = Math.max(1, Math.min(500, Number(process.env.TODO_TASKS_MAX_AI_DELETED || 50) || 50));

function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    } catch (_) {
        return null;
    }
}

function resolveRequestedGroqModel(req) {
    const requested = (req && req.body && (req.body.model || req.body.aiModel)) || null;
    const r = String(requested || '').trim();
    if (!r) return DEFAULT_GROQ_MODEL;
    const raw = String(process.env.AI_PRICING_JSON || '').trim();
    if (!raw) return DEFAULT_GROQ_MODEL;
    const pricing = safeJsonParse(raw);
    if (!pricing || typeof pricing !== 'object') return DEFAULT_GROQ_MODEL;
    if (!Object.prototype.hasOwnProperty.call(pricing, r)) return DEFAULT_GROQ_MODEL;
    return r;
}

function corsJsonHeaders(extra = {}) {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        ...extra
    };
}

function safeText(value, maxChars = MAX_TEXT_CHARS) {
    const s = String(value ?? '');
    if (!s) return '';
    return s.length > maxChars ? s.slice(0, maxChars) : s;
}

function normalizeHistory(history) {
    const arr = Array.isArray(history) ? history : [];
    const out = [];
    for (const item of arr.slice(-MAX_HISTORY_TURNS)) {
        const role = String(item?.role || item?.type || '').toLowerCase();
        const content = safeText(item?.content || '', 1200);
        if (!content) continue;
        if (role === 'user' || role === 'assistant') out.push({ role, content });
    }
    return out;
}

async function auditSafe({ email, action, status, plan, meta }) {
    try {
        await appendAuditEvent({ email, action, status, plan, meta });
    } catch (_) {
        // ignore
    }
}

function getReqLang(req) {
    if (req && req.__axilumLang) return String(req.__axilumLang);
    return getLangFromReq(req);
}

function isEnglish(req) {
    return getReqLang(req) === 'en';
}

function pickLang(req, fr, en) {
    return isEnglish(req) ? en : fr;
}

module.exports = async function (context, req) {
    context.log('✅ Task Manager Request:', req.method, req.params.action);

    const lang = getLangFromReq(req);
    req.__axilumLang = lang;

    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
        return;
    }

    try {
        const action = req.params.action || 'list';
        const requireAuth = String(process.env.TODO_TASKS_REQUIRE_AUTH ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase() === 'true';
        const authEmail = getAuthEmail(req);
        if (requireAuth && !authEmail) {
            context.res = {
                status: 401,
                headers: corsJsonHeaders(),
                body: { error: pickLang(req, 'Non authentifié', 'Not authenticated') }
            };
            return;
        }

        // Prefer authenticated identity; fallback to client-provided id for local/dev.
        const userId = authEmail || req.query.userId || req.body?.userId || 'default';

        // ✅ Rate limit (bêta-prod): quota simple par minute, par user + feature.
        const rateLimitEnabled = String(process.env.TODO_TASKS_RATE_LIMIT_ENABLED ?? 'true').toLowerCase() !== 'false';
        let plan = 'free';
        let priority = 'normal';
        if (rateLimitEnabled) {
            try {
                plan = await getUserPlan(authEmail);
                priority = getPlanPriority(plan);
            } catch (_) {
                plan = 'free';
                priority = 'normal';
            }

            const feature = (action === 'smart-add' || action === 'smart-command' || action === 'coach' || action === 'summary' || action === 'prioritize' || action === 'schedule' || action === 'productivity')
                ? 'todo_ai'
                : 'todo_api';

            const quota = checkAndConsume({ plan, email: authEmail || userId || 'guest', feature });
            if (!quota.allowed) {
                const retryAfterSeconds = Math.max(1, Math.ceil((quota.resetInMs || 1000) / 1000));
                context.res = {
                    status: 429,
                    headers: corsJsonHeaders({ 'Retry-After': String(retryAfterSeconds) }),
                    body: {
                        error: pickLang(req, 'Rate limit atteint', 'Rate limit reached'),
                        feature,
                        plan,
                        limitPerMinute: quota.limit,
                        resetInMs: quota.resetInMs
                    }
                };
                return;
            }
        }

        // Exposer priorité plan aux handlers (utilisé pour la queue Groq)
        req.__axilumPlanPriority = priority;
        req.__axilumPlan = plan;
        
        switch (action) {
            case 'create':
                return await createTask(context, req, userId);
            
            case 'list':
                return await listTasks(context, req, userId);
            
            case 'update':
                return await updateTask(context, req, userId);
            
            case 'delete':
                return await deleteTask(context, req, userId);
            
            case 'smart-add':
                return await smartAddTask(context, req, userId);
            
            case 'smart-command':
                return await smartCommand(context, req, userId);
            
            case 'sync':
                return await syncTasks(context, req, userId);

            case 'prioritize':
                return await prioritizeTasks(context, req, userId);

            case 'schedule':
                return await suggestSchedule(context, req, userId);

            case 'productivity':
                return await productivityStats(context, req, userId);

            case 'coach':
                return await coachAdvice(context, req, userId);

            case 'summary':
                return await summary(context, req, userId);
            
            default:
                context.res = {
                    status: 400,
                    headers: corsJsonHeaders(),
                    body: { error: "Unknown action. Use: create, list, update, delete, smart-add, smart-command, sync, prioritize, schedule, productivity, coach, summary" }
                };
        }

    } catch (error) {
        context.log.error('❌ Error:', error);
        context.res = {
            status: 500,
            headers: corsJsonHeaders(),
            body: { error: error.message }
        };
    }
};

function normalizeId(value) {
    if (value === null || value === undefined) return '';
    return String(value);
}

function coerceArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeAction(action, { hasWrites } = {}) {
    const allowed = new Set(['organize', 'suggest', 'modify', 'analyze', 'info']);
    const a = String(action || '').trim().toLowerCase();
    if (allowed.has(a)) return a;
    // Compat: si l'IA répond "create"/"delete", on l'expose comme "modify"
    if (hasWrites) return 'modify';
    return 'info';
}

function normalizeTaskShape(task) {
    const t = task && typeof task === 'object' ? task : {};
    const id = normalizeId(t.id || Date.now().toString() + Math.random().toString(36).slice(2));
    // Compat: accepter dueDate côté client et stocker en deadline
    const deadline = t.deadline ?? t.dueDate ?? null;

    return {
        ...t,
        id,
        deadline,
        createdAt: t.createdAt || new Date().toISOString(),
        updatedAt: t.updatedAt || new Date().toISOString()
    };
}

function parseIsoDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d;
}

function parseEstimatedMinutes(value) {
    if (!value) return null;
    if (typeof value === 'number' && isFinite(value)) return Math.max(1, Math.round(value));
    const raw = String(value).trim().toLowerCase();
    if (!raw) return null;
    // Formats: "90", "90m", "1h", "1h30", "1h 30m", "2h15"
    if (/^\d+$/.test(raw)) return Math.max(1, parseInt(raw, 10));

    const h = raw.match(/(\d+)\s*h/);
    const m = raw.match(/(\d+)\s*m/);
    if (h || m) {
        const hours = h ? parseInt(h[1], 10) : 0;
        const mins = m ? parseInt(m[1], 10) : 0;
        const total = hours * 60 + mins;
        return total > 0 ? total : null;
    }

    const compact = raw.match(/^(\d+)h(\d{1,2})$/);
    if (compact) {
        const hours = parseInt(compact[1], 10);
        const mins = parseInt(compact[2], 10);
        const total = hours * 60 + mins;
        return total > 0 ? total : null;
    }

    return null;
}

function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
}

function parseOptionalInt(value) {
    if (value === undefined || value === null) return null;
    const n = parseInt(String(value), 10);
    return Number.isFinite(n) ? n : null;
}

function parseOptionalString(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    return s ? s : null;
}

function parsePersonalProfile(req) {
    const age = parseOptionalInt(req.query?.age ?? req.body?.age);
    const sex = parseOptionalString(req.query?.sex ?? req.body?.sex);
    const focusHoursRaw = req.query?.focusHours ?? req.body?.focusHours;
    const focusHoursNum = focusHoursRaw === undefined || focusHoursRaw === null || focusHoursRaw === ''
        ? null
        : Number(focusHoursRaw);
    const focusHours = Number.isFinite(focusHoursNum) ? clamp(focusHoursNum, 1, 16) : null;

    const provided = age !== null || sex !== null || focusHours !== null;

    return {
        provided,
        age: age !== null ? clamp(age, 10, 120) : null,
        sex,
        focusHours
    };
}

function computeMentalLoadScore(metrics) {
    const pending = Number(metrics.pending || 0);
    const overdue = Number(metrics.overdue || 0);
    const next24Hours = Number(metrics.next24Hours || 0);
    const overload = metrics.overloadNext24 ? 1 : 0;

    const score = (pending * 8) + (overdue * 15) + (next24Hours * 6) + (overload * 18);
    return clamp(Math.round(score), 0, 100);
}

function computeStressIndex(metrics, profile) {
    const overdue = Number(metrics.overdue || 0);
    const next24Hours = Number(metrics.next24Hours || 0);
    const overload = metrics.overloadNext24 ? 1 : 0;
    const streak = Number(metrics.streakDays || 0);

    const focusHours = Number(profile?.focusHours);
    const hasFocusHours = Number.isFinite(focusHours);
    const capacityPenalty = hasFocusHours ? Math.max(0, (next24Hours - focusHours) * 8) : 0;

    const score = (overdue * 20) + (next24Hours * 5) + (overload * 22) - (streak >= 3 ? 8 : 0) + capacityPenalty;
    return clamp(Math.round(score), 0, 100);
}

function buildCoachAdvice({ metrics, profile }) {
    const completed = Number(metrics.completed || 0);
    const pending = Number(metrics.pending || 0);
    const overdue = Number(metrics.overdue || 0);
    const next24Hours = Number(metrics.next24Hours || 0);
    const pendingEstimatedHours = Number(metrics.pendingEstimatedHours || 0);
    const overloadNext24 = !!metrics.overloadNext24;
    const completionRate = Number(metrics.completionRate || 0);
    const mentalLoadScore = Number(metrics.mentalLoadScore || 0);
    const stressIndex = Number(metrics.stressIndex || 0);

    const focusHours = Number(profile?.focusHours);
    const hasFocusHours = Number.isFinite(focusHours);

    const work = [];
    const personal = [];

    if (!profile?.provided) {
        work.push("Compléter le profil (âge/sexe/capacité) pour affiner les métriques.");
    } else if (!hasFocusHours) {
        work.push("Renseigner une capacité (heures focus/jour) pour détecter la surcharge plus finement.");
    }

    if (overdue > 0) {
        work.push(`Traiter d'abord les ${overdue} tâche(s) en retard: choisir 1 urgence + découper la plus lourde en 2–3 sous-tâches.`);
    }

    if (overloadNext24) {
        const capHint = hasFocusHours ? ` (capacité ≈ ${focusHours}h)` : '';
        work.push(`Journée chargée: ~${next24Hours}h prévues sur 24h${capHint}. Reporter 1–2 tâches non critiques et protéger 1 bloc focus.`);
    } else if (pendingEstimatedHours >= 6) {
        work.push(`Charge globale élevée (~${pendingEstimatedHours}h). Planifier 2 blocs focus et regrouper les micro-tâches.`);
    } else {
        work.push("Rythme stable: garder 1 bloc focus + 1 tâche courte pour maintenir l'élan.");
    }

    if (pending >= 8 || mentalLoadScore >= 70) {
        work.push("Réduire la charge mentale: limiter la liste visible à 5 tâches, le reste en backlog.");
    }

    if (stressIndex >= 70) {
        personal.push("Stress élevé: bloquer 10 min de pause (respiration/marche) entre 2 tâches importantes.");
    } else {
        personal.push("Préserver l'énergie: 1 pause courte toutes les 90 minutes de focus.");
    }

    if (completionRate < 30 && (pending > 0 || overdue > 0)) {
        personal.push("Objectif victoire rapide: terminer 1 petite tâche (≤15 min) pour relancer la motivation.");
    } else if (completed >= 3) {
        personal.push("Bon rythme: clôturer la journée par un mini bilan (3 lignes) et préparer 1 priorité pour demain.");
    }

    const response = [
        `Conseiller: charge ${pending} en cours, ${overdue} en retard.`,
        `Scores: mental ${mentalLoadScore}/100, stress ${stressIndex}/100, completion ${completionRate}%.`,
        `Top actions: ${work.slice(0, 2).join(' ')} ${personal.slice(0, 1).join(' ')}`
    ].join('\n');

    return { response, advice: { work, personal } };
}

function daysBetween(a, b) {
    const ms = b.getTime() - a.getTime();
    return ms / (24 * 60 * 60 * 1000);
}

function computePriorityWeight(priority) {
    const p = String(priority || '').toLowerCase();
    if (p === 'urgent') return 120;
    if (p === 'high') return 90;
    if (p === 'medium' || p === 'normal') return 60;
    if (p === 'low') return 30;
    return 45;
}

function computeTaskScore(task, now) {
    const status = String(task.status || '').toLowerCase();
    if (status === 'completed') return -9999;

    const base = computePriorityWeight(task.priority);
    const deadline = parseIsoDate(task.deadline);
    let deadlineScore = 0;
    let overdue = false;

    if (deadline) {
        const days = daysBetween(now, deadline);
        overdue = days < 0;
        if (overdue) {
            deadlineScore = 120;
        } else if (days <= 0.75) {
            deadlineScore = 100;
        } else if (days <= 1) {
            deadlineScore = 85;
        } else if (days <= 3) {
            deadlineScore = 60;
        } else if (days <= 7) {
            deadlineScore = 35;
        } else {
            deadlineScore = 10;
        }
    }

    const estMin = parseEstimatedMinutes(task.estimatedTime);
    // Favoriser les tâches courtes quand c'est tard dans la journée
    const hour = now.getHours();
    const timeOfDayBias = hour >= 18 ? 10 : hour < 12 ? 5 : 0;
    const sizeScore = estMin ? clamp(60 - estMin / 3, -20, 30) : 0;

    return {
        score: base + deadlineScore + sizeScore + timeOfDayBias,
        overdue,
        deadline: deadline ? deadline.toISOString() : null,
        estMin: estMin || null
    };
}

function groupSimilarTasks(tasks) {
    const groups = new Map();
    tasks.forEach(t => {
        const cat = String(t.category || 'autre').toLowerCase();
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat).push(t);
    });
    return Array.from(groups.entries()).map(([category, items]) => ({ category, count: items.length, taskIds: items.map(x => x.id) }));
}

function calcOverload(tasks, now) {
    const upcoming = tasks
        .filter(t => String(t.status || '').toLowerCase() !== 'completed')
        .map(t => ({ t, d: parseIsoDate(t.deadline) }))
        .filter(x => x.d);

    const next24 = upcoming.filter(x => x.d.getTime() - now.getTime() <= 24 * 60 * 60 * 1000 && x.d.getTime() >= now.getTime());
    const totalMin = next24.reduce((sum, x) => sum + (parseEstimatedMinutes(x.t.estimatedTime) || 60), 0);

    // Heuristique simple: surcharge si > 6h à faire en 24h
    const overload = totalMin >= 360;
    return { overload, next24Count: next24.length, next24Minutes: totalMin };
}

// ==========================
//  ENDPOINTS "FONDATIONS"
// ==========================

async function prioritizeTasks(context, req, userId) {
    const now = new Date();
    const en = isEnglish(req);
    const inputTasks = req.body?.tasks;
    const tasks = (Array.isArray(inputTasks) ? inputTasks : await getTasks(userId)).map(normalizeTaskShape);

    const scored = tasks
        .filter(t => String(t.status || '').toLowerCase() !== 'completed')
        .map(t => {
            const s = computeTaskScore(t, now);
            return {
                id: t.id,
                title: t.title,
                priority: t.priority,
                deadline: s.deadline,
                category: t.category,
                estimatedMinutes: s.estMin,
                score: s.score,
                reason: s.overdue
                    ? (en ? 'Overdue' : 'En retard')
                    : (s.deadline ? (en ? 'Due soon / priority' : 'Échéance proche / priorité') : (en ? 'Priority / effort' : 'Priorité / effort'))
            };
        })
        .sort((a, b) => b.score - a.score);

    const groups = groupSimilarTasks(tasks.filter(t => String(t.status || '').toLowerCase() !== 'completed'));
    const overload = calcOverload(tasks, now);

    const suggestions = [];
    groups
        .filter(g => g.count >= 3)
        .slice(0, 3)
        .forEach(g => suggestions.push({
            type: 'batch',
            message: en
                ? `Group "${g.category}" tasks (x${g.count}) into a single time block.`
                : `Regrouper les tâches "${g.category}" (x${g.count}) en un seul créneau.`,
            category: g.category,
            taskIds: g.taskIds
        }));

    if (overload.overload) {
        suggestions.push({
            type: 'overload',
            message: en
                ? `Potential overload: ~${Math.round(overload.next24Minutes / 60)}h in the next 24h. Consider postponing/delegating 1-2 tasks.`
                : `Surcharge probable: ~${Math.round(overload.next24Minutes / 60)}h à faire dans les prochaines 24h. Envisager de reporter/déléguer 1-2 tâches.`,
            next24Count: overload.next24Count,
            next24Minutes: overload.next24Minutes
        });
    }

    context.res = {
        status: 200,
        headers: corsJsonHeaders(),
        body: {
            userId,
            now: now.toISOString(),
            prioritized: scored.slice(0, 50),
            suggestions,
            insights: {
                overload: overload.overload,
                next24Count: overload.next24Count,
                next24Hours: Math.round((overload.next24Minutes / 60) * 10) / 10
            }
        }
    };
}

function buildTimeSlots({ startDate, days = 5, workBlocks = [[9, 12], [14, 17]] } = {}) {
    const start = startDate ? new Date(startDate) : new Date();
    start.setSeconds(0, 0);
    const slots = [];
    for (let i = 0; i < days; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        for (const block of workBlocks) {
            const [fromH, toH] = block;
            const from = new Date(day);
            from.setHours(fromH, 0, 0, 0);
            const to = new Date(day);
            to.setHours(toH, 0, 0, 0);
            slots.push({ start: from, end: to });
        }
    }
    return slots;
}

function subtractEvents(slots, events) {
    const busy = (Array.isArray(events) ? events : [])
        .map(e => {
            const s = parseIsoDate(e.startDate || e.start);
            const en = parseIsoDate(e.endDate || e.end || e.startDate || e.start);
            if (!s || !en) return null;
            return { start: s, end: en };
        })
        .filter(Boolean)
        .sort((a, b) => a.start.getTime() - b.start.getTime());

    const free = [];
    slots.forEach(slot => {
        let windows = [{ start: slot.start, end: slot.end }];
        busy.forEach(b => {
            windows = windows.flatMap(w => {
                if (b.end <= w.start || b.start >= w.end) return [w];
                const out = [];
                if (b.start > w.start) out.push({ start: w.start, end: new Date(Math.min(b.start.getTime(), w.end.getTime())) });
                if (b.end < w.end) out.push({ start: new Date(Math.max(b.end.getTime(), w.start.getTime())), end: w.end });
                return out.filter(x => x.end > x.start);
            });
        });
        free.push(...windows);
    });
    return free;
}

async function suggestSchedule(context, req, userId) {
    const now = new Date();
    const en = isEnglish(req);
    const tasksRaw = req.body?.tasks;
    const events = req.body?.events || [];
    const preferences = req.body?.preferences || {};
    const days = typeof preferences.days === 'number' ? clamp(preferences.days, 1, 14) : 5;
    const workBlocks = Array.isArray(preferences.workBlocks) ? preferences.workBlocks : [[9, 12], [14, 17]];

    const tasks = (Array.isArray(tasksRaw) ? tasksRaw : await getTasks(userId)).map(normalizeTaskShape);
    const pending = tasks.filter(t => String(t.status || '').toLowerCase() !== 'completed');

    // Prioriser avant planification
    const prioritized = pending
        .map(t => ({ t, s: computeTaskScore(t, now) }))
        .sort((a, b) => b.s.score - a.s.score)
        .map(x => x.t);

    const baseSlots = buildTimeSlots({ startDate: now, days, workBlocks });
    const freeSlots = subtractEvents(baseSlots, events).filter(s => s.end.getTime() - s.start.getTime() >= 20 * 60 * 1000);

    const schedule = [];
    const unscheduled = [];

    // Greedy fit: remplir les créneaux disponibles
    let slotIndex = 0;
    for (const task of prioritized) {
        const durMin = parseEstimatedMinutes(task.estimatedTime) || 60;
        let placed = false;

        while (slotIndex < freeSlots.length) {
            const slot = freeSlots[slotIndex];
            const slotMinutes = Math.floor((slot.end.getTime() - slot.start.getTime()) / 60000);
            if (slotMinutes < durMin) {
                slotIndex++;
                continue;
            }

            const start = new Date(slot.start);
            const end = new Date(start.getTime() + durMin * 60000);

            schedule.push({
                taskId: task.id,
                title: task.title,
                start: start.toISOString(),
                end: end.toISOString(),
                minutes: durMin,
                reason: en ? 'Auto-placed based on priority and availability' : 'Placement automatique selon priorité et disponibilité'
            });

            // Réduire le slot courant
            slot.start = end;
            placed = true;
            break;
        }

        if (!placed) {
            unscheduled.push({
                taskId: task.id,
                title: task.title,
                estimatedMinutes: durMin,
                reason: en ? 'No free time slot within the planning window' : 'Aucun créneau libre dans la fenêtre de planification'
            });
        }
    }

    context.res = {
        status: 200,
        headers: corsJsonHeaders(),
        body: {
            userId,
            window: { days, workBlocks },
            schedule,
            unscheduled
        }
    };
}

async function productivityStats(context, req, userId) {
    const now = new Date();
    const tasks = (await getTasks(userId)).map(normalizeTaskShape);

    const profile = parsePersonalProfile(req);

    const completed = tasks.filter(t => String(t.status || '').toLowerCase() === 'completed');
    const pending = tasks.filter(t => String(t.status || '').toLowerCase() !== 'completed');

    const overdue = pending.filter(t => {
        const d = parseIsoDate(t.deadline);
        return d && d.getTime() < now.getTime();
    });

    // Streak simple (jours consécutifs avec au moins 1 tâche complétée)
    const byDay = new Set(
        completed
            .map(t => parseIsoDate(t.completedAt || t.updatedAt))
            .filter(Boolean)
            .map(d => d.toISOString().slice(0, 10))
    );

    let streak = 0;
    for (let i = 0; i < 365; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        if (byDay.has(key)) streak++;
        else break;
    }

    const totalEstimatedPendingMin = pending.reduce((sum, t) => sum + (parseEstimatedMinutes(t.estimatedTime) || 60), 0);
    const overload = calcOverload(tasks, now);

    const metricsBase = {
        total: tasks.length,
        completed: completed.length,
        pending: pending.length,
        overdue: overdue.length,
        streakDays: streak,
        pendingEstimatedHours: Math.round((totalEstimatedPendingMin / 60) * 10) / 10,
        overloadNext24: overload.overload,
        next24Hours: Math.round((overload.next24Minutes / 60) * 10) / 10
    };

    const completionRate = metricsBase.total > 0 ? Math.round((metricsBase.completed / metricsBase.total) * 100) : 0;
    const mentalLoadScore = computeMentalLoadScore(metricsBase);
    const stressIndex = computeStressIndex(metricsBase, profile);

    context.res = {
        status: 200,
        headers: corsJsonHeaders(),
        body: {
            userId,
            now: now.toISOString(),
            metrics: {
                ...metricsBase,
                completionRate,
                mentalLoadScore,
                stressIndex,
                profile: {
                    provided: profile.provided,
                    age: profile.age,
                    sex: profile.sex,
                    focusHours: profile.focusHours
                }
            }
        }
    };
}

async function coachAdvice(context, req, userId) {
    const now = new Date();
    const tasks = (await getTasks(userId)).map(normalizeTaskShape);
    const profile = parsePersonalProfile(req);

    const coachModeRaw = String(req.query?.coachMode ?? req.body?.coachMode ?? '').trim().toLowerCase();
    const wantsLlm = coachModeRaw === 'llm' || coachModeRaw === 'ai' || coachModeRaw === 'true' || coachModeRaw === '1';
    const message = parseOptionalString(req.query?.message ?? req.body?.message) || '';
    const historyExcerptRaw = parseOptionalString(req.query?.historyExcerpt ?? req.body?.historyExcerpt) || '';
    const historyExcerpt = historyExcerptRaw.length > 1200 ? historyExcerptRaw.slice(historyExcerptRaw.length - 1200) : historyExcerptRaw;

    const completed = tasks.filter(t => String(t.status || '').toLowerCase() === 'completed');
    const pending = tasks.filter(t => String(t.status || '').toLowerCase() !== 'completed');
    const overdue = pending.filter(t => {
        const d = parseIsoDate(t.deadline);
        return d && d.getTime() < now.getTime();
    });

    const byDay = new Set(
        completed
            .map(t => parseIsoDate(t.completedAt || t.updatedAt))
            .filter(Boolean)
            .map(d => d.toISOString().slice(0, 10))
    );

    let streak = 0;
    for (let i = 0; i < 365; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        if (byDay.has(key)) streak++;
        else break;
    }

    const totalEstimatedPendingMin = pending.reduce((sum, t) => sum + (parseEstimatedMinutes(t.estimatedTime) || 60), 0);
    const overload = calcOverload(tasks, now);

    const metricsBase = {
        total: tasks.length,
        completed: completed.length,
        pending: pending.length,
        overdue: overdue.length,
        streakDays: streak,
        pendingEstimatedHours: Math.round((totalEstimatedPendingMin / 60) * 10) / 10,
        overloadNext24: overload.overload,
        next24Hours: Math.round((overload.next24Minutes / 60) * 10) / 10
    };

    const completionRate = metricsBase.total > 0 ? Math.round((metricsBase.completed / metricsBase.total) * 100) : 0;
    const mentalLoadScore = computeMentalLoadScore(metricsBase);
    const stressIndex = computeStressIndex(metricsBase, profile);

    const metrics = {
        ...metricsBase,
        completionRate,
        mentalLoadScore,
        stressIndex
    };

    const topPending = tasks
        .filter(t => String(t.status || '').toLowerCase() !== 'completed')
        .map(t => ({ t, s: computeTaskScore(t, now) }))
        .sort((a, b) => b.s.score - a.s.score)
        .slice(0, 8)
        .map(x => ({
            id: x.t.id,
            title: x.t.title,
            priority: x.t.priority,
            deadline: x.t.deadline,
            estimatedTime: x.t.estimatedTime,
            category: x.t.category
        }));

    let coach = buildCoachAdvice({ metrics, profile });

    if (wantsLlm) {
        const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
        if (groqKey) {
            try {
                const systemPrompt = `Tu es "AI Coach" pour Agent ToDo. Objectif: aider l'utilisateur à avancer aujourd'hui.

Contraintes:
 - ${getResponseLanguageInstruction(lang, { tone: '' })}
- Ton: conversationnel, bienveillant, direct (style ChatGPT), sans te présenter.
- Utilise le contexte (métriques, top tâches, historique court) pour personnaliser.
- Propose 3 actions concrètes max (priorisées), et 1 micro-action (≤ 5 min) si utile.
- Ne promets pas de résultats et n'invente pas de données.

FORMAT JSON STRICT:
{
  "response": "texte court (5-10 lignes max)",
  "advice": {"work": ["..."], "personal": ["..."]}
}`;

                const userPayload = {
                    now: now.toISOString(),
                    userMessage: message,
                    historyExcerpt,
                    profile: {
                        provided: profile.provided,
                        age: profile.age,
                        sex: profile.sex,
                        focusHours: profile.focusHours
                    },
                    metrics,
                    topPending
                };

                const model = resolveRequestedGroqModel(req);
                const messages = [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: JSON.stringify(userPayload, null, 2) }
                ];

                await precheckCredit({
                    userId,
                    model,
                    messages,
                    maxTokens: 900
                });

                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${groqKey}`
                    },
                    body: JSON.stringify({
                        model,
                        messages,
                        max_tokens: 900,
                        temperature: 0.4,
                        response_format: { type: 'json_object' }
                    })
                });

                if (response.ok) {
                    const aiData = await response.json();
                    await debitAfterUsage({ userId, model: aiData?.model || model, usage: aiData.usage });
                    const parsed = JSON.parse(aiData.choices[0].message.content);
                    const respText = parseOptionalString(parsed?.response) || coach.response;
                    const work = Array.isArray(parsed?.advice?.work) ? parsed.advice.work.map(x => String(x)).filter(Boolean) : coach.advice.work;
                    const personal = Array.isArray(parsed?.advice?.personal) ? parsed.advice.personal.map(x => String(x)).filter(Boolean) : coach.advice.personal;
                    coach = { response: respText, advice: { work, personal } };
                }
            } catch (e) {
                if (e?.status === 402 || e?.code === 'INSUFFICIENT_CREDIT') {
                    // Crédit épuisé: fallback heuristique silencieux.
                } else {
                    context.log('coach llm fallback:', e && e.message ? e.message : e);
                }
            }
        }
    }

    context.res = {
        status: 200,
        headers: corsJsonHeaders(),
        body: {
            userId,
            now: now.toISOString(),
            mode: wantsLlm ? 'llm' : 'heuristic',
            profile: {
                provided: profile.provided,
                age: profile.age,
                sex: profile.sex,
                focusHours: profile.focusHours
            },
            metrics,
            response: coach.response,
            advice: coach.advice
        }
    };
}

async function summary(context, req, userId) {
    const now = new Date();
    const en = isEnglish(req);
    const mode = String(req.query?.mode || req.body?.mode || 'daily').toLowerCase();
    const tasks = (await getTasks(userId)).map(normalizeTaskShape);

    const start = new Date(now);
    if (mode === 'weekly') start.setDate(now.getDate() - 7);
    else start.setHours(0, 0, 0, 0);

    const completed = tasks.filter(t => {
        const status = String(t.status || '').toLowerCase();
        if (status !== 'completed') return false;
        const d = parseIsoDate(t.completedAt || t.updatedAt);
        return d && d.getTime() >= start.getTime();
    });

    const pending = tasks.filter(t => String(t.status || '').toLowerCase() !== 'completed');
    const prioritized = pending
        .map(t => ({ t, s: computeTaskScore(t, now) }))
        .sort((a, b) => b.s.score - a.s.score)
        .slice(0, 5)
        .map(x => ({
            taskId: x.t.id,
            title: x.t.title,
            reason: x.s.overdue
                ? (en ? 'Overdue' : 'En retard')
                : (x.t.deadline ? (en ? 'Due date / priority' : 'Échéance / priorité') : (en ? 'Priority' : 'Priorité'))
        }));

    const overload = calcOverload(tasks, now);

    const text = mode === 'weekly'
        ? (en
            ? `🗓️ Weekly recap: ${completed.length} completed, ${pending.length} in progress. ${overload.overload ? '⚠️ potential overload.' : ''}`
            : `🗓️ Récap hebdo: ${completed.length} terminée(s), ${pending.length} en cours. ${overload.overload ? '⚠️ surcharge possible.' : ''}`)
        : (en
            ? `📅 Daily recap: ${completed.length} completed, ${pending.length} in progress. ${overload.overload ? '⚠️ potential overload.' : ''}`
            : `📅 Récap du jour: ${completed.length} terminée(s), ${pending.length} en cours. ${overload.overload ? '⚠️ surcharge possible.' : ''}`);

    context.res = {
        status: 200,
        headers: corsJsonHeaders(),
        body: {
            userId,
            mode,
            response: text,
            completedCount: completed.length,
            pendingCount: pending.length,
            topNext: prioritized,
            insights: {
                overload: overload.overload,
                next24Hours: Math.round((overload.next24Minutes / 60) * 10) / 10
            }
        }
    };
}

/**
 * Ajout intelligent de tâche via IA (parse langage naturel)
 */
async function smartAddTask(context, req, userId) {
    const description = safeText(req.body?.description, MAX_TEXT_CHARS).trim();

    if (!description) {
        context.res = {
            status: 400,
            headers: corsJsonHeaders(),
            body: { error: "Task description is required" }
        };
        return;
    }

    const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;

    if (!groqKey) {
        context.res = {
            status: 500,
            headers: corsJsonHeaders(),
            body: { error: "Groq API Key not configured" }
        };
        return;
    }

    // Utiliser IA pour parser la tâche
    const systemPrompt = `Tu es un assistant de gestion de tâches. Parse la description de tâche en JSON.

FORMAT ATTENDU:
{
  "title": "Titre court de la tâche",
  "description": "Description détaillée",
  "priority": "low|medium|high|urgent",
  "deadline": "YYYY-MM-DD" ou null,
  "estimatedTime": "Xh" ou null,
  "category": "travail|personnel|urgent|santé|etc.",
  "subtasks": ["sous-tâche 1", "sous-tâche 2"] ou []
}

RÈGLES:
- Détecte automatiquement la priorité basée sur mots-clés (urgent, important, vite, etc.)
- Extrait les dates si mentionnées (demain, lundi prochain, dans 3 jours, etc.)
- Suggère sous-tâches si la tâche est complexe
- Estime le temps si possible

EXEMPLES:
Input: "Finir le rapport urgent pour vendredi"
Output: {"title":"Finir le rapport","priority":"urgent","deadline":"2025-12-20",...}

Input: "Rappelle-moi d'acheter du lait"
Output: {"title":"Acheter du lait","priority":"low","category":"personnel",...}`;

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Parse cette tâche (date du jour: ${new Date().toISOString().split('T')[0]}):\n\n${description}` }
    ];

    const model = resolveRequestedGroqModel(req);
    try {
        await precheckCredit({ userId, model, messages, maxTokens: 500 });
    } catch (e) {
        if (e?.status === 402 || e?.code === 'INSUFFICIENT_CREDIT') {
            context.res = {
                status: 402,
                headers: corsJsonHeaders(),
                body: {
                    error: pickLang(req, 'Crédit insuffisant', 'Insufficient credit'),
                    currency: e.currency || 'EUR',
                    remainingCents: Number(e.remainingCents || 0),
                    remainingEur: Number((Number(e.remainingCents || 0) / 100).toFixed(2))
                }
            };
            return;
        }
        throw e;
    }

    const priority = String(req.__axilumPlanPriority || 'normal');
    const response = await callGroqWithRateLimit(async () => fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
            model,
            messages: messages,
            max_tokens: 500,
            temperature: 0.2,
            response_format: { type: "json_object" }
        })
    }), priority);

    if (!response.ok) {
        const errorText = await response.text();
        context.res = {
            status: 502,
            headers: corsJsonHeaders(),
            body: {
                error: `Groq Error: ${response.status}`,
                details: safeText(errorText, 2000)
            }
        };
        return;
    }

    const aiData = await response.json();
    const credit = await debitAfterUsage({ userId, model: aiData?.model || model, usage: aiData.usage });
    let parsedTask;
    try {
        parsedTask = JSON.parse(aiData.choices[0].message.content);
    } catch (e) {
        context.res = {
            status: 502,
            headers: corsJsonHeaders(),
            body: { error: pickLang(req, 'Réponse IA invalide (JSON).', 'Invalid AI response (JSON).'), details: String(e && e.message ? e.message : e) }
        };
        return;
    }

    // Créer la tâche avec ID
    const task = normalizeTaskShape({
        id: Date.now().toString(),
        ...parsedTask,
        status: 'pending',
        createdAt: new Date().toISOString(),
        originalInput: description
    });

    // Sauvegarder (simulation - en production: Azure Storage)
    const tasks = await getTasks(userId);
    tasks.push(task);
    await saveTasks(userId, tasks);

    await auditSafe({
        email: getAuthEmail(req) || null,
        action: 'todo.smart_add',
        status: 'ok',
        plan: String(req.__axilumPlan || ''),
        meta: { userId, tokensUsed: aiData.usage?.total_tokens || 0 }
    });

    context.res = {
        status: 200,
        headers: corsJsonHeaders(),
        body: {
            task: task,
            message: "Tâche créée avec succès",
            tokensUsed: aiData.usage?.total_tokens || 0,
            credit
        }
    };
}

/**
 * Créer une tâche manuellement (ou mettre à jour si existe)
 */
async function createTask(context, req, userId) {
    try {
        const task = normalizeTaskShape({
            id: req.body?.id || Date.now().toString(),
            ...req.body,
            status: req.body?.status || 'pending',
            createdAt: req.body?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        const tasks = await getTasks(userId);

        // Chercher si la tâche existe déjà (par ID)
        const existingIndex = tasks.findIndex(t => normalizeId(t.id) === task.id);

        if (existingIndex >= 0) {
            // Mettre à jour la tâche existante
            tasks[existingIndex] = task;
        } else {
            // Ajouter nouvelle tâche
            tasks.push(task);
        }

        await saveTasks(userId, tasks);

        await auditSafe({
            email: getAuthEmail(req) || null,
            action: 'todo.create',
            status: 'ok',
            plan: String(req.__axilumPlan || ''),
            meta: { userId, taskId: task.id }
        });

        context.res = {
            status: 200,
            headers: corsJsonHeaders(),
            body: {
                task: task,
                message: "Tâche créée"
            }
        };
    } catch (error) {
        await auditSafe({
            email: getAuthEmail(req) || null,
            action: 'todo.create',
            status: 'error',
            plan: String(req.__axilumPlan || ''),
            meta: { userId, error: String(error && error.message ? error.message : error) }
        });
        throw error;
    }
}

/**
 * Lister les tâches
 */
async function listTasks(context, req, userId) {
    const tasks = await getTasks(userId);
    const filter = req.query.filter; // pending, completed, urgent

    let filtered = tasks;
    if (filter === 'pending') {
        filtered = tasks.filter(t => t.status === 'pending');
    } else if (filter === 'completed') {
        filtered = tasks.filter(t => t.status === 'completed');
    } else if (filter === 'urgent') {
        filtered = tasks.filter(t => t.priority === 'urgent' || t.priority === 'high');
    }

    context.res = {
        status: 200,
        headers: corsJsonHeaders(),
        body: {
            tasks: filtered,
            total: filtered.length
        }
    };
}

/**
 * Mettre à jour une tâche
 */
async function updateTask(context, req, userId) {
    const { taskId, ...updates } = req.body;

    if (!taskId) {
        context.res = {
            status: 400,
            headers: corsJsonHeaders(),
            body: { error: "taskId is required" }
        };
        return;
    }

    const tasks = await getTasks(userId);
    const taskIdNorm = normalizeId(taskId);
    const taskIndex = tasks.findIndex(t => normalizeId(t.id) === taskIdNorm);

    if (taskIndex === -1) {
        context.res = {
            status: 404,
            headers: corsJsonHeaders(),
            body: { error: "Task not found" }
        };
        return;
    }

    // Compat: accepter dueDate côté client
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.dueDate != null && normalizedUpdates.deadline == null) {
        normalizedUpdates.deadline = normalizedUpdates.dueDate;
        delete normalizedUpdates.dueDate;
    }

    tasks[taskIndex] = normalizeTaskShape({
        ...tasks[taskIndex],
        ...normalizedUpdates,
        id: normalizeId(tasks[taskIndex].id),
        updatedAt: new Date().toISOString()
    });

    await saveTasks(userId, tasks);

    await auditSafe({
        email: getAuthEmail(req) || null,
        action: 'todo.update',
        status: 'ok',
        plan: String(req.__axilumPlan || ''),
        meta: { userId, taskId: taskIdNorm }
    });

    context.res = {
        status: 200,
        headers: corsJsonHeaders(),
        body: {
            task: tasks[taskIndex],
            message: "Tâche mise à jour"
        }
    };
}

/**
 * Supprimer une tâche
 */
async function deleteTask(context, req, userId) {
    const taskId = req.query.taskId || req.body?.taskId;

    if (!taskId) {
        context.res = {
            status: 400,
            headers: corsJsonHeaders(),
            body: { error: "taskId is required" }
        };
        return;
    }

    const tasks = await getTasks(userId);
    const taskIdNorm = normalizeId(taskId);
    const filtered = tasks.filter(t => normalizeId(t.id) !== taskIdNorm);

    if (filtered.length === tasks.length) {
        context.res = {
            status: 404,
            headers: corsJsonHeaders(),
            body: { error: "Task not found" }
        };
        return;
    }

    await saveTasks(userId, filtered);

    await auditSafe({
        email: getAuthEmail(req) || null,
        action: 'todo.delete',
        status: 'ok',
        plan: String(req.__axilumPlan || ''),
        meta: { userId, taskId: taskIdNorm }
    });

    context.res = {
        status: 200,
        headers: corsJsonHeaders(),
        body: {
            message: "Tâche supprimée",
            remainingTasks: filtered.length
        }
    };
}

/**
 * Synchronisation complète - Remplace toutes les tâches serveur par celles du client
 */
async function syncTasks(context, req, userId) {
    const { tasks } = req.body;

    if (!Array.isArray(tasks)) {
        context.res = {
            status: 400,
            headers: corsJsonHeaders(),
            body: { error: "Tasks array is required" }
        };
        return;
    }

    if (tasks.length > 2000) {
        context.res = {
            status: 413,
            headers: corsJsonHeaders(),
            body: { error: 'Too many tasks in sync', limit: 2000 }
        };
        return;
    }

    // Remplacer complètement les tâches du serveur (normalisées)
    const normalized = coerceArray(tasks).map(normalizeTaskShape);
    await saveTasks(userId, normalized);

    await auditSafe({
        email: getAuthEmail(req) || null,
        action: 'todo.sync',
        status: 'ok',
        plan: String(req.__axilumPlan || ''),
        meta: { userId, count: normalized.length }
    });

    context.res = {
        status: 200,
        headers: corsJsonHeaders(),
        body: {
            message: "Synchronisation réussie",
            taskCount: tasks.length,
            tasks: tasks
        }
    };
}

/**
 * Commande intelligente - Assistant conversationnel
 * Exemples: "Organise ma semaine", "Qu'est-ce que je dois faire maintenant?", "Déplace ça à demain"
 */
async function smartCommand(context, req, userId) {
    const command = safeText(req.body?.command, MAX_TEXT_CHARS).trim();
    const history = normalizeHistory(req.body?.history);
    const lang = getReqLang(req);
    const en = isEnglish(req);

    if (!command) {
        context.res = {
            status: 400,
            headers: corsJsonHeaders(),
            body: { error: "Command is required" }
        };
        return;
    }

    const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
    if (!groqKey) {
        context.res = {
            status: 500,
            headers: corsJsonHeaders(),
            body: { error: "Groq API Key not configured" }
        };
        return;
    }

    // Récupérer toutes les tâches (et limiter ce qu'on envoie au modèle)
    const allTasks = (await getTasks(userId)).map(normalizeTaskShape);
    const tasks = allTasks.slice(0, MAX_TASKS_IN_AI_CONTEXT);
    
    // Contexte temporel
    const now = new Date();
    const dayOfWeek = (en
        ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        : ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'])[now.getDay()];
    const hour = now.getHours();
    const timeOfDay = en
        ? (hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening')
        : (hour < 12 ? 'matin' : hour < 18 ? 'après-midi' : 'soir');
    
    // Préparer contexte des tâches
    const taskContext = tasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        deadline: t.deadline,
        status: t.status,
        category: t.category,
        estimatedTime: t.estimatedTime
    }));

        const systemPrompt = `${en
                ? 'You are Agent ToDo, a smart productivity assistant. You help the user manage tasks conversationally.'
                : "Tu es Agent ToDo, un assistant de productivité intelligent. Tu aides l'utilisateur à gérer ses tâches de manière conversationnelle."}

${pickLang(req, 'LANGUE:', 'LANGUAGE:')}
 - ${getResponseLanguageInstruction(lang, { tone: '' })}

${pickLang(req,
        "IMPORTANT: Ne te présente PAS à chaque message. Réponds naturellement et directement aux questions de l'utilisateur. Utilise ton nom \"Agent ToDo\" seulement si c'est pertinent dans le contexte de la conversation, pas systématiquement.",
        'IMPORTANT: Do not reintroduce yourself each message. Answer naturally and directly. Use the name "Agent ToDo" only when relevant, not systematically.'
)}

${pickLang(req, 'CONTEXTE ACTUEL:', 'CURRENT CONTEXT:')}
- ${pickLang(req, 'Date/Heure', 'Date/Time')}: ${now.toISOString()}
- ${pickLang(req, 'Jour', 'Day')}: ${dayOfWeek}, ${timeOfDay}
- ${pickLang(req, 'Nombre de tâches', 'Task count')}: ${tasks.length}

${pickLang(req, 'CAPACITÉS:', 'CAPABILITIES:')}
1. ${pickLang(req, '**Organiser/Planifier**: Réorganise les tâches selon priorités, deadlines, charge de travail', '**Organize/Plan**: Reorder tasks by priority, deadlines, workload')}
2. ${pickLang(req, '**Suggérer**: Recommande la prochaine tâche à faire selon contexte (heure, énergie, urgence)', '**Suggest**: Recommend next tasks based on context (time, energy, urgency)')}
3. ${pickLang(req, "**Modifier**: Change deadline, priorité, statut d'une ou plusieurs tâches", '**Modify**: Change deadline, priority, or status for one/many tasks')}
4. ${pickLang(req, '**Analyser**: Donne un aperçu de la charge de travail, tâches urgentes, etc.', '**Analyze**: Give an overview of workload, urgent items, etc.')}

${pickLang(req, 'FORMAT DE RÉPONSE JSON:', 'JSON RESPONSE FORMAT:')}
{
    "response": ${pickLang(req, '"Réponse conversationnelle à l\'utilisateur"', '"Conversational reply for the user"')},
    "action": "organize|suggest|modify|analyze|create|delete|info",
    "changes": [
        {
            "taskId": "123",
            "updates": {"deadline": "2025-12-15", "priority": "high"}
        }
    ],
    "created": [
        {
            "title": ${pickLang(req, '"Nouvelle tâche"', '"New task"')},
            "priority": "normal",
            "deadline": "2025-12-15",
            "category": ${pickLang(req, '"travail"', '"work"')},
            "estimatedTime": "1h"
        }
    ],
    "deleted": ["taskId1", "taskId2"],
    "suggestions": [
        {
            "taskId": "456",
            "reason": ${pickLang(req, '"Urgent et rapide à faire"', '"Urgent and quick to do"')},
            "order": 1
        }
    ],
    "insights": {
        "urgent": 3,
        "today": 5,
        "overdue": 1,
        "totalTime": "6h"
    }
}

${pickLang(req, 'EXEMPLES:', 'EXAMPLES:')}

${pickLang(req, 'Commande', 'Command')}: "${pickLang(req, 'Organise ma semaine', 'Plan my week')}"
→ ${pickLang(req, 'Analyse deadlines, distribue tâches sur la semaine, équilibre charge quotidienne', 'Analyze deadlines, spread tasks over the week, balance daily load')}

${pickLang(req, 'Commande', 'Command')}: "${pickLang(req, "Qu'est-ce que je dois faire maintenant ?", 'What should I do now?')}"
→ ${pickLang(req, 'Suggère 2-3 tâches selon contexte (heure, priorité, temps estimé)', 'Suggest 2-3 tasks based on context (time, priority, duration)')}

${pickLang(req, 'Commande', 'Command')}: "${pickLang(req, 'Déplace la réunion à demain', 'Move the meeting to tomorrow')}"
→ ${pickLang(req, 'Trouve tâche avec "réunion", change deadline à demain', 'Find task matching "meeting", set deadline to tomorrow')}

${pickLang(req, 'Commande', 'Command')}: "${pickLang(req, 'Crée une tâche: Appeler Marie demain à 14h', 'Create a task: Call Marie tomorrow at 2pm')}"
→ ${pickLang(req, 'Crée nouvelle tâche title="Appeler Marie", deadline=demain 14h', 'Create new task title="Call Marie", deadline=tomorrow 2pm')}

${pickLang(req, 'Commande', 'Command')}: "${pickLang(req, 'Supprime les tâches terminées', 'Delete completed tasks')}"
→ ${pickLang(req, 'Supprime toutes les tâches avec status="completed"', 'Delete all tasks with status="completed"')}

${pickLang(req, 'Commande', 'Command')}: "${pickLang(req, 'Marque la première tâche comme terminée', 'Mark the first task as done')}"
→ ${pickLang(req, 'Change status à "completed" pour la première tâche', 'Set status to "completed" for the first task')}

${pickLang(req, 'Commande', 'Command')}: "${pickLang(req, "Qu'est-ce qui est urgent ?", 'What is urgent?')}"
→ ${pickLang(req, 'Liste tâches urgentes ou avec deadline proche', 'List urgent or near-deadline tasks')}

${pickLang(req, 'RÈGLES:', 'RULES:')}
- ${pickLang(req, 'Réponds de manière naturelle et conversationnelle', 'Respond naturally and conversationally')}
- ${pickLang(req, 'Ne répète PAS ta présentation à chaque message', 'Do not repeat your intro each message')}
- ${pickLang(req, 'Sois direct et concis dans tes réponses', 'Be direct and concise in answers')}
- ${pickLang(req, 'Priorise selon: urgence > importance > effort', 'Prioritize: urgency > importance > effort')}
- ${pickLang(req, 'Le matin: tâches complexes/créatives', 'Morning: complex/creative tasks')}
- ${pickLang(req, "L'après-midi: réunions/communications", 'Afternoon: meetings/communications')}
- ${pickLang(req, 'Le soir: tâches simples/administratives', 'Evening: simple/administrative tasks')}
- ${pickLang(req, 'Si plusieurs tâches matchent, demande clarification', 'If multiple tasks match, ask for clarification')}`;

    const omitted = allTasks.length > tasks.length ? (allTasks.length - tasks.length) : 0;
    const userMessage = `Tâches actuelles (total ${allTasks.length}, incluses ${tasks.length}${omitted ? `, omises ${omitted}` : ''}):\n${JSON.stringify(taskContext, null, 2)}\n\nCommande utilisateur:\n${command}`;

    // Construire l'historique des messages
    const messages = [
        { role: "system", content: systemPrompt }
    ];

    // Ajouter l'historique de conversation s'il existe
    if (history.length > 0) messages.push(...history);

    // Ajouter le message actuel de l'utilisateur
    messages.push({ role: "user", content: userMessage });

    const model = resolveRequestedGroqModel(req);
    try {
        await precheckCredit({ userId, model, messages, maxTokens: 2000 });
    } catch (e) {
        if (e?.status === 402 || e?.code === 'INSUFFICIENT_CREDIT') {
            context.res = {
                status: 402,
                headers: corsJsonHeaders(),
                body: {
                    error: pickLang(req, 'Crédit insuffisant', 'Insufficient credit'),
                    currency: e.currency || 'EUR',
                    remainingCents: Number(e.remainingCents || 0),
                    remainingEur: Number((Number(e.remainingCents || 0) / 100).toFixed(2))
                }
            };
            return;
        }
        throw e;
    }

    const priority = String(req.__axilumPlanPriority || 'normal');
    const response = await callGroqWithRateLimit(async () => fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
            model,
            messages: messages,
            max_tokens: 2000,
            temperature: 0.3,
            response_format: { type: "json_object" }
        })
    }), priority);

    if (!response.ok) {
        const errorText = await response.text();
        context.res = {
            status: 502,
            headers: corsJsonHeaders(),
            body: { error: `Groq Error: ${response.status}`, details: errorText }
        };
        return;
    }

    const aiData = await response.json();
    const credit = await debitAfterUsage({ userId, model: aiData?.model || model, usage: aiData.usage });
    let result;
    try {
        result = JSON.parse(aiData.choices[0].message.content);
    } catch (e) {
        context.res = {
            status: 502,
            headers: corsJsonHeaders(),
            body: { error: pickLang(req, 'Réponse IA invalide (JSON).', 'Invalid AI response (JSON).'), details: String(e && e.message ? e.message : e) }
        };
        return;
    }

    const changes = coerceArray(result.changes).slice(0, MAX_AI_CHANGES);
    const created = coerceArray(result.created).slice(0, MAX_AI_CREATED);
    const deleted = coerceArray(result.deleted).slice(0, MAX_AI_DELETED);
    const hasWrites = changes.length > 0 || created.length > 0 || deleted.length > 0;
    const normalizedAction = normalizeAction(result.action, { hasWrites });

    // Appliquer les changements suggérés par l'IA
    let updatedTasks = [...allTasks];
    let tasksModified = 0;

    // 1. Modifier les tâches existantes
    if (changes.length > 0) {
        changes.forEach(change => {
            const changeTaskId = normalizeId(change && change.taskId);
            const taskIndex = updatedTasks.findIndex(t => normalizeId(t.id) === changeTaskId);
            if (taskIndex !== -1) {
                const rawUpdates = (change && change.updates && typeof change.updates === 'object') ? change.updates : {};
                // Compat: accepter dueDate côté client
                const safeUpdates = { ...rawUpdates };
                if (safeUpdates.dueDate != null && safeUpdates.deadline == null) {
                    safeUpdates.deadline = safeUpdates.dueDate;
                    delete safeUpdates.dueDate;
                }

                // Normaliser status
                if (typeof safeUpdates.status === 'string') {
                    const s = safeUpdates.status.toLowerCase();
                    if (s === 'done' || s === 'completed' || s === 'finish' || s === 'finished') safeUpdates.status = 'completed';
                    if (s === 'todo' || s === 'pending' || s === 'open') safeUpdates.status = 'pending';
                }

                updatedTasks[taskIndex] = normalizeTaskShape({
                    ...updatedTasks[taskIndex],
                    ...safeUpdates,
                    id: normalizeId(updatedTasks[taskIndex].id),
                    updatedAt: new Date().toISOString()
                });
                tasksModified++;
            }
        });
    }

    // 2. Créer de nouvelles tâches
    if (created.length > 0) {
        created.forEach(newTask => {
            const task = normalizeTaskShape({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                title: newTask && newTask.title,
                description: (newTask && newTask.description) || '',
                priority: (newTask && newTask.priority) || 'normal',
                deadline: (newTask && (newTask.deadline ?? newTask.dueDate)) || null,
                category: (newTask && newTask.category) || 'personnel',
                status: (newTask && newTask.status) || 'pending',
                estimatedTime: (newTask && newTask.estimatedTime) || null,
                subtasks: (newTask && newTask.subtasks) || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            updatedTasks.push(task);
            tasksModified++;
        });
    }

    // 3. Supprimer des tâches
    if (deleted.length > 0) {
        deleted.forEach(taskId => {
            const taskIdNorm = normalizeId(taskId);
            const taskIndex = updatedTasks.findIndex(t => normalizeId(t.id) === taskIdNorm);
            if (taskIndex !== -1) {
                updatedTasks.splice(taskIndex, 1);
                tasksModified++;
            }
        });
    }

    // Sauvegarder si modifications
    if (tasksModified > 0) {
        await saveTasks(userId, updatedTasks);
    }

    await auditSafe({
        email: getAuthEmail(req) || null,
        action: 'todo.smart_command',
        status: 'ok',
        plan: String(req.__axilumPlan || ''),
        meta: { userId, tasksModified, tokensUsed: aiData.usage?.total_tokens || 0, action: normalizedAction }
    });

    context.res = {
        status: 200,
        headers: corsJsonHeaders(),
        body: {
            response: String(result.response || ''),
            action: normalizedAction,
            changes: changes,
            created: created,
            deleted: deleted,
            suggestions: coerceArray(result.suggestions),
            insights: (result.insights && typeof result.insights === 'object') ? result.insights : {},
            tasksModified: tasksModified,
            tokensUsed: aiData.usage?.total_tokens || 0,
            credit
        }
    };
}

// Helpers pour stockage (simulation - à remplacer par Azure Storage)
async function getTasks(userId) {
    return coerceArray(await taskStore.listTasks(userId));
}

async function saveTasks(userId, tasks) {
    const normalized = coerceArray(tasks).map(normalizeTaskShape);
    await taskStore.replaceAllTasks(userId, normalized);
    return true;
}

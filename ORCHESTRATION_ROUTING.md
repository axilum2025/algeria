**Orchestration et Routage (système)**

Ce document décrit comment le système d'orchestration et de routage fonctionne dans ce dépôt, les composants clés, le flux d'exécution, les variables d'environnement importantes, et inclut le code utilisé par l'orchestrateur et le function router.

**Composants clés**:
- **Frontend**: envoie des requêtes au backend (chat / commandes / /team).
- **Dev server**: `dev-server.js` — serveur Express pour le développement, mappe les handlers Azure Functions en routes Express.
- **Azure Functions style handlers**: dossiers `api/<function>/index.js` exposés via `/api/<route>`.
- **Function Router**: `api/utils/functionRouter.js` — détecte quelles fonctions/outils appeler, build des params, exécute avec cache/retry, orchestre fonctions parallèles/séquentielles.
- **Orchestrator**: `api/utils/orchestrator.js` — planifie/choisit agents (heuristique + LLM planner), appelle chaque agent via Groq (LLM), puis synthétise une réponse finale.
- **Invoke endpoint**: `api/invoke/index.js` — point d'entrée qui détecte `chatType === 'orchestrator'` et orchestre outils + agents.

**Flux d'exécution (cas `/team` / orchestrator)**:
1. Le frontend envoie une requête vers `/api/invoke` (ou endpoint `invoke`) avec `chatType: 'orchestrator'` ou via la commande `/team ...`.
2. `api/invoke/index.js` détecte `isOrchestrator` et :
   - Détecte les outils/fonctions nécessaires via `detectFunctions(teamQuestion)`.
   - Exécute ces fonctions via `orchestrateFunctions(...)` (function router) pour obtenir `toolsContext` (résultats d'outils).
   - Appelle `orchestrateMultiAgents(...)` (orchestrator) en fournissant `teamQuestion`, `toolsContext`, clefs (Groq, Brave), `recentHistory`.
3. `orchestrator` choisit les agents (heuristiques ou planner LLM), appelle chaque agent (via `callGroqChatCompletion`) pour récupérer leurs analyses.
4. `orchestrator` synthétise les réponses des agents en une réponse finale (nouveau LLM call) avec règles: pas de mention d'agents, fusion/dédoublonnage, plan d'action.
5. `api/invoke` retourne la réponse orchestrée au client, avec métriques, tokens utilisés, et résumé des outils.

**Routage local / mapping Azure Functions**:
- `dev-server.js` charge dynamiquement les dossiers sous `api/` et mappe `function.json` (httpTrigger.route) vers une route Express. Exemple: `api/tasks/index.js` et `function.json` route `tasks/{action?}` => Express route `/api/tasks/:action?`.
- Les handlers Azure-style sont appelés comme `await handler(context, reqObj);` et doivent remplir `context.res`.
- Endpoints d'introspection: `/__health`, `/__routes`.

**Variables d'environnement importantes**:
- `APPSETTING_GROQ_API_KEY` / `GROQ_API_KEY` : clé API Groq pour appels LLM.
- `APPSETTING_BRAVE_API_KEY` / `BRAVE_API_KEY` : clé Brave Search pour RAG.
- `AXILUM_FUNCTIONS_BASE_URL` / `FUNCTIONS_BASE_URL` : base URL des fonctions (Azure ou local `http://localhost:7071`).
- Flags spécifiques agents (ex: `HR_SILENT_WEB_REFRESH_ENABLED`, `MARKETING_SILENT_WEB_REFRESH_ENABLED`, ...)

---

**Extraits de code — `dev-server.js` (mapping des routes Azure -> Express)**

```javascript
// Extrait: mapping Azure Functions -> Express
// Dynamically load Azure Function style handlers from api/<fn>/index.js
const apiRoot = path.join(__dirname, 'api');
const routeMap = {}; // Map custom routes to handlers

if (fs.existsSync(apiRoot)) {
  const entries = fs.readdirSync(apiRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  entries.forEach(name => {
    const handlerPath = path.join(apiRoot, name, 'index.js');
    const functionJsonPath = path.join(apiRoot, name, 'function.json');
    if (fs.existsSync(handlerPath)) {
      const handler = require(handlerPath);
      let route = `/api/${name}`;
      if (fs.existsSync(functionJsonPath)) {
        const functionConfig = JSON.parse(fs.readFileSync(functionJsonPath, 'utf8'));
        const httpBinding = functionConfig.bindings?.find(b => b.type === 'httpTrigger');
        if (httpBinding && httpBinding.route) {
          route = `/api/${httpBinding.route}`;
        }
      }
      const expressRoute = route.replace(/{([^}]+)}/g, ':$1');
      app.all(expressRoute, async (req, res) => {
        const context = { log: logFn, invocationId: Date.now().toString(), bindings: {}, res: null };
        const reqObj = { method: req.method, headers: req.headers, query: req.query, params: req.params, body: req.body };
        await handler(context, reqObj);
        if (context.res) {
          if (typeof context.res.body === 'object') return res.status(context.res.status||200).json(context.res.body);
          return res.status(context.res.status||200).send(context.res.body);
        }
        res.status(200).json({ ok: true });
      });
    }
  });
}
```

---

**Code complet — `api/utils/functionRouter.js`**

Le fichier `functionRouter.js` orchestre la détection des fonctions à appeler, la construction des paramètres, l'exécution avec timeout/retry, le cache, et la coordination parallèle/séquentielle. Le fichier complet est reproduit ci-dessous.

```javascript
// 🎯 Function Router - Orchestration intelligente des fonctions avec cache et retry
// Gère les appels parallèles, séquentiels, cache, et gestion d'erreurs

const DEFAULT_TIMEOUT_MS = 25_000;

let NodeCache, cache;

try {
    NodeCache = require('node-cache');
    // Cache simple (TTL: 5 minutes)
    cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
} catch (e) {
    // Fallback si node-cache pas installé
    console.warn('⚠️ node-cache non installé, cache désactivé');
    cache = {
        get: () => undefined,
        set: () => true
    };
}

/**
 * Détecte quelle(s) fonction(s) appeler selon le message utilisateur
 */
function detectFunctions(userMessage) {
    const message = userMessage.toLowerCase();
    const functions = [];
    
    // Détection par mots-clés (ordre de priorité)
    const patterns = {
        // ✅ Fonctions réellement orchestrables sans données binaires
        excelAssistant: /excel|formule|tableau|spreadsheet|cellule|colonne|xlookup|recherchx|vlookup|recherchev|index\s*\(|match\s*\(/i,
        translate: /traduis|traduction|translate|en anglais|en français|en espagnol|langue/i,
        taskManager: /tâche|to-?do|rappelle|note|ajoute.*liste|gérer.*tâche/i,
        generateImage: /(g[ée]n[èe]re|cr[ée]e|dessine|fabrique|produis).*(image|photo|illustration|dessin|visuel|logo)|\b(image|photo|illustration|dessin|visuel|logo)\b/i,
        searchWeb: /cherche|recherche|trouve|infos? sur|google|brave/i,

        // ⚠️ Désactivés par défaut (besoin de données/credentials spécifiques)
        // analyzeImage: nécessite image base64
        // calendar: nécessite accessToken Microsoft
        // analyzeDocument: route non présente (utiliser extractText/vision-ocr si besoin)
        // sendEmail: nécessite paramètres email et endpoints dédiés
        // calculate: éviter exécution arbitraire côté serveur
    };
    
    for (const [func, pattern] of Object.entries(patterns)) {
        if (pattern.test(message)) {
            functions.push(func);
        }
    }
    
    return functions;
}

function getFunctionsBaseUrl() {
    const explicit = process.env.AXILUM_FUNCTIONS_BASE_URL || process.env.FUNCTIONS_BASE_URL || process.env.BASE_URL;
    if (explicit) return String(explicit).replace(/\/$/, '');

    // Azure Functions
    if (process.env.WEBSITE_HOSTNAME) return `https://${process.env.WEBSITE_HOSTNAME}`;

    // Local default
    return 'http://localhost:7071';
}

function withTimeout(fetchPromise, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return {
        promise: (async () => {
            try {
                return await fetchPromise(controller.signal);
            } finally {
                clearTimeout(timer);
            }
        })(),
        controller
    };
}

async function braveWebSearch(query) {
    const braveKey = process.env.APPSETTING_BRAVE_API_KEY || process.env.BRAVE_API_KEY;
    if (!braveKey) return [];

    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`;
    const resp = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': braveKey
        }
    });

    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Brave search failed: ${resp.status} ${txt.substring(0, 300)}`);
    }

    const data = await resp.json();
    const results = data.web?.results || [];
    return results.slice(0, 3).map(r => ({
        title: r.title,
        description: r.description,
        url: r.url
    }));
}

/**
 * Exécute une fonction avec retry automatique
 */
async function executeWithRetry(functionName, params, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await executeFunction(functionName, params);
            return { success: true, result };
        } catch (error) {
            lastError = error;
            
            // Retry seulement sur erreurs temporaires
            if (String(error.message || '').includes('429') || String(error.message || '').includes('timeout')) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            // Erreur permanente → arrêt
            break;
        }
    }
    
    return { success: false, error: lastError.message };
}

/**
 * Exécute une fonction avec cache
 */
async function executeCached(functionName, params) {
    const cacheKey = `${functionName}:${JSON.stringify(params)}`;
    
    // Vérifier cache
    const cached = cache.get(cacheKey);
    if (cached) {
        return { 
            success: true, 
            result: cached, 
            cached: true 
        };
    }
    
    // Exécuter avec retry
    const result = await executeWithRetry(functionName, params);
    
    // Mettre en cache si succès
    if (result.success) {
        cache.set(cacheKey, result.result);
    }
    
    return { ...result, cached: false };
}

/**
 * Exécute réellement la fonction (à implémenter selon vos endpoints)
 */
async function executeFunction(functionName, params) {
    // Certains “outils” sont plus fiables en inline (pas de dépendance à l'URL locale)
    if (functionName === 'searchWeb') {
        const query = params?.query || params?.q || params?.text || '';
        const results = await braveWebSearch(String(query));
        return { success: true, results };
    }

    const baseUrl = getFunctionsBaseUrl();

    // Mapping vers les routes Azure Functions existantes (cf. function.json)
    const routes = {
        translate: '/api/translate',
        excelAssistant: '/api/excelAssistant',
        taskManager: '/api/tasks/smart-command',
        generateImage: '/api/generate-image',
        calendar: '/api/microsoftCalendar',
        extractText: '/api/extractText',
        analyzeImage: '/api/analyze-image'
    };

    const route = routes[functionName];
    if (!route) throw new Error(`Fonction inconnue: ${functionName}`);

    const timeoutMs = Number(params?.timeoutMs || DEFAULT_TIMEOUT_MS);
    const headers = Object.assign(
        { 'Content-Type': 'application/json' },
        params?.headers && typeof params.headers === 'object' ? params.headers : {}
    );

    // Ne pas forwarder des champs de contrôle internes
    const { timeoutMs: _timeout, headers: _headers, ...body } = (params && typeof params === 'object') ? params : {};

    const { promise } = withTimeout((signal) => fetch(`${baseUrl}${route}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal
    }), timeoutMs);

    const response = await promise;
    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`${functionName} failed: ${response.status} ${txt.substring(0, 300)}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return await response.json();
    return { raw: await response.text() };
}

function buildParamsForFunction(functionName, userMessage, requestBody = {}) {
    const message = String(userMessage || '').trim();

    switch (functionName) {
        case 'translate': {
            const lower = message.toLowerCase();
            let targetLang = requestBody.targetLang;
            if (!targetLang) {
                if (/(en\s+anglais|to\s+english)/i.test(lower)) targetLang = 'anglais';
                else if (/(en\s+fran[çc]ais|to\s+french)/i.test(lower)) targetLang = 'français';
                else if (/(en\s+espagnol|to\s+spanish)/i.test(lower)) targetLang = 'espagnol';
            }
            return {
                text: requestBody.text || message,
                targetLang: targetLang || 'anglais',
                sourceLang: requestBody.sourceLang,
                preserveFormatting: true,
                includeAlternatives: false
            };
        }

        case 'excelAssistant':
            return {
                task: requestBody.task || message,
                data: requestBody.data,
                context: requestBody.context
            };

        case 'taskManager': {
            const userId = requestBody.userId;
            return {
                command: requestBody.command || message,
                history: requestBody.taskHistory || requestBody.history,
                userId
            };
        }

        case 'generateImage':
            return {
                prompt: requestBody.prompt || message,
                width: requestBody.width,
                height: requestBody.height
            };

        case 'calendar':
            return {
                action: requestBody.action || 'list',
                accessToken: requestBody.accessToken,
                startDate: requestBody.startDate,
                endDate: requestBody.endDate,
                event: requestBody.event,
                date: requestBody.date,
                time: requestBody.time
            };

        case 'extractText':
            return {
                file: requestBody.file,
                fileName: requestBody.fileName
            };

        case 'analyzeImage':
            return {
                imageBase64: requestBody.imageBase64 || requestBody.image,
                question: requestBody.question || message
            };

        case 'searchWeb':
            return {
                query: requestBody.query || message
            };

        default:
            return { query: message };
    }
}

/**
 * Orchestre l'exécution de plusieurs fonctions
 */
async function orchestrateFunctions(functions, userMessage, options = {}) {
    const results = [];
    const requestBody = options?.requestBody || {};
    
    // Séparer fonctions parallèles vs séquentielles
    const { parallel, sequential } = categorizeFunctions(functions);
    
    // 1. Exécuter fonctions parallèles (indépendantes)
    if (parallel.length > 0) {
        const promises = parallel.map(func => 
            executeCached(func.name, buildParamsForFunction(func.name, userMessage, requestBody))
        );
        
        const parallelResults = await Promise.allSettled(promises);
        
        parallelResults.forEach((res, idx) => {
            results.push({
                function: parallel[idx].name,
                success: res.status === 'fulfilled' && res.value.success,
                result: res.status === 'fulfilled' ? res.value.result : null,
                error: res.status === 'rejected' ? res.reason : null,
                cached: res.value?.cached || false
            });
        });
    }
    
    // 2. Exécuter fonctions séquentielles (dépendantes)
    for (const func of sequential) {
        const baseParams = buildParamsForFunction(func.name, userMessage, requestBody);
        const params = buildParamsFromPreviousResults({ ...func, params: baseParams }, results);
        const result = await executeCached(func.name, params);
        
        results.push({
            function: func.name,
            success: result.success,
            result: result.result,
            error: result.error,
            cached: result.cached
        });
        
        // Si fonction critique échoue → arrêt
        if (func.critical && !result.success) {
            break;
        }
    }
    
    return results;
}

/**
 * Catégorise fonctions selon dépendances
 */
function categorizeFunctions(functions) {
    // Règles de dépendance
    const dependencies = {
        createCalendarEvent: ['checkAvailability'],  // Doit vérifier dispo avant
        createTaskWithDeadline: ['calendar'],        // Ajoute au calendrier après
    };
    
    const parallel = [];
    const sequential = [];
    
    for (const func of functions) {
        const funcName = typeof func === 'string' ? func : func.name;
        
        if (dependencies[funcName]) {
            sequential.push({ name: funcName, critical: true });
        } else {
            parallel.push({ name: funcName, critical: false });
        }
    }
    
    return { parallel, sequential };
}

/**
 * Construit params d'une fonction à partir des résultats précédents
 */
function buildParamsFromPreviousResults(func, previousResults) {
    const params = { ...func.params };
    
    // Exemple: createCalendarEvent a besoin du résultat de checkAvailability
    if (func.name === 'createCalendarEvent') {
        const availabilityResult = previousResults.find(r => r.function === 'checkAvailability');
        if (availabilityResult && availabilityResult.success) {
            params.suggestedTime = availabilityResult.result.nextAvailableSlot;
        }
    }
    
    return params;
}

/**
 * Résume les résultats pour Axilum
 */
function summarizeResults(results) {
    const summary = {
        totalFunctions: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        cached: results.filter(r => r.cached).length,
        details: results.map(r => ({
            function: r.function,
            status: r.success ? 'success' : 'failed',
            cached: r.cached
        }))
    };
    
    return summary;
}

module.exports = {
    detectFunctions,
    executeCached,
    executeWithRetry,
    orchestrateFunctions,
    summarizeResults,
    cache
};

```

---

**Code complet — `api/utils/orchestrator.js`**

Le fichier `orchestrator.js` se charge du planning (heuristique + LLM planner), de l'appel aux agents via Groq, puis de la synthèse finale. Le fichier complet est reproduit ci-dessous.

```javascript
const {
  ALLOWED_AGENT_IDS,
  normalizeAgentId,
  pickTeamAgents,
  buildSystemPromptForAgent
} = require('./agentRegistry');

const { normalizeLang, getResponseLanguageInstruction } = require('./lang');

const { assertWithinBudget, recordUsage } = require('./aiUsageBudget');
const { precheckCredit, debitAfterUsage } = require('./aiCreditGuard');

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function getAllowedGroqModelsFromPricing() {
  const raw = String(process.env.AI_PRICING_JSON || '').trim();
  if (!raw) return null;
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const keys = Object.keys(parsed).map(k => String(k).trim()).filter(Boolean);
  return keys.length ? keys : null;
}

function resolveRequestedModel(requested) {
  const r = String(requested || '').trim();
  if (!r) return DEFAULT_GROQ_MODEL;
  const allowed = getAllowedGroqModelsFromPricing();
  if (!allowed) return DEFAULT_GROQ_MODEL;
  if (!allowed.includes(r)) return DEFAULT_GROQ_MODEL;
  return r;
}

function compactHistoryFromMessages(recentHistory, { maxTurns = 8, maxCharsPerLine = 400 } = {}) {
  const historyLines = [];
  (recentHistory || []).slice(-maxTurns).forEach((msg) => {
    if ((msg.type === 'user' || msg.role === 'user') && msg.content) {
      historyLines.push(`Utilisateur: ${String(msg.content).slice(0, maxCharsPerLine)}`);
      return;
    }
    if ((msg.type === 'bot' || msg.role === 'assistant') && msg.content) {
      const clean = String(msg.content)
        .replace(/(^|\n)\s*---\s*\n(?=\s*(📊|📚|💡|Sources\s*:))/m, '')
        .replace(/\n*💡.*\n*/gi, '')
        .trim();
      if (clean) historyLines.push(`Assistant: ${clean.slice(0, maxCharsPerLine)}`);
    }
  });
  return historyLines.length
    ? `\n\nContexte conversation (extraits):\n${historyLines.join('\n')}`
    : '';
}

async function callGroqChatCompletion(groqKey, messages, { max_tokens = 1400, temperature = 0.5, userId = 'guest', model } = {}) {
  const resolvedModel = resolveRequestedModel(model);
  await assertWithinBudget({ provider: 'Groq', route: 'orchestrator', userId });
  await precheckCredit({ userId, model: resolvedModel, messages, maxTokens: max_tokens });
  const startedAt = Date.now();
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
    body: JSON.stringify({ model: resolvedModel, messages, max_tokens, temperature })
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    const err = new Error(`Groq Error: ${resp.status}`);
    err.details = errorText;
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();

  // Débit du crédit sur le coût réel
  try {
    await debitAfterUsage({ userId, model: data?.model || resolvedModel, usage: data?.usage });
  } catch (_) {
    // best-effort
  }

  try {
    await recordUsage({
      provider: 'Groq',
      model: data?.model || resolvedModel,
      route: 'orchestrator',
      userId: String(userId || ''),
      usage: data?.usage,
      latencyMs: Date.now() - startedAt,
      ok: true
    });
  } catch (_) {
    // best-effort
  }

  return data;
}

function heuristicPickAgents(question) {
  const q = String(question || '').toLowerCase();
  const picked = [];

  const add = (id) => {
    if (!picked.includes(id) && ALLOWED_AGENT_IDS.includes(id)) picked.push(id);
  };

  if (/excel|tableau|tcd|power\s*query|formule|xlookup|recherchx|vlookup|recherchev|index/i.test(q)) add('excel-expert');
  if (/marketing|seo|ads|pub|campagne|email|funnel|acquisition|go[-\s]*to[-\s]*market/i.test(q)) add('marketing-agent');
  if (/rh|recrut|paie|cong[ée]s?|onboarding|contrat|employ[ée]s?/i.test(q)) add('hr-management');
  if (/t[aâ]che|todo|planning|priorit|roadmap|deadline/i.test(q)) add('agent-todo');
  if (/prix|vente|closing|objection|prospect|onboarding client|crm/i.test(q)) add('agent-tony');
  if (/strat[ée]gie|produit|organisation|kpi|okrs?/i.test(q)) add('agent-alex');
  if (/r[ée]cent|2024|2025|nouveaut[ée]s?|tendance|actualit[ée]s?|state of the art|\bweb\b/i.test(q)) add('web-search');
  if (/code|bug|erreur|api|node|javascript|typescript|sql|docker|azure|build|deploy/i.test(q)) add('agent-dev');

  if (picked.length === 0) add('axilum');

  return picked.slice(0, 3);
}

async function planAgentsWithLLM({ groqKey, teamQuestion, compactHistory, contextFromSearch = '', model } = {}) {
  const system = `Tu es un routeur multi-agents.

Ta tâche: choisir jusqu'à 3 agents pertinents pour répondre à la question.

Contraintes:
- Réponds UNIQUEMENT en JSON valide, sans texte autour.
- Schéma: {"agents": ["agent-id", ...]}
- Les agents possibles sont uniquement: ${ALLOWED_AGENT_IDS.join(', ')}
- Maximum 3 agents.
- Si tu n'es pas sûr, choisis "axilum".
`;

  const user = `Question: ${teamQuestion}${compactHistory}\n${contextFromSearch}`;

  const data = await callGroqChatCompletion(groqKey, [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ], { max_tokens: 250, temperature: 0.1, userId: 'guest', model });

  const raw = data?.choices?.[0]?.message?.content || '';
  const parsed = safeJsonParse(raw);
  const agents = Array.isArray(parsed?.agents) ? parsed.agents : [];

  const normalized = agents
    .map(normalizeAgentId)
    .filter(Boolean)
    .filter(a => a !== 'auto');

  const unique = Array.from(new Set(normalized)).slice(0, 3);
  return unique.length ? unique : ['axilum'];
}

async function orchestrateMultiAgents({
  groqKey,
  teamQuestion,
  teamAgentsRaw,
  recentHistory,
  braveKey,
  searchBrave,
  toolsContext,
  analyzeHallucination,
  logger,
  maxAgents = 3,
  userId = 'guest',
  model,
  lang
}) {
  const question = String(teamQuestion || '').trim();
  if (!question) {
    return { ok: false, error: 'Question vide. Utilisez: /team dev marketing -- votre question' };
  }

  const responseLang = normalizeLang(lang);

  const askedAgents = Array.isArray(teamAgentsRaw) ? teamAgentsRaw : [];
  const askedNormalized = askedAgents.map(normalizeAgentId).filter(Boolean);
  const wantsAuto = askedNormalized.length === 0 || askedNormalized.includes('auto');

  const compactHistory = compactHistoryFromMessages(recentHistory, { maxTurns: 8, maxCharsPerLine: 400 });

  let contextFromSearch = '';
  const toolsCtx = String(toolsContext || '').trim();

  let teamAgents;
  if (wantsAuto) {
    try {
      const mayNeedSearch = /r[ée]cent|2024|2025|nouveaut[ée]s?|tendance|actualit[ée]s?|state of the art/i.test(question);
      if (braveKey && mayNeedSearch && typeof searchBrave === 'function') {
        const results = await searchBrave(question, braveKey);
        if (results && results.length > 0) {
          contextFromSearch = '\n\nContexte de recherche web (utilise ces informations si pertinentes) :\n';
          results.slice(0, 3).forEach((r, i) => {
            contextFromSearch += `${i + 1}. ${r.title}: ${r.description} [${r.url}]\n`;
          });
        }
      }

      teamAgents = await planAgentsWithLLM({ groqKey, teamQuestion: question, compactHistory, contextFromSearch, model });
    } catch (e) {
      if (logger?.warn) logger.warn('Planner failed, using heuristics:', e?.message || e);
      teamAgents = heuristicPickAgents(question);
    }
  } else {
    teamAgents = pickTeamAgents(askedNormalized, { maxAgents });
  }

  // ... appelle chaque agent, collecte outputs, synthétise via un dernier appel LLM ...

  const workerOutputs = [];
  let totalTokensUsed = 0;

  for (const agent of teamAgents) {
    const workerMessages = [
      { role: 'system', content: buildSystemPromptForAgent(agent, combinedContext, { lang: responseLang }) },
      {
        role: 'user',
        content: `Tu es consulté comme expert (${agent}).\nRéponds de façon concise et actionnable.\n\nQuestion: ${question}${compactHistory}${toolsCtx ? `\\n\\nRésultats d'outils disponibles:\\n${toolsCtx}` : ''}`
      }
    ];

    const workerData = await callGroqChatCompletion(groqKey, workerMessages, { max_tokens: 1200, temperature: 0.5, userId, model });
    const workerText = workerData?.choices?.[0]?.message?.content || '';
    totalTokensUsed += workerData?.usage?.total_tokens || 0;
    workerOutputs.push({ agent, text: workerText });
  }

  // Synthèse finale
  const synthMessages = [ /* system prompt + user prompt avec notes d'experts */ ];
  const synthData = await callGroqChatCompletion(groqKey, synthMessages, { max_tokens: 1600, temperature: 0.6, userId, model });
  const aiResponse = synthData?.choices?.[0]?.message?.content || '';
  totalTokensUsed += synthData?.usage?.total_tokens || 0;

  // Analyse d'hallucination, métriques et retour
  return {
    ok: true,
    response: aiResponse + '\n\n---\n📊 **Métriques de Fiabilité** (extrait)',
    tokensUsed: totalTokensUsed,
    orchestratorAgents: teamAgents,
    hallucination: { /* ... */ }
  };
}

module.exports = {
  callGroqChatCompletion,
  orchestrateMultiAgents
};

```

---

**Extrait — intégration orchestrator dans `api/invoke/index.js`**

Le `invoke` détecte `chatType === 'orchestrator'` et exécute d'abord les outils détectés puis appelle `orchestrateMultiAgents`:

```javascript
// 🧩 ORCHESTRATEUR MULTI-AGENTS (sur demande)
if (isOrchestrator) {
    const braveKey = process.env.APPSETTING_BRAVE_API_KEY || process.env.BRAVE_API_KEY;
    const teamQuestion = String(req.body.teamQuestion || userMessage || '').trim();

    // 1) ⚙️ ORCHESTRATION OUTILS (automatique) - exécute les fonctions détectées
    let toolResults = [];
    let toolsContext = '';
    try {
        const neededTools = detectFunctions(teamQuestion);
        if (neededTools.length > 0) {
            toolResults = await orchestrateFunctions(neededTools, teamQuestion, { requestBody: req.body || {} });
            toolsContext = toolResults.map(r => `- [${r.function}] ${r.success ? 'success' : 'failed'}: ${JSON.stringify(r.result).slice(0,1200)}`).join('\n');
        }
    } catch (toolErr) {
        context.log.warn('Orchestration outils échouée, continue sans:', toolErr?.message || toolErr);
    }

    const orchestrated = await orchestrateMultiAgents({ groqKey, teamQuestion, teamAgentsRaw: req.body.teamAgents, recentHistory, braveKey, searchBrave, toolsContext, analyzeHallucination, logger: context.log, userId, model: requestedModel, lang });

    // retourne orchestrated.response, metrics, tokensUsed, orchestratorAgents, etc.
}
```

---

**Notes opérationnelles**:
- Pour ajouter ou modifier un agent, mettre à jour `api/utils/agentRegistry.js` (IDs autorisés, prompts system, mapping ids → prompts).
- Pour ajouter un outil/fonction exécutable, ajouter un dossier `api/<nom>/index.js` et (optionnel) `function.json` pour définir la route.
- Les appels LLM passent par `callGroqChatCompletion` (contrôle budget, facturation, débit crédit).
- Surveillance: `dev-server` expose `/__routes` pour introspection en dev.

---

Fichiers référencés (dans ce repo):
- [api/utils/functionRouter.js](api/utils/functionRouter.js)
- [api/utils/orchestrator.js](api/utils/orchestrator.js)
- [api/invoke/index.js](api/invoke/index.js)
- [dev-server.js](dev-server.js)

---

Si vous voulez que je commit/pousse ce fichier vers le dépôt maintenant, dites "pousse" ou autorisez-moi à pousser; sinon je peux ajuster le contenu.

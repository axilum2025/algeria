// Quota léger par instance (serverless) : utile en MVP.
// Pour une vraie persistance multi-instances, migrer vers Table Storage/Cosmos.

const buckets = new Map();

function nowMs() {
  return Date.now();
}

function normalizePlan(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'enterprise' || s === 'entreprise') return 'enterprise';
  if (s === 'pro') return 'pro';
  return 'free';
}

function getLimits(plan, feature) {
  const p = normalizePlan(plan);
  const f = String(feature || 'generic').toLowerCase().trim();

  // Limites volontairement simples (à ajuster selon pricing)
  // Notes:
  // - todo_ai = endpoints qui déclenchent IA (plus coûteux)
  // - todo_api = CRUD/sync (plus permissif)
  if (f === 'todo_ai') {
    if (p === 'enterprise') return { windowMs: 60_000, max: 60 };
    if (p === 'pro') return { windowMs: 60_000, max: 30 };
    return { windowMs: 60_000, max: 10 };
  }

  if (f === 'todo_api') {
    if (p === 'enterprise') return { windowMs: 60_000, max: 240 };
    if (p === 'pro') return { windowMs: 60_000, max: 120 };
    return { windowMs: 60_000, max: 40 };
  }

  // Default generic
  if (p === 'enterprise') return { windowMs: 60_000, max: 120 };
  if (p === 'pro') return { windowMs: 60_000, max: 60 };
  return { windowMs: 60_000, max: 20 };
}

function bucketKey({ plan, email, feature }) {
  const e = (email || 'guest').toString().toLowerCase();
  const f = String(feature || 'generic');
  return `${normalizePlan(plan)}|${e}|${f}`;
}

function peekQuota({ plan, email, feature }) {
  const { windowMs, max } = getLimits(plan, feature);
  const key = bucketKey({ plan, email, feature });

  const now = nowMs();
  const b = buckets.get(key) || { start: now, count: 0 };

  // fenêtre expirée → considérer comme reset (sans écrire)
  if (now - b.start >= windowMs) {
    return {
      allowed: true,
      limit: max,
      windowMs,
      remaining: max,
      resetInMs: windowMs
    };
  }

  const remaining = Math.max(0, max - b.count);
  return {
    allowed: remaining > 0,
    limit: max,
    windowMs,
    remaining,
    resetInMs: Math.max(0, windowMs - (now - b.start))
  };
}

function checkAndConsume({ plan, email, feature }) {
  const { windowMs, max } = getLimits(plan, feature);
  const key = bucketKey({ plan, email, feature });

  const now = nowMs();
  const b = buckets.get(key) || { start: now, count: 0 };

  // fenêtre expirée → reset
  if (now - b.start >= windowMs) {
    b.start = now;
    b.count = 0;
  }

  if (b.count >= max) {
    buckets.set(key, b);
    return { allowed: false, limit: max, windowMs, remaining: 0, resetInMs: Math.max(0, windowMs - (now - b.start)) };
  }

  b.count += 1;
  buckets.set(key, b);
  return { allowed: true, limit: max, windowMs, remaining: Math.max(0, max - b.count), resetInMs: Math.max(0, windowMs - (now - b.start)) };
}

module.exports = {
  checkAndConsume,
  peekQuota
};

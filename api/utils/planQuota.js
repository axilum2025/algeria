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

function getLimits(plan) {
  const p = normalizePlan(plan);
  // Limites volontairement simples (à ajuster selon pricing)
  if (p === 'enterprise') return { windowMs: 60_000, max: 120 };
  if (p === 'pro') return { windowMs: 60_000, max: 60 };
  return { windowMs: 60_000, max: 20 };
}

function bucketKey({ plan, email, feature }) {
  const e = (email || 'guest').toString().toLowerCase();
  const f = String(feature || 'generic');
  return `${normalizePlan(plan)}|${e}|${f}`;
}

function checkAndConsume({ plan, email, feature }) {
  const { windowMs, max } = getLimits(plan);
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
  checkAndConsume
};

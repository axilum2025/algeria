const { setCors, requireAuth } = require('../utils/auth');
const { computeUserCloudStorageState, DEFAULT_CONTAINERS } = require('../utils/storageQuota');

function normalizeLimit(n, def = 2500, min = 1, max = 10000) {
  const num = Number(n);
  if (!Number.isFinite(num)) return def;
  return Math.min(max, Math.max(min, Math.floor(num)));
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    setCors(context, 'GET, OPTIONS');
    context.res = { status: 200 };
    return;
  }

  setCors(context, 'GET, OPTIONS');

  try {
    const email = requireAuth(context, req);
    if (!email) return;

    const maxItems = normalizeLimit((req.query && (req.query.maxItems || req.query.limit)) || 2500, 2500, 1, 10000);
    const state = await computeUserCloudStorageState(email, { maxItems, containers: DEFAULT_CONTAINERS });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        ok: true,
        authenticated: true,
        email,
        plan: state.plan,
        scope: 'cloud',
        containers: state.containers,
        usage: state.usage,
        quota: state.quota
      }
    };
  } catch (e) {
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { ok: false, error: 'Erreur serveur', details: String(e?.message || e) }
    };
  }
};

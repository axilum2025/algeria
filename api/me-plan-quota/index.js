const { setCors, getAuthEmail } = require('../utils/auth');
const { getUserPlan, normalizePlan } = require('../utils/entitlements');
const { peekQuota } = require('../utils/planQuota');

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    setCors(context, 'GET, OPTIONS');
    context.res = { status: 200 };
    return;
  }

  setCors(context, 'GET, OPTIONS');

  try {
    const feature = String((req.query && req.query.feature) || 'excel_chat').trim() || 'excel_chat';

    const email = getAuthEmail(req);

    // Si authentifié: on suit le plan réel utilisateur.
    // Sinon: fallback sur le plan fourni par l'UI (demo) ou FREE.
    const requestedPlan = String((req.query && req.query.plan) || '').trim();
    const plan = email ? await getUserPlan(email) : normalizePlan(requestedPlan || 'free');

    const quota = peekQuota({ plan, email: email || 'guest', feature });
    const resetAt = new Date(Date.now() + (quota.resetInMs || 0)).toISOString();

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        authenticated: !!email,
        email: email || null,
        plan,
        feature,
        quota: {
          limit: quota.limit,
          remaining: quota.remaining,
          windowMs: quota.windowMs,
          resetInMs: quota.resetInMs,
          resetAt
        }
      }
    };
  } catch (e) {
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Erreur serveur', details: String(e && e.message ? e.message : e) }
    };
  }
};

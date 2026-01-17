const { setCors, getAuthEmail } = require('../utils/auth');
const { getCredit } = require('../utils/userCredits');

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    setCors(context, 'GET, OPTIONS');
    context.res = { status: 200 };
    return;
  }

  setCors(context, 'GET, OPTIONS');

  try {
    const currency = String(process.env.AI_COST_CURRENCY || 'USD').trim().toUpperCase() || 'USD';

    const requireAuth = String(process.env.ME_CREDIT_REQUIRE_AUTH || '').trim() === '1' || process.env.NODE_ENV === 'production';

    const email = getAuthEmail(req);

    if (requireAuth && !email) {
      context.res = {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Non authentifié' }
      };
      return;
    }

    // En mode non-auth (dev/demo), ne pas permettre de consulter un autre userId via query.
    const demoUserId = String((req.query && (req.query.userId || req.query.uid)) || '').trim();
    const userId = email || (demoUserId || 'guest');

    // Si non authentifié, on force à "guest" pour éviter l'énumération.
    const effectiveUserId = email ? userId : 'guest';

    const credit = await getCredit(effectiveUserId, { currency });
    const responseCurrency = currency;
    const balanceCents = Number(credit.balanceCents || 0);
    const balanceAmount = Number((balanceCents / 100).toFixed(2));

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        authenticated: !!email,
        userId: email || null,
        currency: responseCurrency,
        rawCurrency: credit.currency || null,
        balanceCents,
        balanceAmount,
        balanceEur: balanceAmount
      }
    };
  } catch (e) {
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Erreur serveur', details: String(e?.message || e) }
    };
  }
};

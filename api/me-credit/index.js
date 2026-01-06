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

    // Prefer auth email (safer), fallback to provided userId for demo/non-auth mode
    const email = getAuthEmail(req);
    const userId = email || String((req.query && (req.query.userId || req.query.uid)) || '').trim();

    const credit = await getCredit(userId || 'guest', { currency });
    const responseCurrency = currency;
    const balanceCents = Number(credit.balanceCents || 0);
    const balanceAmount = Number((balanceCents / 100).toFixed(2));

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        authenticated: !!email,
        userId: email || (userId || null),
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

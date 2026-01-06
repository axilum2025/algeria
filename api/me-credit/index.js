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
    const currency = 'EUR';

    // Prefer auth email (safer), fallback to provided userId for demo/non-auth mode
    const email = getAuthEmail(req);
    const userId = email || String((req.query && (req.query.userId || req.query.uid)) || '').trim();

    const credit = await getCredit(userId || 'guest', { currency });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        authenticated: !!email,
        userId: email || (userId || null),
        currency: credit.currency || currency,
        balanceCents: Number(credit.balanceCents || 0),
        balanceEur: Number((Number(credit.balanceCents || 0) / 100).toFixed(2))
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

const { getCode, deleteCode } = require('../utils/codeStorage');
const { getUserByEmail, updateUser } = require('../utils/userStorage');
const { signToken, setCors } = require('../utils/auth');

module.exports = async function (context, req) {
  setCors(context, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  try {
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    const code = (req.body?.code || '').toString().trim();

    if (!email || !code) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Email et code requis' } };
      return;
    }

    const stored = await getCode(email);
    if (!stored) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Aucun code en attente ou code expiré' } };
      return;
    }

    if (String(stored.code) !== code) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Code incorrect' } };
      return;
    }

    await deleteCode(email);

    const user = await getUserByEmail(email);
    if (!user) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Utilisateur introuvable' } };
      return;
    }

    await updateUser(email, { emailVerified: true, emailVerifiedAt: new Date().toISOString() });

    const secret = process.env.AXILUM_AUTH_SECRET;
    const token = signToken({ sub: email, email, displayName: user.displayName || user.email || email }, secret);

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        token,
        user: { id: email, email, name: user.displayName || user.email || email }
      }
    };
  } catch (err) {
    context.log.error('auth-verify error', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message || String(err) } };
  }
};

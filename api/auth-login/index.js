const crypto = require('crypto');
const { getUserByEmail } = require('../utils/userStorage');
const { signToken, setCors } = require('../utils/auth');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
}

module.exports = async function (context, req) {
  setCors(context, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  try {
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    const password = (req.body?.password || '').toString();

    if (!email || !password) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Email et mot de passe requis' } };
      return;
    }

    const user = await getUserByEmail(email);
    if (!user || !user.passwordHash || !user.salt) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Identifiants invalides' } };
      return;
    }

    const computed = hashPassword(password, user.salt);
    if (computed !== user.passwordHash) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Identifiants invalides' } };
      return;
    }

    if (user.emailVerified === false || user.emailVerified === 'false') {
      context.res = { status: 403, headers: { 'Content-Type': 'application/json' }, body: { error: 'Email non vérifié' } };
      return;
    }

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
    context.log.error('auth-login error', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message || String(err) } };
  }
};

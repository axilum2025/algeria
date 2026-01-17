const crypto = require('crypto');
const { getUserByEmail } = require('../utils/userStorage');
const { signToken, setCors } = require('../utils/auth');
const { getClientIp, hashIdentifier, rateLimit } = require('../utils/clientRateLimit');

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

    // Best-effort rate limiting (multi-instance via Azure Table if configured)
    const ipHash = hashIdentifier(getClientIp(req));
    const emailKey = hashIdentifier(email);
    const rl1 = await rateLimit({ key: `authLogin:ip:${ipHash}`, limit: 30, windowMs: 60_000 });
    const rl2 = await rateLimit({ key: `authLogin:email:${emailKey}`, limit: 10, windowMs: 10 * 60_000 });
    if (!rl1.allowed || !rl2.allowed) {
      const retryAfter = Math.max(rl1.retryAfterSeconds, rl2.retryAfterSeconds);
      context.res = {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
        body: { error: 'Trop de tentatives. Réessayez plus tard.' }
      };
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

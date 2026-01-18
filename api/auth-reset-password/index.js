const crypto = require('crypto');
const { getCode, deleteCode } = require('../utils/codeStorage');
const { getUserByEmail, updateUser } = require('../utils/userStorage');
const { setCors } = require('../utils/auth');
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
    const code = (req.body?.code || '').toString().trim();
    const newPassword = (req.body?.newPassword || '').toString();

    if (!email || !code || !newPassword) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Email, code et nouveau mot de passe requis' } };
      return;
    }

    if (newPassword.length < 6) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Mot de passe invalide (min 6 caractères)' } };
      return;
    }

    // Best-effort rate limiting (multi-instance via Azure Table if configured)
    const ipHash = hashIdentifier(getClientIp(req));
    const emailKey = hashIdentifier(email);
    const rl1 = await rateLimit({ key: `authPwdReset:ip:${ipHash}`, limit: 20, windowMs: 60_000 });
    const rl2 = await rateLimit({ key: `authPwdReset:email:${emailKey}`, limit: 10, windowMs: 10 * 60_000 });
    if (!rl1.allowed || !rl2.allowed) {
      const retryAfter = Math.max(rl1.retryAfterSeconds, rl2.retryAfterSeconds);
      context.res = {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
        body: { error: 'Trop de tentatives. Réessayez plus tard.' }
      };
      return;
    }

    const stored = await getCode(`reset:${email}`);
    const ok = Boolean(stored) && Date.now() <= stored.expiresAt && String(stored.code) === code;
    if (!ok) {
      if (stored && Date.now() > stored.expiresAt) {
        await deleteCode(`reset:${email}`);
      }
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Code invalide ou expiré' } };
      return;
    }

    await deleteCode(`reset:${email}`);

    const user = await getUserByEmail(email);
    // Réponse neutre (pas d'énumération) : avec un code valide c'est déjà suffisamment contraint,
    // mais on reste prudent sur le message.
    if (!user) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Code invalide ou expiré' } };
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(newPassword, salt);

    await updateUser(email, {
      salt,
      passwordHash,
      passwordUpdatedAt: new Date().toISOString()
    });

    context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { success: true } };
  } catch (err) {
    context.log.error('auth-reset-password error', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message || String(err) } };
  }
};

const sgMail = require('@sendgrid/mail');
const { storeCode } = require('../utils/codeStorage');
const { getUserByEmail } = require('../utils/userStorage');
const { setCors } = require('../utils/auth');
const { getClientIp, hashIdentifier, rateLimit } = require('../utils/clientRateLimit');

module.exports = async function (context, req) {
  setCors(context, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  try {
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    if (!email) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Email requis' } };
      return;
    }

    // Best-effort rate limiting (multi-instance via Azure Table if configured)
    const ipHash = hashIdentifier(getClientIp(req));
    const emailKey = hashIdentifier(email);
    const rl1 = await rateLimit({ key: `authResendCode:ip:${ipHash}`, limit: 10, windowMs: 60_000 });
    const rl2 = await rateLimit({ key: `authResendCode:email:${emailKey}`, limit: 3, windowMs: 10 * 60_000 });
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
    // Réponse neutre pour éviter l'énumération d'emails
    if (!user) {
      context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { success: true } };
      return;
    }

    if (user.emailVerified === true || user.emailVerified === 'true') {
      context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { success: true, alreadyVerified: true } };
      return;
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    await storeCode(email, verificationCode, expiresAt);

    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'SENDGRID_API_KEY non configuré' } };
      return;
    }

    sgMail.setApiKey(apiKey);
    const sender = process.env.SENDGRID_SENDER || 'noreply@axilum.ai';
    const name = user.displayName || user.email || 'utilisateur';

    await sgMail.send({
      to: email,
      from: sender,
      subject: 'Votre code de vérification Axilum AI',
      text: `Bonjour ${name},\n\nVotre code de vérification est: ${verificationCode}\n\nCe code expire dans 24 heures.`,
      html: `<p>Bonjour <strong>${name}</strong>,</p><p>Votre code de vérification est:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;">${verificationCode}</p><p>Ce code expire dans 24 heures.</p>`
    });

    context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { success: true } };
  } catch (err) {
    context.log.error('auth-resend-code error', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message || String(err) } };
  }
};

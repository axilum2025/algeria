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
    const rl1 = await rateLimit({ key: `authPwdResetReq:ip:${ipHash}`, limit: 10, windowMs: 60_000 });
    const rl2 = await rateLimit({ key: `authPwdResetReq:email:${emailKey}`, limit: 3, windowMs: 10 * 60_000 });
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

    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'SENDGRID_API_KEY non configuré' } };
      return;
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
    await storeCode(`reset:${email}`, resetCode, expiresAt);

    sgMail.setApiKey(apiKey);
    const sender = process.env.SENDGRID_SENDER || 'noreply@axilum.ai';
    const name = user.displayName || user.email || 'utilisateur';

    await sgMail.send({
      to: email,
      from: sender,
      subject: 'Code de réinitialisation Axilum AI',
      text: `Bonjour ${name},\n\nVotre code de réinitialisation est: ${resetCode}\n\nCe code expire dans 15 minutes.\n\nSi vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.`,
      html: `<p>Bonjour <strong>${name}</strong>,</p><p>Votre code de réinitialisation est :</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;">${resetCode}</p><p>Ce code expire dans <strong>15 minutes</strong>.</p><p style="color:#666">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>`
    });

    context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { success: true } };
  } catch (err) {
    context.log.error('auth-request-password-reset error', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message || String(err) } };
  }
};

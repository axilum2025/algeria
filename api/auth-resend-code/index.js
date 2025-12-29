const sgMail = require('@sendgrid/mail');
const { storeCode } = require('../utils/codeStorage');
const { getUserByEmail } = require('../utils/userStorage');
const { setCors } = require('../utils/auth');

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

    const user = await getUserByEmail(email);
    if (!user) {
      context.res = { status: 404, headers: { 'Content-Type': 'application/json' }, body: { error: 'Utilisateur introuvable' } };
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

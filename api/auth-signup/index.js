const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const { storeCode } = require('../utils/codeStorage');
const { userExists, createUser } = require('../utils/userStorage');
const { setCors } = require('../utils/auth');

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
    const name = (req.body?.name || '').toString().trim();
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    const password = (req.body?.password || '').toString();

    if (!email) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Email requis' } };
      return;
    }

    if (!password || password.length < 6) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Mot de passe invalide (min 6 caractères)' } };
      return;
    }

    // Création user (si déjà existant, on refuse)
    const exists = await userExists(email);
    if (exists) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Utilisateur déjà existant' } };
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    await createUser(email, {
      displayName: name || email,
      email: email,
      emailVerified: false,
      salt,
      passwordHash
    });

    // Générer code 6 chiffres (24h)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    await storeCode(email, verificationCode, expiresAt);

    // Envoyer email
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'SENDGRID_API_KEY non configuré' } };
      return;
    }

    sgMail.setApiKey(apiKey);
    const sender = process.env.SENDGRID_SENDER || 'noreply@axilum.ai';

    await sgMail.send({
      to: email,
      from: sender,
      subject: 'Votre code de vérification Axilum AI',
      text: `Bonjour ${name || 'utilisateur'},\n\nVotre code de vérification est: ${verificationCode}\n\nCe code expire dans 24 heures.`,
      html: `<p>Bonjour <strong>${name || 'utilisateur'}</strong>,</p><p>Votre code de vérification est:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;">${verificationCode}</p><p>Ce code expire dans 24 heures.</p>`
    });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { success: true, requiresVerification: true }
    };
  } catch (err) {
    context.log.error('auth-signup error', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message || String(err) } };
  }
};

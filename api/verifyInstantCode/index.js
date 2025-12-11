const { getCode, deleteCode } = require('../utils/codeStorage');
const { createUser, userExists } = require('../utils/userStorage');
const crypto = require('crypto');

function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
}

module.exports = async function (context, req) {
    context.log('🔑 Verify Instant Code triggered');

    try {
        const { username, code, password, displayName } = req.body || {};

        if (!username || !code) {
            context.res = { status: 400, body: JSON.stringify({ error: 'username et code requis' }) };
            return;
        }

        const stored = await getCode(username);
        if (!stored) {
            context.res = { status: 400, body: JSON.stringify({ verified: false, error: 'Aucun code en attente.' }) };
            return;
        }

        if (Date.now() > stored.expiresAt) {
            await deleteCode(username);
            context.res = { status: 400, body: JSON.stringify({ verified: false, error: 'Code expiré.' }) };
            return;
        }

        if (stored.code !== code) {
            context.res = { status: 400, body: JSON.stringify({ verified: false, error: 'Code incorrect.' }) };
            return;
        }

        // Prevent creating duplicate users
        const exists = await userExists(username);
        if (exists) {
            await deleteCode(username);
            context.res = { status: 400, body: JSON.stringify({ verified: false, error: 'Utilisateur déjà existant.' }) };
            return;
        }

        // If password provided, hash it
        let userData = { displayName: displayName || username };
        if (password) {
            const salt = crypto.randomBytes(16).toString('hex');
            userData.salt = salt;
            userData.passwordHash = hashPassword(password, salt);
        }

        await createUser(username, userData);
        await deleteCode(username);

        context.log(`✅ Utilisateur créé: ${username}`);

        context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verified: true, username }) };
    } catch (error) {
        context.log.error('Erreur verifyInstantCode', error);
        context.res = { status: 500, body: JSON.stringify({ error: 'Erreur interne' }) };
    }
};

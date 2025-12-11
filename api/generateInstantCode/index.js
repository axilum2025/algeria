const { storeCode } = require('../utils/codeStorage');
const { userExists } = require('../utils/userStorage');

module.exports = async function (context, req) {
    context.log('🔐 Generate Instant Code triggered');
    try {
        const { username, displayName } = req.body || {};

        if (!username) {
            context.res = { status: 400, body: JSON.stringify({ error: 'username requis' }) };
            return;
        }

        // Prevent creating code if user already exists
        const exists = await userExists(username);
        if (exists) {
            context.res = { status: 400, body: JSON.stringify({ error: 'Utilisateur déjà existant' }) };
            return;
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 15 * 60 * 1000;
        await storeCode(username, code, expiresAt);

        context.log(`Code généré pour ${username}: ${code}`);

        // Since the requirement is to show the code on the page (no email), we return it.
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, username, code, expiresAt })
        };
    } catch (error) {
        context.log.error('Erreur generateInstantCode', error);
        context.res = { status: 500, body: JSON.stringify({ error: 'Erreur interne' }) };
    }
};

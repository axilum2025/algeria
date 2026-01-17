const { getCode, deleteCode } = require('../utils/codeStorage');
const { createUser, userExists } = require('../utils/userStorage');
const crypto = require('crypto');
const { getClientIp, hashIdentifier, rateLimit } = require('../utils/clientRateLimit');

function getAdminKey(req) {
    return String((req.headers && (req.headers['x-admin-api-key'] || req.headers['X-Admin-Api-Key'])) || '').trim();
}

function isValidAdminKey(req) {
    const expected = String(process.env.ADMIN_API_KEY || '').trim();
    if (!expected) return false;
    return getAdminKey(req) === expected;
}

function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
}

module.exports = async function (context, req) {
    context.log('🔑 Verify Instant Code triggered');

    try {
        const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
        const enabled = String(process.env.INSTANT_CODE_ENABLED || '').trim() === '1';

        if (isProd && !enabled) {
            context.res = { status: 404, body: 'Not found' };
            return;
        }

        const requireAdminInProd = String(process.env.INSTANT_CODE_REQUIRE_ADMIN || '1').trim() === '1';
        if (isProd && requireAdminInProd && !isValidAdminKey(req)) {
            context.res = {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Unauthorized' })
            };
            return;
        }

        const { username, code, password, displayName } = req.body || {};

        if (!username || !code) {
            context.res = { status: 400, body: JSON.stringify({ error: 'username et code requis' }) };
            return;
        }

        // Best-effort rate limiting (per instance)
        const ipHash = hashIdentifier(getClientIp(req));
        const userKey = hashIdentifier(username);
        const rl1 = await rateLimit({ key: `verifyInstantCode:ip:${ipHash}`, limit: 10, windowMs: 60_000 });
        const rl2 = await rateLimit({ key: `verifyInstantCode:user:${userKey}`, limit: 10, windowMs: 10 * 60_000 });
        if (!rl1.allowed || !rl2.allowed) {
            const retryAfter = Math.max(rl1.retryAfterSeconds, rl2.retryAfterSeconds);
            context.res = {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': String(retryAfter)
                },
                body: JSON.stringify({ verified: false, error: 'Trop de tentatives. Réessayez plus tard.' })
            };
            return;
        }

        const stored = await getCode(username);
        if (!stored || Date.now() > stored.expiresAt || stored.code !== code) {
            if (stored && Date.now() > stored.expiresAt) {
                await deleteCode(username);
            }
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verified: false, error: 'Code invalide ou expiré.' })
            };
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

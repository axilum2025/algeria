const { storeCode } = require('../utils/codeStorage');
const { userExists } = require('../utils/userStorage');
const { getClientIp, hashIdentifier, rateLimit } = require('../utils/clientRateLimit');

function getAdminKey(req) {
    return String((req.headers && (req.headers['x-admin-api-key'] || req.headers['X-Admin-Api-Key'])) || '').trim();
}

function isValidAdminKey(req) {
    const expected = String(process.env.ADMIN_API_KEY || '').trim();
    if (!expected) return false;
    return getAdminKey(req) === expected;
}

module.exports = async function (context, req) {
    context.log('🔐 Generate Instant Code triggered');
    try {
        const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
        const enabled = String(process.env.INSTANT_CODE_ENABLED || '').trim() === '1';

        if (isProd && !enabled) {
            context.res = { status: 404, body: 'Not found' };
            return;
        }

        // In prod, this endpoint is dangerous (it returns the code). Require ADMIN_API_KEY by default.
        const requireAdminInProd = String(process.env.INSTANT_CODE_REQUIRE_ADMIN || '1').trim() === '1';
        if (isProd && requireAdminInProd && !isValidAdminKey(req)) {
            context.res = {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Unauthorized' })
            };
            return;
        }

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

        // Best-effort rate limiting (per instance)
        const ipHash = hashIdentifier(getClientIp(req));
        const userKey = hashIdentifier(username);
        const rl1 = await rateLimit({ key: `generateInstantCode:ip:${ipHash}`, limit: 5, windowMs: 60_000 });
        const rl2 = await rateLimit({ key: `generateInstantCode:user:${userKey}`, limit: 3, windowMs: 60_000 });
        if (!rl1.allowed || !rl2.allowed) {
            const retryAfter = Math.max(rl1.retryAfterSeconds, rl2.retryAfterSeconds);
            context.res = {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': String(retryAfter)
                },
                body: JSON.stringify({ error: 'Trop de tentatives. Réessayez plus tard.' })
            };
            return;
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 15 * 60 * 1000;
        await storeCode(username, code, expiresAt);

        context.log(`Code généré pour ${username}`);

        // Since the requirement is to show the code on the page (no email), we return it.
        // In production this endpoint should remain disabled, or admin-only.
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

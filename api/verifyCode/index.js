const { getCode, deleteCode } = require('../utils/codeStorage');
const { getClientIp, hashIdentifier, rateLimit } = require('../utils/clientRateLimit');

module.exports = async function (context, req) {
    context.log('🔑 Verify Code function triggered');

    try {
        const { email, code } = req.body;

        if (!email || !code) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Email et code requis' })
            };
            return;
        }

        // Best-effort rate limiting (per instance)
        const ipHash = hashIdentifier(getClientIp(req));
        const emailKey = hashIdentifier(email);
        const rl1 = await rateLimit({ key: `verifyCode:ip:${ipHash}`, limit: 20, windowMs: 60_000 });
        const rl2 = await rateLimit({ key: `verifyCode:email:${emailKey}`, limit: 10, windowMs: 10 * 60_000 });
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

        const storedData = await getCode(email);

        const isValid = Boolean(storedData) && Date.now() <= storedData.expiresAt && storedData.code === code;
        if (!isValid) {
            if (storedData && Date.now() > storedData.expiresAt) {
                await deleteCode(email);
            }
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verified: false, error: 'Code invalide ou expiré.' })
            };
            return;
        }

        await deleteCode(email);
        context.log(`✅ Code vérifié avec succès pour ${email}`);
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verified: true, message: 'Email vérifié avec succès !' })
        };
        return;

    } catch (error) {
        context.log.error('❌ Erreur lors de la vérification du code:', error);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Erreur interne du serveur.' })
        };
    }
};

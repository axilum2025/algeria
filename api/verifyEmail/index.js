/**
 * Vérifier un token d'email et marquer l'email comme vérifié
 */

const { getCode, deleteCode } = require('../utils/codeStorage');
const { getUserByEmail, updateUser } = require('../utils/userStorage');
const { getClientIp, hashIdentifier, rateLimit } = require('../utils/clientRateLimit');

module.exports = async function (context, req) {
    context.log('🔐 Verify Email function triggered');
    
    try {
        const { token } = req.query || req.body;
        
        if (!token) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: 'Token requis',
                    success: false
                })
            };
            return;
        }

        // Best-effort rate limiting (per instance)
        const ipHash = hashIdentifier(getClientIp(req));
        const tokenKey = hashIdentifier(token);
        const rl1 = await rateLimit({ key: `verifyEmail:ip:${ipHash}`, limit: 30, windowMs: 60_000 });
        const rl2 = await rateLimit({ key: `verifyEmail:token:${tokenKey}`, limit: 10, windowMs: 10 * 60_000 });
        if (!rl1.allowed || !rl2.allowed) {
            const retryAfter = Math.max(rl1.retryAfterSeconds, rl2.retryAfterSeconds);
            context.res = {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': String(retryAfter)
                },
                body: JSON.stringify({
                    error: 'Trop de tentatives. Réessayez plus tard.',
                    success: false
                })
            };
            return;
        }
        
        // Récupérer le token depuis Azure Storage
        const tokenData = await getCode(token);
        
        if (!tokenData) {
            context.log.warn(`⚠️ Token invalide (hash): ${hashIdentifier(token)}`);
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: 'Token invalide ou expiré',
                    success: false
                })
            };
            return;
        }
        
        // Vérifier l'expiration
        const now = Date.now();
        if (tokenData.expiresAt < now) {
            context.log.warn(`⚠️ Token expiré (hash): ${hashIdentifier(token)}`);
            await deleteCode(token);
            
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: 'Lien de vérification expiré',
                    success: false
                })
            };
            return;
        }
        
        // Token valide - email associé au token est stocké dans tokenData.code
        const email = tokenData.code;

        // Marquer l'email comme vérifié (sans créer d'utilisateur fantôme)
        const user = await getUserByEmail(email);
        if (user) {
            await updateUser(String(email).toLowerCase(), {
                emailVerified: true,
                emailVerifiedAt: new Date()
            });
            context.log(`✅ Email vérifié: ${email}`);
        } else {
            context.log.warn(`⚠️ Email vérifié mais utilisateur introuvable: ${email}`);
        }

        // Supprimer le token
        await deleteCode(token);
        
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true,
                message: 'Email vérifié avec succès !'
            })
        };
        
    } catch (error) {
        context.log.error('❌ Erreur vérification email:', error);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: 'Erreur lors de la vérification',
                success: false
            })
        };
    }
};

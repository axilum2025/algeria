const { getCode, deleteCode } = require('../utils/codeStorage');

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

        const storedData = await getCode(email);

        if (!storedData) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verified: false, error: 'Aucun code en attente pour cet email.' })
            };
            return;
        }

        // Vérifier si le code a expiré
        if (Date.now() > storedData.expiresAt) {
            await deleteCode(email); // Nettoyer le code expiré
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verified: false, error: 'Le code de vérification a expiré.' })
            };
            return;
        }

        // Vérifier si le code correspond
        if (storedData.code === code) {
            await deleteCode(email); // Le code a été utilisé, on le supprime
            context.log(`✅ Code vérifié avec succès pour ${email}`);
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verified: true, message: 'Email vérifié avec succès !' })
            };
            return;
        } else {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verified: false, error: 'Code de vérification incorrect.' })
            };
            return;
        }

    } catch (error) {
        context.log.error('❌ Erreur lors de la vérification du code:', error);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Erreur interne du serveur.' })
        };
    }
};

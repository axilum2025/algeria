// API: Gestion des paramètres entreprise Finance
const financeStorage = require('../utils/financeStorage');

module.exports = async function (context, req) {
    context.log('⚙️ Finance Settings API');

    context.res = {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    };

    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    try {
        await financeStorage.initialize();

        const userId = extractUserId(req);
        if (!userId) {
            context.res.status = 401;
            context.res.body = { error: 'Utilisateur non authentifié' };
            return;
        }

        if (req.method === 'GET') {
            // Récupérer les paramètres
            const settings = await financeStorage.getSettings(userId);
            context.res.status = 200;
            context.res.body = { success: true, settings: settings || {} };
        } 
        else if (req.method === 'POST') {
            // Sauvegarder les paramètres
            const { settings } = req.body;
            if (!settings) {
                context.res.status = 400;
                context.res.body = { error: 'settings requis' };
                return;
            }

            await financeStorage.saveSettings(userId, settings);
            context.res.status = 200;
            context.res.body = { success: true };
        }
        else {
            context.res.status = 405;
            context.res.body = { error: 'Méthode non supportée' };
        }

    } catch (error) {
        context.log.error('Erreur Finance Settings:', error);
        context.res.status = 500;
        context.res.body = { error: error.message };
    }
};

function extractUserId(req) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    if (req.body && req.body.userId) {
        return req.body.userId;
    }
    return null;
}

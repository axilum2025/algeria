// API: Gestion des paramètres entreprise Finance
const financeStorage = require('../utils/financeStorage');
const { getAuthEmail, setCors } = require('../utils/auth');

module.exports = async function (context, req) {
    context.log('⚙️ Finance Settings API');

    setCors(context, 'GET, POST, OPTIONS');
    context.res.headers['Content-Type'] = 'application/json';

    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    try {
        await financeStorage.initialize();

        // Extraire userId depuis le JWT vérifié (email comme clé)
        const userId = getAuthEmail(req);
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

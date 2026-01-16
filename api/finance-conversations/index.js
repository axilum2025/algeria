// API: Gestion des conversations Finance (avec isolation par utilisateur)
const financeStorage = require('../utils/financeStorage');
const { getAuthEmail, setCors } = require('../utils/auth');

module.exports = async function (context, req) {
    context.log('📊 Finance Conversations API');

    // CORS
    setCors(context, 'GET, POST, PUT, DELETE, OPTIONS');
    context.res.headers['Content-Type'] = 'application/json';

    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    try {
        // Initialiser le storage
        await financeStorage.initialize();

        // Extraire userId depuis le JWT vérifié (email comme clé)
        const userId = getAuthEmail(req);
        if (!userId) {
            context.res.status = 401;
            context.res.body = { error: 'Utilisateur non authentifié' };
            return;
        }

        const method = req.method;
        const { conversationId, data } = req.body || {};

        switch (method) {
            case 'GET':
                // Liste des conversations de l'utilisateur
                const conversations = await financeStorage.listConversations(userId);
                context.res.status = 200;
                context.res.body = { success: true, conversations };
                break;

            case 'POST':
                // Sauvegarder/Mettre à jour une conversation
                if (!conversationId || !data) {
                    context.res.status = 400;
                    context.res.body = { error: 'conversationId et data requis' };
                    return;
                }

                await financeStorage.saveConversation(userId, conversationId, data);
                context.res.status = 200;
                context.res.body = { success: true, conversationId };
                break;

            case 'DELETE':
                // Supprimer une conversation
                if (!conversationId) {
                    context.res.status = 400;
                    context.res.body = { error: 'conversationId requis' };
                    return;
                }

                await financeStorage.deleteConversation(userId, conversationId);
                context.res.status = 200;
                context.res.body = { success: true };
                break;

            default:
                context.res.status = 405;
                context.res.body = { error: 'Méthode non supportée' };
        }

    } catch (error) {
        context.log.error('Erreur Finance Conversations:', error);
        context.res.status = 500;
        context.res.body = { error: error.message };
    }
};

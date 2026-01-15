// API: Gestion des conversations Finance (avec isolation par utilisateur)
const financeStorage = require('../utils/financeStorage');

module.exports = async function (context, req) {
    context.log('📊 Finance Conversations API');

    // CORS
    context.res = {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    };

    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    try {
        // Initialiser le storage
        await financeStorage.initialize();

        // Extraire userId depuis le header Authorization ou body
        const userId = extractUserId(req);
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

function extractUserId(req) {
    // Option 1: Depuis le header Authorization (JWT token)
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.substring(7);
            // TODO: Décoder le JWT pour extraire userId
            // const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // return decoded.userId;
            
            // Pour l'instant, retourner un userId de test
            // Remplacer par vrai décodage JWT
            return token; // Temporaire
        } catch (error) {
            console.error('Erreur décodage token:', error);
        }
    }

    // Option 2: Depuis le body (temporaire pour développement)
    if (req.body && req.body.userId) {
        return req.body.userId;
    }

    // Option 3: Depuis cookie/session
    // const session = req.headers['cookie'];
    // return extractUserIdFromSession(session);

    return null;
}

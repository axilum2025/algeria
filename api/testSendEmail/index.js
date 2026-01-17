/**
 * Test endpoint pour vérifier l'envoi d'email
 */

const { getAuthEmail } = require('../utils/auth');
const { getRoles } = require('../utils/userStorage');

function corsJsonHeaders(extra = {}) {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
        ...extra
    };
}

function readAdminKey(req) {
    const raw = req.headers?.['x-admin-key'] || req.headers?.['X-Admin-Key'] || '';
    return String(Array.isArray(raw) ? raw[0] : raw).trim();
}

function hasValidAdminKey(req) {
    const expected = String(process.env.ADMIN_API_KEY || '').trim();
    if (!expected) return false;
    const got = readAdminKey(req);
    return Boolean(got && got === expected);
}

async function isAdminEmail(email) {
    if (!email) return false;
    const roles = await getRoles(String(email).toLowerCase()).catch(() => []);
    return Array.isArray(roles) && roles.includes('admin');
}

module.exports = async function (context, req) {
    context.log('🧪 Test Send Email triggered');

    if (String(req.method || '').toUpperCase() === 'OPTIONS') {
        context.res = { status: 204, headers: corsJsonHeaders(), body: '' };
        return;
    }

    const enabled = String(process.env.TEST_SEND_EMAIL_ENABLED || '').trim() === '1';
    if (process.env.NODE_ENV === 'production' && !enabled) {
        context.res = {
            status: 404,
            headers: corsJsonHeaders(),
            body: JSON.stringify({ error: 'Not found' })
        };
        return;
    }

    const adminKeyOk = hasValidAdminKey(req);
    const emailAuth = getAuthEmail(req);
    if (!adminKeyOk) {
        const admin = await isAdminEmail(emailAuth);
        if (!admin) {
            context.res = {
                status: emailAuth ? 403 : 401,
                headers: corsJsonHeaders(),
                body: JSON.stringify({ error: emailAuth ? 'Non autorisé' : 'Non authentifié' })
            };
            return;
        }
    }
    
    try {
        const email = String(req.query.email || 'test@example.com').trim().toLowerCase();
        const name = String(req.query.name || 'Test User').trim().slice(0, 80);
        
        context.log(`📧 Test d'envoi d'email à ${email}`);
        
        // Vérifier les variables d'environnement
        const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
        const sender = process.env.AZURE_COMMUNICATION_SENDER;
        
        if (!connectionString) {
            context.res = {
                status: 500,
                body: JSON.stringify({
                    error: 'AZURE_COMMUNICATION_CONNECTION_STRING non configuré',
                    hasConnection: false,
                    hasSender: !!sender
                })
            };
            return;
        }
        
        // Importer le client
        const { EmailClient } = require("@azure/communication-email");
        const client = new EmailClient(connectionString);
        
        const emailMessage = {
            senderAddress: sender || "DoNotReply@azurecomm.net",
            content: {
                subject: "Test Email - Axilum AI",
                plainText: `Bonjour ${name},\n\nCeci est un email de test.\n\nSi vous recevez cet email, l'envoi fonctionne!`,
                html: `<h1>Test Email</h1><p>Bonjour ${name},</p><p>Si vous recevez cet email, l'envoi fonctionne!</p>`
            },
            recipients: {
                to: [{ address: email }]
            }
        };
        
        context.log('📤 Envoi en cours...');
        
        const poller = await client.beginSend(emailMessage);
        context.log(`⏳ Email ID: ${poller.getOperationState().id}`);
        
        // Attendre 30 secondes max
        const result = await Promise.race([
            poller.pollUntilDone(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
        ]);
        
        context.log(`✅ Email envoyé: ${result.status}`);
        
        context.res = {
            status: 200,
            headers: corsJsonHeaders(),
            body: JSON.stringify({
                success: true,
                message: 'Email envoyé avec succès',
                email: email,
                result: result
            })
        };
        
    } catch (error) {
        context.log.error('❌ Erreur:', error.message);
        context.res = {
            status: 500,
            headers: corsJsonHeaders(),
            body: JSON.stringify({
                error: error.message,
                stack: error.stack
            })
        };
    }
};

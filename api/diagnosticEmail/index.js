/**
 * Fonction de diagnostic pour vérifier la configuration email
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
    context.log('🔍 Diagnostic Email function triggered');

    if (String(req.method || '').toUpperCase() === 'OPTIONS') {
        context.res = { status: 204, headers: corsJsonHeaders(), body: '' };
        return;
    }

    const enabled = String(process.env.DIAGNOSTIC_EMAIL_ENABLED || '').trim() === '1';
    if (process.env.NODE_ENV === 'production' && !enabled) {
        context.res = { status: 404, headers: corsJsonHeaders(), body: JSON.stringify({ error: 'Not found' }) };
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
    
    const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: {},
        packages: {},
        test: {}
    };
    
    try {
        // 1. Vérifier les variables d'environnement
        diagnostics.environment = {
            AZURE_COMMUNICATION_CONNECTION_STRING: !!process.env.AZURE_COMMUNICATION_CONNECTION_STRING,
            AZURE_COMMUNICATION_SENDER: process.env.AZURE_COMMUNICATION_SENDER || 'NOT_SET',
            AZURE_STORAGE_CONNECTION_STRING: !!process.env.AZURE_STORAGE_CONNECTION_STRING,
            NODE_VERSION: process.version,
            NODE_ENV: process.env.NODE_ENV || 'development'
        };
        
        // 2. Vérifier les packages installés
        try {
            const emailPackage = require('@azure/communication-email');
            diagnostics.packages.azureCommunicationEmail = '✅ Installé';
        } catch (e) {
            diagnostics.packages.azureCommunicationEmail = '❌ NON INSTALLÉ: ' + e.message;
        }
        
        try {
            const tablesPackage = require('@azure/data-tables');
            diagnostics.packages.azureDataTables = '✅ Installé';
        } catch (e) {
            diagnostics.packages.azureDataTables = '❌ NON INSTALLÉ: ' + e.message;
        }
        
        // 3. Test de connexion email (si configuré)
        if (process.env.AZURE_COMMUNICATION_CONNECTION_STRING) {
            try {
                const { EmailClient } = require("@azure/communication-email");
                const client = new EmailClient(process.env.AZURE_COMMUNICATION_CONNECTION_STRING);
                diagnostics.test.emailClient = '✅ Client créé avec succès';
                
                // Test simple (ne pas vraiment envoyer d'email)
                diagnostics.test.connectionString = '✅ Format valide';
                
            } catch (e) {
                diagnostics.test.emailClient = '❌ Erreur: ' + e.message;
            }
        } else {
            diagnostics.test.emailClient = '⚠️ Variable AZURE_COMMUNICATION_CONNECTION_STRING non configurée';
        }
        
        // 4. Résumé
        const allVarsSet = diagnostics.environment.AZURE_COMMUNICATION_CONNECTION_STRING;
        const packagesOk = diagnostics.packages.azureCommunicationEmail.includes('✅');
        
        diagnostics.summary = {
            ready: allVarsSet && packagesOk,
            status: allVarsSet && packagesOk ? '✅ PRÊT' : '❌ CONFIGURATION INCOMPLÈTE',
            issues: []
        };
        
        if (!allVarsSet) {
            diagnostics.summary.issues.push('Variables d\'environnement manquantes');
        }
        if (!packagesOk) {
            diagnostics.summary.issues.push('Package @azure/communication-email non installé');
        }
        
        context.res = {
            status: 200,
            headers: { 
                ...corsJsonHeaders()
            },
            body: JSON.stringify(diagnostics, null, 2)
        };
        
    } catch (error) {
        context.log.error('❌ Erreur diagnostic:', error);
        
        context.res = {
            status: 500,
            headers: corsJsonHeaders(),
            body: JSON.stringify({
                error: 'Erreur lors du diagnostic',
                message: error.message,
                stack: error.stack
            }, null, 2)
        };
    }
};

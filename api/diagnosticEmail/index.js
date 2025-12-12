/**
 * Fonction de diagnostic pour vérifier la configuration email
 */

module.exports = async function (context, req) {
    context.log('🔍 Diagnostic Email function triggered');
    
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
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(diagnostics, null, 2)
        };
        
    } catch (error) {
        context.log.error('❌ Erreur diagnostic:', error);
        
        context.res = {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Erreur lors du diagnostic',
                message: error.message,
                stack: error.stack
            }, null, 2)
        };
    }
};

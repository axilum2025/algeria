/**
 * Test script pour vérifier l'envoi d'email
 */

// Simuler le contexte Azure Functions
const context = {
    log: (...args) => console.log(...args),
    res: null
};
context.log.warn = console.warn;
context.log.error = console.error;

// Simuler une requête
const req = {
    body: {
        email: 'test@example.com',
        name: 'Test User'
    }
};

// Charger les variables d'environnement (optionnel, utilise variables système si disponibles)
try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) {
    // dotenv non installé, pas grave
}

console.log('\n🔍 Vérification de la configuration email...\n');

// Vérifier les variables d'environnement
console.log('📋 Variables d\'environnement:');
console.log('  AZURE_COMMUNICATION_CONNECTION_STRING:', process.env.AZURE_COMMUNICATION_CONNECTION_STRING ? '✅ Configuré' : '❌ Manquant');
console.log('  AZURE_COMMUNICATION_SENDER:', process.env.AZURE_COMMUNICATION_SENDER || '❌ Non défini (utilisera DoNotReply@azurecomm.net)');
console.log('  AZURE_STORAGE_CONNECTION_STRING:', process.env.AZURE_STORAGE_CONNECTION_STRING ? '✅ Configuré' : '❌ Manquant');
console.log('  SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? '✅ Configuré' : '❌ Manquant');

console.log('\n🧪 Test de l\'envoi d\'email...\n');

// Charger la fonction
const sendVerificationEmail = require('./sendVerificationEmail/index');

// Exécuter le test
sendVerificationEmail(context, req)
    .then(() => {
        console.log('\n✅ Résultat:');
        console.log('  Status:', context.res.status);
        console.log('  Body:', JSON.parse(context.res.body));
    })
    .catch(err => {
        console.error('\n❌ Erreur:', err);
    });

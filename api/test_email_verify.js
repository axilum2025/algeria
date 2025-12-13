/**
 * Test l'envoi d'email de vérification
 */

const sendEmailFunction = require('./sendVerificationEmail/index.js');

// Mock context
const context = {
    log: (...args) => console.log('📝', ...args),
    res: null
};

context.log.warn = (...args) => console.warn('⚠️', ...args);
context.log.error = (...args) => console.error('❌', ...args);

// Mock request
const req = {
    body: {
        email: 'test@example.com',
        name: 'Test User',
        token: 'test-token-12345',
        verifyLink: 'https://example.com/verify?token=test-token-12345',
        isVerificationLink: true
    }
};

async function testEmailSending() {
    console.log('🧪 Test envoi d\'email de vérification...\n');
    
    try {
        await sendEmailFunction(context, req);
        
        console.log('\n📋 Résultat:');
        console.log('Status:', context.res?.status);
        console.log('Body:', JSON.parse(context.res?.body || '{}'));
        
        if (context.res?.status === 200) {
            console.log('\n✅ TEST RÉUSSI');
        } else {
            console.log('\n❌ TEST ÉCHOUÉ');
        }
    } catch (error) {
        console.error('\n❌ ERREUR:', error.message);
        console.error('Stack:', error.stack);
    }
}

testEmailSending();

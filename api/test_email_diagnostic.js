/**
 * 🔍 DIAGNOSTIC COMPLET - Envoi d'email de vérification
 * Ce script teste toutes les étapes d'envoi d'email
 */

const sgMail = require('@sendgrid/mail');

console.log('\n🔍 ========== DIAGNOSTIC EMAIL DE VÉRIFICATION ==========\n');

// Étape 1: Vérifier les variables d'environnement
console.log('📋 ÉTAPE 1: Vérification des variables d\'environnement');
console.log('------------------------------------------------------');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_SENDER = process.env.SENDGRID_SENDER;

if (!SENDGRID_API_KEY) {
    console.log('❌ SENDGRID_API_KEY: NON CONFIGURÉE');
    console.log('   → Ajoutez-la dans api/local.settings.json');
    console.log('   → Ou dans les variables d\'environnement Azure');
    process.exit(1);
} else {
    const keyPreview = SENDGRID_API_KEY.substring(0, 10) + '...' + SENDGRID_API_KEY.substring(SENDGRID_API_KEY.length - 4);
    console.log(`✅ SENDGRID_API_KEY: ${keyPreview}`);
}

if (!SENDGRID_SENDER) {
    console.log('⚠️  SENDGRID_SENDER: NON CONFIGURÉE (utilisera noreply@axilum.ai par défaut)');
} else {
    console.log(`✅ SENDGRID_SENDER: ${SENDGRID_SENDER}`);
}

// Étape 2: Configurer SendGrid
console.log('\n📋 ÉTAPE 2: Configuration de SendGrid');
console.log('------------------------------------------------------');

try {
    sgMail.setApiKey(SENDGRID_API_KEY);
    console.log('✅ SendGrid API configurée avec succès');
} catch (error) {
    console.log('❌ Erreur lors de la configuration SendGrid:', error.message);
    process.exit(1);
}

// Étape 3: Préparer l'email de test
console.log('\n📋 ÉTAPE 3: Préparation de l\'email de test');
console.log('------------------------------------------------------');

const TEST_EMAIL = process.argv[2] || 'test@example.com';
const TEST_NAME = 'Utilisateur Test';
const TEST_CODE = Math.floor(100000 + Math.random() * 900000).toString();

console.log(`📧 Destinataire: ${TEST_EMAIL}`);
console.log(`👤 Nom: ${TEST_NAME}`);
console.log(`🔑 Code: ${TEST_CODE}`);
console.log(`📤 Expéditeur: ${SENDGRID_SENDER || 'noreply@axilum.ai'}`);

const emailMessage = {
    to: TEST_EMAIL,
    from: SENDGRID_SENDER || 'noreply@axilum.ai',
    subject: '[TEST] Votre code de vérification Axilum AI',
    text: `Bonjour ${TEST_NAME},\n\nCeci est un EMAIL DE TEST.\n\nVotre code de vérification est:\n\n${TEST_CODE}\n\nCe code expire dans 24 heures.\n\nCordialement,\nL'équipe Axilum AI`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .code-box { text-align: center; margin: 40px 0; font-size: 48px; font-weight: bold; letter-spacing: 8px; color: #667eea; background: white; padding: 20px; border-radius: 10px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🤖 Axilum AI - TEST</h1>
                    <p>Email de vérification (TEST)</p>
                </div>
                <div class="content">
                    <p><strong style="color: #ff6b6b;">⚠️ CECI EST UN EMAIL DE TEST</strong></p>
                    <p>Bonjour <strong>${TEST_NAME}</strong>,</p>
                    <p>Votre code de vérification est :</p>
                    
                    <div class="code-box">
                        ${TEST_CODE}
                    </div>
                    
                    <p style="text-align: center; color: #666;">Entrez ce code dans l'application</p>
                    <p style="color: #ff6b6b;">⏰ Ce code expire dans 24 heures.</p>
                    
                    <p style="margin-top: 30px;">Cordialement,<br><strong>L'équipe Axilum AI</strong></p>
                </div>
                <div class="footer">
                    <p>AI Solutions Hub® - support@solutionshub.uk</p>
                </div>
            </div>
        </body>
        </html>
    `
};

// Étape 4: Vérifier la structure de l'email
console.log('\n📋 ÉTAPE 4: Vérification de la structure de l\'email');
console.log('------------------------------------------------------');

const requiredFields = ['to', 'from', 'subject', 'text', 'html'];
let structureValid = true;

requiredFields.forEach(field => {
    if (emailMessage[field]) {
        console.log(`✅ ${field}: OK`);
    } else {
        console.log(`❌ ${field}: MANQUANT`);
        structureValid = false;
    }
});

if (!structureValid) {
    console.log('\n❌ Structure d\'email invalide');
    process.exit(1);
}

// Étape 5: Envoi de l'email
console.log('\n📋 ÉTAPE 5: Envoi de l\'email');
console.log('------------------------------------------------------');
console.log('📤 Envoi en cours...');

sgMail
    .send(emailMessage)
    .then(() => {
        console.log('\n✅ ========== EMAIL ENVOYÉ AVEC SUCCÈS ==========');
        console.log(`📧 Vérifiez la boîte email: ${TEST_EMAIL}`);
        console.log(`🔑 Code de vérification: ${TEST_CODE}`);
        console.log('\n📝 Points à vérifier:');
        console.log('   1. Vérifiez votre boîte de réception');
        console.log('   2. Vérifiez vos spams/courrier indésirable');
        console.log('   3. Vérifiez que l\'expéditeur est autorisé dans SendGrid');
        console.log('   4. Vérifiez le statut dans le dashboard SendGrid');
        console.log('\n💡 Si vous ne recevez pas l\'email:');
        console.log('   → Vérifiez que l\'email expéditeur est vérifié dans SendGrid');
        console.log('   → Vérifiez les logs dans SendGrid Activity Feed');
        console.log('   → Essayez avec un autre email destinataire');
        process.exit(0);
    })
    .catch((error) => {
        console.log('\n❌ ========== ERREUR D\'ENVOI ==========');
        console.log('Message:', error.message);
        
        if (error.response) {
            console.log('\n📋 Détails de l\'erreur SendGrid:');
            console.log(JSON.stringify(error.response.body, null, 2));
            
            const errors = error.response.body.errors;
            if (errors && errors.length > 0) {
                console.log('\n🔍 Problèmes identifiés:');
                errors.forEach((err, i) => {
                    console.log(`   ${i + 1}. ${err.message}`);
                    if (err.field) console.log(`      Champ: ${err.field}`);
                    if (err.help) console.log(`      Aide: ${err.help}`);
                });
            }
        }
        
        console.log('\n💡 Solutions possibles:');
        console.log('   1. Vérifiez que la clé API SendGrid est valide');
        console.log('   2. Vérifiez que l\'email expéditeur est vérifié dans SendGrid');
        console.log('   3. Vérifiez que votre compte SendGrid est actif');
        console.log('   4. Vérifiez les permissions de la clé API');
        
        process.exit(1);
    });

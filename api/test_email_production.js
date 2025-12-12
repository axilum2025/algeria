/**
 * Test script pour vérifier l'envoi d'email avec les vraies credentials
 * À utiliser en local pour tester avant de déployer en production
 */

const { EmailClient } = require("@azure/communication-email");

// IMPORTANT: Ne pas commiter ce fichier avec vos vraies credentials!
// Utilisez des variables d'environnement en production

// Vos credentials Azure Communication Services (à remplacer par vos valeurs)
const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING || "REMPLACER_PAR_VOTRE_CONNECTION_STRING";
const senderAddress = process.env.AZURE_COMMUNICATION_SENDER || "DoNotReply@VOTRE-DOMAINE.azurecomm.net";

// Email de test (changez avec votre email)
const recipientEmail = process.env.TEST_EMAIL || "votre-email@example.com";

console.log('🧪 Test d\'envoi d\'email avec Azure Communication Services\n');

async function testEmailSending() {
    try {
        const client = new EmailClient(connectionString);
        
        // Générer un code de vérification
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        console.log('📧 Préparation de l\'email...');
        console.log(`   Destinataire: ${recipientEmail}`);
        console.log(`   Expéditeur: ${senderAddress}`);
        console.log(`   Code: ${verificationCode}\n`);
        
        const emailMessage = {
            senderAddress: senderAddress,
            content: {
                subject: "Code de vérification Axilum AI - Test",
                plainText: `Bonjour,\n\nVotre code de vérification est : ${verificationCode}\n\nCe code expire dans 15 minutes.\n\nCeci est un email de test.\n\nCordialement,\nL'équipe Axilum AI`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                            .code-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
                            .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: monospace; }
                            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                            .badge { background: #ffc107; color: #000; padding: 5px 10px; border-radius: 5px; font-size: 12px; font-weight: bold; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>🤖 Axilum AI</h1>
                                <p>Vérification de votre compte</p>
                                <span class="badge">TEST</span>
                            </div>
                            <div class="content">
                                <p>Bonjour,</p>
                                <p>Merci de vous être inscrit sur Axilum AI ! Pour finaliser la création de votre compte, veuillez utiliser le code de vérification ci-dessous :</p>
                                <div class="code-box">
                                    <div class="code">${verificationCode}</div>
                                </div>
                                <p><strong>⏰ Ce code expire dans 15 minutes.</strong></p>
                                <p style="color: #ffc107;">⚠️ <em>Ceci est un email de test pour vérifier la configuration.</em></p>
                                <p>Si vous n'avez pas demandé ce code, vous pouvez ignorer cet email en toute sécurité.</p>
                                <p>Cordialement,<br>L'équipe Axilum AI</p>
                            </div>
                            <div class="footer">
                                <p>AI Solutions Hub® - support@solutionshub.uk</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            },
            recipients: {
                to: [{ address: recipientEmail }]
            }
        };
        
        console.log('📤 Envoi en cours...\n');
        
        const poller = await client.beginSend(emailMessage);
        const result = await poller.pollUntilDone();
        
        console.log('✅ Email envoyé avec succès!\n');
        console.log('📊 Résultat:');
        console.log('   ID:', result.id);
        console.log('   Status:', result.status);
        console.log('\n📬 Vérifiez votre boîte email:', recipientEmail);
        console.log('   (Vérifiez aussi le dossier spam si vous ne le voyez pas)\n');
        
        return result;
        
    } catch (error) {
        console.error('\n❌ Erreur lors de l\'envoi de l\'email:\n');
        console.error('   Message:', error.message);
        console.error('\n   Détails complets:', error);
        
        console.log('\n🔍 Vérifications:');
        console.log('   1. La connection string est-elle correcte?');
        console.log('   2. L\'adresse d\'expéditeur est-elle vérifiée dans Azure?');
        console.log('   3. Avez-vous les permissions nécessaires?');
        
        throw error;
    }
}

// Exécuter le test
testEmailSending()
    .then(() => {
        console.log('\n✨ Test terminé avec succès!');
        console.log('\n📋 Prochaines étapes:');
        console.log('   1. ✅ Configurez les mêmes variables dans Azure Static Web Apps');
        console.log('   2. ✅ Attendez 2-3 minutes le redémarrage');
        console.log('   3. ✅ Testez la création de compte sur le site');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n💥 Test échoué!');
        process.exit(1);
    });

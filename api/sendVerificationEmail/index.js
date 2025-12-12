/**
 * Azure Function - Send Verification Email
 * Envoie un code de vérification à 6 chiffres par email
 */

const { storeCode } = require('../utils/codeStorage');

module.exports = async function (context, req) {
    context.log('📧 Send Verification Email function triggered');
    
    try {
        const { email, name } = req.body;
        
        if (!email) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Email requis' })
            };
            return;
        }
        
        // Générer code de vérification à 6 chiffres
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Stocker le code avec une expiration
        const expiresAt = Date.now() + 15 * 60 * 1000; // Expire dans 15 minutes
        await storeCode(email, verificationCode, expiresAt);
        
        context.log(`✅ Code généré et stocké pour ${email}: ${verificationCode}`);
        
        // Retourner immédiatement la réponse - l'email sera envoyé en arrière-plan
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Code de vérification envoyé par email'
            })
        };
        
        // ========== Envoi d'email en arrière-plan (non-bloquant) ==========
        const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
        
        if (!connectionString) {
            context.log.warn('⚠️ AZURE_COMMUNICATION_CONNECTION_STRING non configuré - Code stocké uniquement');
            return;
        }
        
        // Envoyer l'email de manière complètement asynchrone
        setImmediate(async () => {
            try {
                const { EmailClient } = require("@azure/communication-email");
                const client = new EmailClient(connectionString);
                const senderAddress = process.env.AZURE_COMMUNICATION_SENDER || "DoNotReply@azurecomm.net";
                
                const emailMessage = {
                    senderAddress: senderAddress,
                    content: {
                        subject: "Code de vérification Axilum AI",
                        plainText: `Bonjour ${name || 'utilisateur'},\n\nVotre code de vérification est : ${verificationCode}\n\nCe code expire dans 15 minutes.\n\nSi vous n'avez pas demandé ce code, ignorez cet email.\n\nCordialement,\nL'équipe Axilum AI`,
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
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>🤖 Axilum AI</h1>
                                <p>Vérification de votre compte</p>
                            </div>
                            <div class="content">
                                <p>Bonjour <strong>${name || 'utilisateur'}</strong>,</p>
                                <p>Merci de vous être inscrit sur Axilum AI ! Pour finaliser la création de votre compte, veuillez utiliser le code de vérification ci-dessous :</p>
                                <div class="code-box">
                                    <div class="code">${verificationCode}</div>
                                </div>
                                <p><strong>⏰ Ce code expire dans 15 minutes.</strong></p>
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
                        to: [{ address: email }]
                    }
                };
                
                context.log(`📤 Tentative d'envoi d'email à ${email}...`);
                
                const poller = await client.beginSend(emailMessage);
                context.log(`✅ Email démarré (ID: ${poller.getOperationState().id})`);
                
                // Attendre en arrière-plan
                const result = await poller.pollUntilDone();
                context.log(`✅ Email envoyé avec succès à ${email}:`, result.status);
                
            } catch (emailError) {
                context.log.error(`❌ Erreur lors de l'envoi d'email en arrière-plan:`, emailError.message);
            }
        });
        
    } catch (error) {
        context.log.error('❌ Erreur envoi email:', error);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: 'Erreur lors de l\'envoi de l\'email',
                details: error.message 
            })
        };
    }
};

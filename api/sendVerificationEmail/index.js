/**
 * Azure Function - Send Verification Email
 * Utilise SendGrid pour envoyer le code de vérification à 6 chiffres
 */

const sgMail = require('@sendgrid/mail');
const { storeCode } = require('../utils/codeStorage');

module.exports = async function (context, req) {
    context.log('📧 Send Verification Email function triggered');
    
    try {
        const { email, name, verificationCode } = req.body;
        
        if (!email) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Email requis' })
            };
            return;
        }
        
        if (!verificationCode) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Code de vérification requis' })
            };
            return;
        }
        
        context.log(`✅ Envoi du code ${verificationCode} à ${email}`);

        // Stocker le code côté serveur (24h) pour vérification
        try {
            const expiresAt = Date.now() + (24 * 60 * 60 * 1000);
            await storeCode(String(email).toLowerCase(), String(verificationCode), expiresAt);
        } catch (e) {
            context.log.warn('⚠️ Impossible de stocker le code de vérification:', e?.message || String(e));
        }
        
        // ========== Envoi d'email ==========
        const apiKey = process.env.SENDGRID_API_KEY;
        
        if (!apiKey) {
            context.log.error('❌ SENDGRID_API_KEY non configuré');
            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: 'Configuration email manquante',
                    success: false
                })
            };
            return;
        }
        
        // Configurer SendGrid
        sgMail.setApiKey(apiKey);
        
        const emailMessage = {
            to: email,
            from: process.env.SENDGRID_SENDER || 'noreply@axilum.ai',
            subject: 'Votre code de vérification Axilum AI',
            text: `Bonjour ${name || 'utilisateur'},\n\nBienvenue sur Axilum AI !\n\nVotre code de vérification est :\n\n${verificationCode}\n\nCe code expire dans 24 heures.\n\nSi vous n'avez pas créé ce compte, ignorez cet email.\n\nCordialement,\nL'équipe Axilum AI`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .button-box { text-align: center; margin: 30px 0; }
                        .button { background: #667eea; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; }
                        .button:hover { background: #5568d3; }
                        .link-text { color: #667eea; word-break: break-all; font-size: 12px; margin-top: 15px; padding: 10px; background: white; border: 1px dashed #ddd; border-radius: 5px; }
                        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                        .timer { color: #ff6b6b; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🤖 Axilum AI</h1>
                            <p>Vérification de votre email</p>
                        </div>
                        <div class="content">
                            <p>Bonjour <strong>${name || 'utilisateur'}</strong>,</p>
                            <p>Bienvenue sur <strong>Axilum AI</strong> ! Pour finaliser la création de votre compte, entrez ce code de vérification dans l'application :</p>
                            
                            <div style="text-align: center; margin: 40px 0;">
                                <div style="font-size: 48px; font-weight: bold; letter-spacing: 8px; color: #667eea; background: white; padding: 20px; border-radius: 10px; display: inline-block;">
                                    ${verificationCode}
                                </div>
                            </div>
                            
                            <p style="text-align: center; color: #666; font-size: 14px;">Entrez ce code dans l'application pour vérifier votre email</p>
                            
                            <p style="margin-top: 20px;"><span class="timer">⏰ Ce code expire dans 24 heures.</span></p>
                            
                            <p>Si vous n'avez pas créé ce compte, vous pouvez ignorer cet email en toute sécurité.</p>
                            
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
        
        context.log(`📤 Envoi d'email à ${email}...`);
        
        // Envoyer l'email et attendre
        try {
            await sgMail.send(emailMessage);
            context.log(`✅ Email envoyé à ${email}`);
            
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    message: 'Email envoyé avec succès'
                })
            };
        } catch (sendError) {
            context.log.error(`❌ Erreur SendGrid:`, sendError.response?.body || sendError.message);
            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: 'Erreur envoi email',
                    details: sendError.message,
                    success: false
                })
            };
        }
        
    } catch (error) {
        context.log.error('❌ Erreur:', error.message);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: 'Erreur lors du traitement',
                details: error.message 
            })
        };
    }
};

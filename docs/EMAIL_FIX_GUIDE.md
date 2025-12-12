# 📧 Configuration Azure Communication Services - Email

## 🚨 Problème actuel

L'utilisateur reçoit "erreur lors de l'envoi de l'email" lors de l'inscription car la variable d'environnement `AZURE_COMMUNICATION_CONNECTION_STRING` n'est pas configurée dans Azure Static Web Apps.

## ✅ Solution : Configurer Azure Communication Services

### Option 1 : Azure Communication Services (Recommandé pour production)

#### Étape 1 : Créer une ressource Azure Communication Services

```bash
# Via Azure Portal
1. Aller sur https://portal.azure.com
2. Cliquer sur "+ Create a resource"
3. Rechercher "Communication Services"
4. Cliquer sur "Create"

Paramètres:
- Resource Group: axilum-resources (ou créer nouveau)
- Name: axilum-communication-services
- Data Location: United States
- Pricing: Pay-as-you-go

5. Review + Create
```

#### Étape 2 : Configurer Email Domain

```bash
# Dans la ressource Communication Services
1. Aller dans "Email" > "Domains"
2. Option A : Utiliser un domaine Azure gratuit
   - Cliquer sur "Add free Azure domain"
   - Email sender: DoNotReply@xxxxxxx.azurecomm.net

   Option B : Utiliser votre propre domaine
   - Cliquer sur "Add domain"
   - Entrer votre domaine : solutionshub.uk
   - Suivre les instructions pour ajouter les DNS records
   - Verified sender: noreply@solutionshub.uk
```

#### Étape 3 : Obtenir la Connection String

```bash
1. Dans la ressource Communication Services
2. Aller dans "Settings" > "Keys"
3. Copier "Connection string" (Primary)
```

#### Étape 4 : Configurer dans Azure Static Web Apps

```bash
# Via Azure Portal
1. Aller sur https://portal.azure.com
2. Ouvrir "Static Web Apps"
3. Sélectionner "nice-river-096898203"
4. Dans le menu gauche : "Configuration"
5. Cliquer sur "Application settings"
6. Ajouter nouvelle variable:
   
   Name: AZURE_COMMUNICATION_CONNECTION_STRING
   Value: [Coller la connection string de l'étape 3]
   
7. (Optionnel) Ajouter le sender:
   Name: AZURE_COMMUNICATION_SENDER
   Value: DoNotReply@xxxxxxx.azurecomm.net
   
8. Cliquer sur "Save"
9. Attendre le redémarrage (2-3 minutes)
```

### Option 2 : SendGrid (Alternative gratuite)

SendGrid offre 100 emails/jour gratuits - parfait pour débuter.

#### Étape 1 : Créer un compte SendGrid

```bash
1. Aller sur https://signup.sendgrid.com/
2. Créer un compte gratuit
3. Vérifier l'email
4. Compléter le questionnaire initial
```

#### Étape 2 : Créer une API Key

```bash
1. Dans le dashboard SendGrid
2. Settings > API Keys
3. Create API Key
   - Name: Axilum AI Production
   - Permissions: Full Access
4. Copier la clé (elle ne sera affichée qu'une fois!)
```

#### Étape 3 : Vérifier un sender

```bash
1. Settings > Sender Authentication
2. Single Sender Verification
3. Ajouter:
   - From Name: Axilum AI
   - From Email: noreply@solutionshub.uk (ou votre email)
4. Vérifier l'email reçu
```

#### Étape 4 : Modifier le code pour utiliser SendGrid

Créer `/workspaces/Axilum/api/sendVerificationEmail/sendgrid-version.js`:

```javascript
const sgMail = require('@sendgrid/mail');

module.exports = async function (context, req) {
    const { storeCode } = require('../utils/codeStorage');
    
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
        
        // Générer code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 15 * 60 * 1000;
        await storeCode(email, verificationCode, expiresAt);
        
        // SendGrid
        const apiKey = process.env.SENDGRID_API_KEY;
        
        if (!apiKey) {
            context.log.warn('⚠️ SENDGRID_API_KEY non configuré - Mode dev');
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    message: 'Code généré (mode dev)',
                    code: verificationCode
                })
            };
            return;
        }
        
        sgMail.setApiKey(apiKey);
        
        const msg = {
            to: email,
            from: process.env.SENDGRID_SENDER || 'noreply@solutionshub.uk',
            subject: 'Code de vérification Axilum AI',
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
        };
        
        await sgMail.send(msg);
        
        context.log(`✅ Email envoyé à ${email} via SendGrid`);
        
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Code de vérification envoyé par email'
            })
        };
        
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
```

#### Étape 5 : Configurer dans Azure Static Web Apps

```bash
# Via Azure Portal
1. Aller sur https://portal.azure.com
2. Ouvrir "Static Web Apps"
3. Sélectionner "nice-river-096898203"
4. Dans le menu gauche : "Configuration"
5. Cliquer sur "Application settings"
6. Ajouter:
   
   Name: SENDGRID_API_KEY
   Value: [Votre clé API SendGrid]
   
   Name: SENDGRID_SENDER
   Value: noreply@solutionshub.uk
   
7. Cliquer sur "Save"
```

## 🧪 Test après configuration

### Test 1 : Vérifier les variables d'environnement

Créer une fonction temporaire de test `/api/testConfig`:

```javascript
module.exports = async function (context, req) {
    context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            azureCommunication: !!process.env.AZURE_COMMUNICATION_CONNECTION_STRING,
            sendgrid: !!process.env.SENDGRID_API_KEY,
            storage: !!process.env.AZURE_STORAGE_CONNECTION_STRING
        })
    };
};
```

Tester : `https://nice-river-096898203.3.azurestaticapps.net/api/testConfig`

### Test 2 : Envoyer un email de test

```bash
# Via l'interface utilisateur
1. Aller sur https://nice-river-096898203.3.azurestaticapps.net
2. Cliquer sur "Create Account"
3. Entrer votre email
4. Vérifier la réception de l'email
```

## 📊 Comparaison des options

| Critère | Azure Communication Services | SendGrid |
|---------|----------------------------|----------|
| **Prix gratuit** | 0$ (100 emails/mois) | 100 emails/jour |
| **Setup** | Moyen (domain DNS) | Facile |
| **Intégration Azure** | Native | Package externe |
| **Deliverability** | Excellent | Excellent |
| **Recommandation** | Production à grande échelle | MVP / Démarrage rapide |

## 🚀 Recommandation

**Pour débuter rapidement : SendGrid**
- Configuration en 10 minutes
- 100 emails/jour gratuit (suffisant pour démarrer)
- Pas de configuration DNS nécessaire

**Pour production à long terme : Azure Communication Services**
- Intégration native avec Azure
- Meilleure pour scaling
- Domaine personnalisé professionnel

## 📝 Prochaines étapes

1. **Choisir une option** (SendGrid recommandé pour démarrer)
2. **Configurer les variables** dans Azure Static Web Apps
3. **Tester** l'envoi d'email
4. **Monitorer** les logs dans Azure Portal

## 🔍 Debugging

Si l'email ne fonctionne toujours pas :

```bash
# Vérifier les logs Azure
1. Portal Azure > Static Web Apps > nice-river-096898203
2. Monitoring > Application Insights
3. Logs > Check "sendVerificationEmail" function logs

# Vérifier le code stocké
node api/test_storage_features.js
```

## 💰 Coûts estimés

- **SendGrid Free** : 0$/mois (100 emails/jour)
- **Azure Communication Services** : ~0.01$/email après 100 premiers gratuits
- **Estimation** : Si 100 nouveaux utilisateurs/mois → ~1$/mois

---

**Status actuel** : ❌ Variables non configurées  
**Action requise** : Configurer SENDGRID_API_KEY ou AZURE_COMMUNICATION_CONNECTION_STRING  
**Temps estimé** : 15-30 minutes

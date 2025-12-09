# 📧 Configuration de l'Envoi d'Emails - Axilum AI

## 🎯 Options d'Envoi d'Emails

### Option 1 : SendGrid (Recommandé - Plus Simple) ✅

**Avantages :**
- ✅ Gratuit jusqu'à 100 emails/jour
- ✅ Configuration simple
- ✅ Bonne délivrabilité
- ✅ API REST facile à utiliser
- ✅ Dashboard complet avec statistiques

**Coût :**
- Gratuit : 100 emails/jour
- Essentials : $19.95/mois - 50k emails/mois
- Pro : $89.95/mois - 100k emails/mois

---

### Option 2 : Azure Communication Services

**Avantages :**
- ✅ Intégration native Azure
- ✅ Service Microsoft officiel
- ✅ Bonne scalabilité

**Inconvénients :**
- ⚠️ Configuration plus complexe
- ⚠️ Nécessite un domaine vérifié
- ⚠️ Pas de plan gratuit

**Coût :**
- $0.025 par 1000 emails envoyés

---

## 🚀 Guide Configuration SendGrid (Recommandé)

### Étape 1 : Créer un Compte SendGrid

1. Allez sur https://signup.sendgrid.com/
2. Inscrivez-vous avec votre email
3. Vérifiez votre compte par email
4. Complétez le questionnaire initial

### Étape 2 : Vérifier un Expéditeur (Sender)

1. Dans le dashboard SendGrid → **Settings** → **Sender Authentication**
2. Cliquez sur **Verify a Single Sender**
3. Remplissez le formulaire :
   ```
   From Name: Axilum AI
   From Email: noreply@votredomaine.com (ou votre email personnel)
   Reply To: support@solutionshub.uk
   Company Address: [Votre adresse]
   ```
4. Vérifiez votre email → Cliquez sur le lien de confirmation
5. ✅ Votre expéditeur est vérifié !

### Étape 3 : Créer une Clé API

1. Dashboard → **Settings** → **API Keys**
2. Cliquez sur **Create API Key**
3. Nom : `Axilum AI Production`
4. Permissions : **Full Access** (ou **Mail Send** seulement)
5. Cliquez sur **Create & View**
6. **⚠️ COPIEZ LA CLÉ IMMÉDIATEMENT** (elle ne sera plus affichée)
   ```
   Format: SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Étape 4 : Configurer sur Azure Static Web Apps

1. Allez sur https://portal.azure.com
2. Trouvez votre **Static Web App**
3. Menu gauche → **Configuration**
4. Ajoutez ces variables :

   ```
   Nom : SENDGRID_API_KEY
   Valeur : SG.votre_cle_api_complete
   
   Nom : SENDGRID_FROM_EMAIL
   Valeur : noreply@votredomaine.com (l'email vérifié)
   
   Nom : SENDGRID_FROM_NAME
   Valeur : Axilum AI
   ```

5. Cliquez sur **Enregistrer**
6. Attendez 2-3 minutes pour la propagation

### Étape 5 : Activer SendGrid dans le Code

Décommentez les lignes dans `/api/sendVerificationEmail/index.js` :

```javascript
// Ligne 56-80 environ - Remplacer le code actuel par :

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
    to: email,
    from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME || 'Axilum AI'
    },
    subject: 'Code de vérification Axilum AI',
    text: `Bonjour ${name || 'utilisateur'},\n\nVotre code de vérification est : ${verificationCode}\n\nCe code expire dans 15 minutes.\n\nSi vous n'avez pas demandé ce code, ignorez cet email.\n\nCordialement,\nL'équipe Axilum AI`,
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
context.log(`✅ Email envoyé via SendGrid à ${email}`);

// NE PAS retourner le code en production !
return {
    status: 200,
    body: {
        success: true,
        message: 'Code de vérification envoyé par email'
        // Pas de 'code' en production !
    }
};
```

### Étape 6 : Installer les Dépendances

```bash
cd api
npm install @sendgrid/mail
```

### Étape 7 : Déployer

```bash
git add .
git commit -m "Enable real email sending with SendGrid"
git push
```

---

## 🧪 Test Local

1. Ajoutez dans `api/local.settings.json` :
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "AZURE_AI_API_KEY": "[REDACTED_AZURE_AI_API_KEY]",
       "SENDGRID_API_KEY": "votre_cle_sendgrid",
       "SENDGRID_FROM_EMAIL": "noreply@example.com",
       "SENDGRID_FROM_NAME": "Axilum AI"
     }
   }
   ```

2. Lancez les fonctions :
   ```bash
   cd api
   npm start
   ```

3. Testez avec curl :
   ```bash
   curl -X POST http://localhost:7071/api/send-verification-email \
     -H "Content-Type: application/json" \
     -d '{"email":"votre-email@example.com","name":"Test User"}'
   ```

4. Vérifiez votre boîte mail !

---

## 📊 Mode Développement vs Production

### Mode Développement (NODE_ENV !== 'production')
- ✅ Le code est retourné dans la réponse API
- ✅ Affiché dans la modal pour faciliter les tests
- ✅ Pas besoin de vérifier l'email

### Mode Production
- 🔒 Le code n'est PAS retourné dans l'API
- 📧 Envoyé uniquement par email
- ✅ Sécurité maximale
- ⏰ Expiration 15 minutes

---

## 🔐 Sécurité

### ⚠️ Points Importants

1. **Ne JAMAIS committer les clés API**
   - ✅ Utilisez `local.settings.json` (déjà dans .gitignore)
   - ✅ Configurez sur Azure Portal

2. **Limiter les tentatives**
   - Ajouter rate limiting (3 emails max par email/heure)
   - Bloquer après 5 tentatives échouées

3. **Expiration des codes**
   - 15 minutes max
   - Stockage avec TTL dans Azure Table Storage

4. **Validation côté serveur**
   - Ne jamais faire confiance au client
   - Valider TOUS les paramètres

---

## 📈 Monitoring

### Dashboard SendGrid

1. **Activity** : Voir tous les emails envoyés
2. **Stats** : Taux de délivrabilité, ouvertures, clics
3. **Suppressions** : Emails bloqués/rebondis

### Azure Application Insights

1. Logs de toutes les tentatives d'envoi
2. Erreurs et exceptions
3. Temps de réponse API

---

## 🐛 Dépannage

### Erreur : "The from email does not match a verified Sender Identity"

**Solution :** Vérifiez que l'email dans `SENDGRID_FROM_EMAIL` est bien vérifié dans SendGrid

### Emails vont dans Spam

**Solutions :**
1. Configurer SPF/DKIM dans SendGrid (Domain Authentication)
2. Éviter les mots spam dans le sujet
3. Utiliser un domaine vérifié

### Erreur : "Forbidden"

**Solution :** Vérifiez que la clé API a les permissions "Mail Send"

### Emails non reçus

**Vérifications :**
1. Spam/Promotions
2. Dashboard SendGrid → Activity
3. Email correct
4. Logs Azure Function

---

## 💰 Coûts Estimés

### Scénario 1 : MVP (< 100 utilisateurs/jour)
- SendGrid Free : **$0/mois**
- Total : **GRATUIT**

### Scénario 2 : Petit Volume (500 users/jour)
- SendGrid Essentials : **$19.95/mois**
- Total : **~$20/mois**

### Scénario 3 : Gros Volume (3000 users/jour)
- SendGrid Pro : **$89.95/mois**
- Total : **~$90/mois**

---

## ✅ Checklist de Déploiement

- [ ] Compte SendGrid créé
- [ ] Sender vérifié
- [ ] Clé API générée
- [ ] Variables configurées sur Azure
- [ ] Code décommenté dans la fonction
- [ ] npm install @sendgrid/mail
- [ ] Code déployé sur Azure
- [ ] Test en production réussi
- [ ] Email reçu avec code correct
- [ ] Vérification fonctionne

---

## 🎉 Prochaines Améliorations

1. **Email de Bienvenue** après vérification
2. **Reset mot de passe** par email
3. **Notifications** importantes
4. **Templates personnalisés** par type
5. **Statistiques d'engagement** utilisateurs

---

**Support :** support@solutionshub.uk  
**Documentation SendGrid :** https://docs.sendgrid.com/

# 📧 Configuration Azure Communication Services Email

## 🎯 Avantages de Azure Communication Services

✅ **Natif Azure** - Intégration parfaite avec vos ressources  
✅ **Pas de compte externe** - Tout dans Azure Portal  
✅ **Sécurisé** - Authentification Azure AD  
✅ **Scalable** - Adapté à grande échelle  
✅ **Simple** - Configuration directe dans Azure  

---

## 🚀 Configuration Complète (15 minutes)

### Étape 1 : Créer une Ressource Azure Communication Services

1. **Allez sur le Portail Azure** : https://portal.azure.com

2. **Créer une ressource** :
   - Cliquez sur **"+ Créer une ressource"**
   - Recherchez : **"Communication Services"**
   - Cliquez sur **"Créer"**l
   9

3. **Configurer la ressource** :
   ```
   Subscription: [Votre abonnement]
   Resource Group: [Même groupe que votre Static Web App]
   Name: axilum-communication-services
   Data Location: Europe (ou votre région)
   ```

4. **Cliquez sur "Review + Create"** puis **"Create"**

5. **Attendez le déploiement** (1-2 minutes)

---

### Étape 2 : Créer un Domaine Email

1. **Dans votre ressource Communication Services** :
   - Menu gauche → **"Email"** → **"Domains"**
   - Cliquez sur **"Add domain"**

2. **Choisir le type de domaine** :

   **Option A : Utiliser un domaine Azure (Plus Simple)** ✅
   ```
   - Sélectionnez "Azure managed domain"
   - Azure vous donne automatiquement un domaine comme :
     axilum-xxxx.azurecomm.net
   - Aucune configuration DNS nécessaire
   - Prêt immédiatement
   ```

   **Option B : Utiliser votre propre domaine**
   ```
   - Sélectionnez "Custom domain"
   - Entrez votre domaine : example.com
   - Configurez les enregistrements DNS (SPF, DKIM)
   - Attendez la vérification (peut prendre 24h)
   ```

3. **Pour ce guide, utilisez Option A** (Azure managed domain)

4. **Notez votre domaine** : `DoNotReply@xxxxxxxx.azurecomm.net`

---

### Étape 3 : Obtenir la Clé de Connexion

1. **Dans votre Communication Services** :
   - Menu gauche → **"Keys"**
   - Vous verrez :
     ```
     Primary key: [longue clé]
     Primary connection string: [longue chaîne]
     ```

2. **Copiez la "Primary connection string"** - Format :
   ```
   endpoint=https://axilum-communication.communication.azure.com/;accesskey=xxx...
   ```

---

### Étape 4 : Configurer votre Static Web App

1. **Allez sur votre Static Web App** dans Azure Portal

2. **Menu gauche → "Configuration"**

3. **Ajoutez ces variables** :

   ```
   Nom : AZURE_COMMUNICATION_CONNECTION_STRING
   Valeur : [Votre connection string complète]
   
   Nom : AZURE_COMMUNICATION_SENDER
   Valeur : DoNotReply@xxxxxxxx.azurecomm.net
   
   (Remplacez xxxxxxxx par votre domaine Azure)
   ```

4. **Cliquez sur "Enregistrer"**

5. **Attendez 2-3 minutes** pour la propagation

---

### Étape 5 : Déployer le Code

Le code est déjà prêt dans `api/sendVerificationEmail/index.js` !

```bash
cd /workspaces/azuredev-2641
git add -A
git commit -m "Enable Azure Communication Services Email"
git push
```

---

### Étape 6 : Tester

1. **Attendez le déploiement GitHub Actions** (2-3 min)

2. **Ouvrez votre application** :
   ```
   https://proud-mushroom-019836d03.3.azurestaticapps.net
   ```

3. **Créez un compte** :
   - Cliquez sur "Mon Compte" → "Créer un compte"
   - Remplissez le formulaire avec VOTRE VRAI EMAIL
   - Cliquez sur "Créer mon compte"

4. **Vérifiez votre boîte mail** ! 📧
   - Vérifiez aussi les Spams/Promotions
   - L'email vient de : `DoNotReply@xxxxxxxx.azurecomm.net`

5. **Entrez le code** reçu par email

6. **✅ Compte créé et vérifié !**

---

## 📊 Architecture du Système

```
┌─────────────────┐
│   Frontend      │
│  (index.html)   │
└────────┬────────┘
         │ POST /api/send-verification-email
         │ { email, name }
         ▼
┌─────────────────────────┐
│   Azure Function        │
│ sendVerificationEmail   │
│  - Génère code 6 chiffres
│  - Appelle ACS Email    │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Azure Communication     │
│     Services            │
│  - Envoie l'email       │
│  - Gère délivrabilité   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│   Boîte Mail User       │
│  - Reçoit code 123456   │
│  - Valide < 15 min      │
└─────────────────────────┘
```

---

## 💰 Coûts

### Azure Communication Services Email

**Tarification (Pay-as-you-go)** :
- **$0.025** pour 1000 emails envoyés

**Exemples** :
```
100 emails/jour   × 30 jours = 3,000 emails/mois  = $0.08/mois
500 emails/jour   × 30 jours = 15,000 emails/mois = $0.38/mois
1000 emails/jour  × 30 jours = 30,000 emails/mois = $0.75/mois
5000 emails/jour  × 30 jours = 150,000 emails/mois = $3.75/mois
```

**Conclusion** : Extrêmement peu coûteux ! 🎉

### Comparaison avec SendGrid

| Service | Gratuit | 50k emails/mois | 100k emails/mois |
|---------|---------|-----------------|------------------|
| **Azure Communication Services** | $0.025/1k = $1.25 | $1.25 | $2.50 |
| **SendGrid** | 100/jour limité | $19.95 | $89.95 |

**Azure Communication Services est ~10-40x moins cher !** 💰

---

## 🔐 Sécurité

### Variables d'Environnement (Déjà configuré) ✅

```javascript
// Ne jamais hardcoder dans le code !
const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
const senderAddress = process.env.AZURE_COMMUNICATION_SENDER;
```

### Mode Développement vs Production

**Développement** (pas de connection string configurée) :
- ✅ Code retourné dans l'API
- ✅ Affiché dans la modal
- ✅ Aucun email envoyé
- ✅ Tests faciles

**Production** (connection string configurée) :
- 🔒 Code envoyé par email uniquement
- 🔒 Pas de code dans la réponse API
- 🔒 Expiration 15 minutes
- 🔒 Code masqué dans la modal

---

## 📧 Template Email

L'email envoyé contient :

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 Axilum AI
Vérification de votre compte
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bonjour [Nom],

Merci de vous être inscrit sur Axilum AI !
Pour finaliser la création de votre compte,
veuillez utiliser le code ci-dessous :

┌─────────────────┐
│    123456       │  ← Code à 6 chiffres
└─────────────────┘

⏰ Ce code expire dans 15 minutes.

Si vous n'avez pas demandé ce code, ignorez
cet email.

Cordialement,
L'équipe Axilum AI

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI Solutions Hub®
support@solutionshub.uk
```

**Format** :
- ✅ HTML responsive
- ✅ Texte brut (fallback)
- ✅ Design professionnel
- ✅ Code mis en évidence

---

## 🧪 Tests

### Test 1 : Email Envoyé

```bash
# Test de l'API directement
curl -X POST https://proud-mushroom-019836d03.3.azurestaticapps.net/api/send-verification-email \
  -H "Content-Type: application/json" \
  -d '{"email":"votre-email@example.com","name":"Test User"}'

# Résultat attendu :
{
  "success": true,
  "message": "Code de vérification envoyé par email",
  "messageId": "xxxx-xxxx-xxxx"
}
```

### Test 2 : Email Reçu

1. Vérifiez votre boîte de réception
2. Vérifiez Spam/Promotions si nécessaire
3. L'email doit arriver en < 30 secondes

### Test 3 : Code Valide

1. Copiez le code reçu par email
2. Collez-le dans l'application
3. Cliquez sur "Vérifier"
4. ✅ Compte créé !

---

## 🐛 Dépannage

### Erreur : "AZURE_COMMUNICATION_CONNECTION_STRING non configuré"

**Solution** :
1. Vérifiez Azure Portal → Static Web App → Configuration
2. La variable doit être exactement : `AZURE_COMMUNICATION_CONNECTION_STRING`
3. La valeur doit commencer par : `endpoint=https://...`
4. Sauvegardez et attendez 2-3 minutes

### Erreur : "Invalid sender address"

**Solution** :
1. Vérifiez que `AZURE_COMMUNICATION_SENDER` est configuré
2. Format correct : `DoNotReply@xxxxxxxx.azurecomm.net`
3. Le domaine doit correspondre à votre ressource ACS

### Email non reçu

**Vérifications** :
1. ✅ Vérifiez Spam/Promotions/Indésirables
2. ✅ Email correct (pas de faute de frappe)
3. ✅ Azure Portal → Communication Services → Email → Metrics
4. ✅ Logs de la fonction Azure (Log Stream)

### Erreur : "Polling operation status failed"

**Solution** :
- La connexion string est incorrecte
- Recopiez-la depuis Azure Portal → Keys

---

## 📊 Monitoring

### Azure Portal

1. **Communication Services → Metrics** :
   - Emails envoyés
   - Emails délivrés
   - Emails échoués
   - Taux de délivrabilité

2. **Static Web App → Log Stream** :
   - Voir les logs en temps réel
   - Détecter les erreurs
   - Déboguer les problèmes

### Application Insights (Recommandé)

Si vous avez Application Insights configuré :
- Traces complètes de tous les envois
- Temps de réponse
- Taux d'erreur
- Alertes automatiques

---

## 🎯 Améliorations Futures

### 1. Stockage des Codes avec TTL

Actuellement, le code est stocké en mémoire. Pour la production :

```javascript
// Utiliser Azure Table Storage avec TTL
const { TableClient } = require("@azure/data-tables");

await tableClient.createEntity({
    partitionKey: email,
    rowKey: Date.now().toString(),
    code: verificationCode,
    expiresAt: Date.now() + 15 * 60 * 1000
});
```

### 2. Rate Limiting

Limiter les tentatives :
- Max 3 emails par email/heure
- Max 5 tentatives de vérification
- Blocage temporaire après abus

### 3. Templates Dynamiques

Créer des templates dans Azure :
- Email de bienvenue
- Reset mot de passe
- Notifications importantes
- Newsletters

### 4. Analytics

Tracker :
- Taux d'ouverture des emails
- Temps moyen de vérification
- Taux de conversion inscription

---

## ✅ Checklist Finale

- [ ] Ressource Azure Communication Services créée
- [ ] Domaine Email configuré (Azure managed ou custom)
- [ ] Connection string copiée
- [ ] Variables configurées sur Static Web App
- [ ] Code déployé sur Azure
- [ ] Test envoi email réussi
- [ ] Email reçu dans boîte mail
- [ ] Code de vérification fonctionne
- [ ] Compte créé avec succès

---

## 🎉 Félicitations !

Vous avez maintenant un système d'authentification complet avec vérification email réelle via Azure Communication Services !

**Avantages obtenus** :
- ✅ Sécurité maximale
- ✅ Coût minimal
- ✅ Infrastructure 100% Azure
- ✅ Scalabilité automatique
- ✅ Monitoring intégré

---

## 📞 Support

**Email** : support@solutionshub.uk  
**Documentation Azure** : https://learn.microsoft.com/azure/communication-services/  
**Pricing** : https://azure.microsoft.com/pricing/details/communication-services/

---

**Dernière mise à jour** : 6 décembre 2025  
**Version** : 1.0.0 - Azure Communication Services Email

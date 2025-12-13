# ⚡ Configuration SendGrid - URGENTE

## Le Problème
Les emails ne s'envoient plus car `SENDGRID_API_KEY` n'est pas configuré dans Azure.

## Solution (5 minutes)

### 1️⃣ Obtenir une clé API SendGrid

Si vous n'avez pas de compte SendGrid :
1. Allez sur https://sendgrid.com/
2. Créez un compte gratuit (100 emails/jour)
3. Allez dans **Settings** → **API Keys**
4. Cliquez **Create API Key**
5. Nom : `Axilum Email Verification`
6. Permissions : **Full Access** ou au minimum **Mail Send**
7. Copiez la clé (elle commence par `SG.`)

### 2️⃣ Configurer dans Azure Static Web Apps

1. Allez sur le portail Azure : https://portal.azure.com
2. Cherchez votre Static Web App : `nice-river-096898203`
3. Dans le menu gauche : **Configuration**
4. Cliquez **+ Add** (ou **Application settings**)
5. Ajoutez ces 2 variables :

```
Nom : SENDGRID_API_KEY
Valeur : SG.xxxxxxxxxxxxxxxxxxxxxx (votre clé API)

Nom : SENDGRID_SENDER
Valeur : noreply@axilum.ai (ou votre email vérifié)
```

6. Cliquez **Save** / **Enregistrer**
7. Attendez 2-3 minutes que le redéploiement se fasse

### 3️⃣ Vérifier le sender email

⚠️ **IMPORTANT** : SendGrid n'enverra des emails QUE si :
- Vous utilisez un email que vous avez vérifié chez SendGrid
- OU vous avez configuré un domaine personnalisé

**Option 1 - Email simple (Rapide)** :
1. Dans SendGrid : **Settings** → **Sender Authentication**
2. **Verify a Single Sender**
3. Utilisez votre vrai email (ex: contact@votredomaine.com)
4. Vérifiez l'email de confirmation
5. Utilisez cet email comme `SENDGRID_SENDER`

**Option 2 - Domaine (Avancé)** :
1. Dans SendGrid : **Settings** → **Sender Authentication**
2. **Authenticate Your Domain**
3. Suivez les instructions DNS

### 4️⃣ Tester

Une fois configuré, créez un nouveau compte sur votre app.
L'email de vérification devrait arriver en moins de 10 secondes !

## Vérification rapide

Si ça ne marche toujours pas, vérifiez dans Azure :
1. **Logs** → Cherchez "SENDGRID_API_KEY non configuré"
2. Si le message apparaît encore, les variables ne sont pas bien enregistrées

## Alternative temporaire

Si vous voulez tester MAINTENANT sans attendre SendGrid :
- Utilisez votre Gmail avec un App Password
- Mais SendGrid est BEAUCOUP mieux pour la production

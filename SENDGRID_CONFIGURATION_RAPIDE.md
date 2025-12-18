# ⚡ GUIDE RAPIDE - Configuration SendGrid (5 minutes)

## 🎯 Objectif
Configurer SendGrid pour que les emails de vérification arrivent aux utilisateurs.

---

## 📋 ÉTAPE 1 : Obtenir une clé API SendGrid (2 minutes)

### Option A : Vous avez déjà un compte SendGrid
1. Connectez-vous sur https://app.sendgrid.com/
2. Menu gauche : **Settings** → **API Keys**
3. Cliquez **Create API Key**
4. Nom : `Axilum Production`
5. Type : **Full Access** (ou au minimum "Mail Send")
6. Cliquez **Create & View**
7. **📋 COPIEZ LA CLÉ** (commence par `SG.`) - vous ne pourrez plus la voir après !

### Option B : Nouveau compte (gratuit - 100 emails/jour)
1. Allez sur https://signup.sendgrid.com/
2. Créez votre compte (gratuit, pas de CB requise)
3. Vérifiez votre email
4. Suivez les étapes de l'Option A

---

## 📧 ÉTAPE 2 : Vérifier un sender email (2 minutes)

⚠️ **CRITIQUE** : SendGrid n'enverra d'emails QUE si vous avez un sender vérifié.

1. Dans SendGrid : **Settings** → **Sender Authentication**
2. Cliquez **Get Started** sous "**Verify a Single Sender**"
3. Remplissez le formulaire :
   - From Name : `Axilum AI`
   - From Email : **Votre vrai email** (ex: contact@votredomaine.com ou votre Gmail)
   - Reply To : Même email
   - Company : `Axilum`
   - Address, etc. : Remplissez (requis mais pas utilisé)
4. Cliquez **Verify**
5. **Allez dans votre boîte email** et cliquez le lien de vérification
6. Vous devriez voir "✅ Verified" dans SendGrid

---

## ⚙️ ÉTAPE 3 : Configurer dans Azure (1 minute)

1. Ouvrez https://portal.azure.com/
2. Cherchez votre **Static Web App** : `nice-river-096898203`
3. Menu gauche : **Configuration** (ou **Settings** → **Configuration**)
4. Cliquez **+ Add** ou **Application settings**
5. Ajoutez la première variable :
   ```
   Nom   : SENDGRID_API_KEY
   Valeur: SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   (Collez votre clé API copiée à l'étape 1)

6. Ajoutez la deuxième variable :
   ```
   Nom   : SENDGRID_SENDER
   Valeur: contact@votredomaine.com
   ```
   (Utilisez l'email que vous avez vérifié à l'étape 2)

7. Cliquez **Save** / **Enregistrer**
8. Attendez 2-3 minutes (Azure redémarre automatiquement)

---

## 🧪 ÉTAPE 4 : Tester (30 secondes)

1. Allez sur votre site : https://nice-river-096898203.azurestaticapps.net/
2. Cliquez **Créer un compte**
3. Entrez **votre vrai email**
4. Cliquez **S'inscrire**
5. Vérifiez votre email (regardez aussi dans **spam** !)
6. Vous devriez recevoir un email avec un code à 6 chiffres
7. Entrez le code → Vous êtes connecté ! 🎉

---

## ❌ Problème ? Vérifications

### Email n'arrive pas ?

1. **Vérifiez les logs Azure** :
   - Azure Portal → Static Web App
   - **Functions** → **sendVerificationEmail**
   - **Monitor** → Regardez les logs
   - Cherchez : "✅ Email envoyé" ou "❌ Erreur"

2. **Vérifiez SendGrid Activity** :
   - https://app.sendgrid.com/ → **Activity** → **Email Activity**
   - Cherchez votre email dans les dernières minutes
   - Status :
     - **Delivered** ✅ : OK, regardez vos spams
     - **Bounced** ❌ : Email invalide
     - **Dropped** ❌ : Sender non vérifié (retour étape 2)

3. **Vérifiez la configuration Azure** :
   - Les variables sont bien enregistrées ?
   - `SENDGRID_API_KEY` commence par `SG.` ?
   - `SENDGRID_SENDER` correspond à l'email vérifié ?

---

## 📊 Vérification rapide - Logs Azure

Si tout fonctionne, vous devriez voir dans les logs :

```
✅ Envoi du code 123456 à user@example.com
📤 Envoi d'email à user@example.com...
✅ Email envoyé à user@example.com
```

Si ça ne marche pas :

```
❌ SENDGRID_API_KEY non configuré
```
→ Retournez à l'étape 3

```
❌ Erreur SendGrid: The from address does not match a verified Sender Identity
```
→ Retournez à l'étape 2

---

## 🎯 Résumé

| Étape | Action | Temps |
|-------|--------|-------|
| 1 | Obtenir API Key SendGrid | 2 min |
| 2 | Vérifier sender email | 2 min |
| 3 | Configurer dans Azure | 1 min |
| 4 | Tester | 30 sec |
| **Total** | | **~5 min** |

---

## 📱 Captures d'écran de référence

### SendGrid - API Keys
```
Settings > API Keys > Create API Key
┌─────────────────────────────────────┐
│ API Key Name: Axilum Production     │
│ API Key Permissions: Full Access    │
│                                     │
│ [Create & View]                     │
└─────────────────────────────────────┘
```

### SendGrid - Sender Authentication
```
Settings > Sender Authentication > Verify a Single Sender
┌─────────────────────────────────────┐
│ From Name: Axilum AI                │
│ From Email: contact@votredomaine.com│
│ Reply To: contact@votredomaine.com  │
│                                     │
│ [Verify]                            │
└─────────────────────────────────────┘
```

### Azure - Configuration
```
Static Web App > Configuration > Application settings
┌─────────────────────────────────────┐
│ SENDGRID_API_KEY                    │
│ SG.xxxxxxxxxxxxxxxxxxxxx            │
│                                     │
│ SENDGRID_SENDER                     │
│ contact@votredomaine.com            │
│                                     │
│ [Save]                              │
└─────────────────────────────────────┘
```

---

## ✅ Checklist

- [ ] Compte SendGrid créé
- [ ] API Key générée et copiée
- [ ] Sender email vérifié (email de confirmation cliqué)
- [ ] Variables ajoutées dans Azure Configuration
- [ ] Configuration enregistrée (bouton Save)
- [ ] Attendu 2-3 minutes
- [ ] Test effectué sur le site
- [ ] Email de vérification reçu
- [ ] Code entré et connexion réussie

---

**Besoin d'aide ?** Vérifiez [FIX_EMAIL_VERIFICATION.md](FIX_EMAIL_VERIFICATION.md) pour le diagnostic complet.

**Fait le** : 18 décembre 2025

# ✅ Configuration Email Azure - PRÊT À DÉPLOYER

## 🎯 Variables d'environnement à ajouter

Vous avez testé avec succès Azure Communication Services. Voici les variables à configurer dans Azure Static Web Apps :

### Variables à ajouter :

1. **AZURE_COMMUNICATION_CONNECTION_STRING**
   ```
   endpoint=https://bingo.europe.communication.azure.com/;accesskey=VOTRE_ACCESS_KEY_ICI
   ```
   ⚠️ **Remplacez par votre vraie connection string depuis Azure Portal**

2. **AZURE_COMMUNICATION_SENDER**
   ```
   DoNotReply@VOTRE-GUID.azurecomm.net
   ```
   ⚠️ **Remplacez par votre adresse d'expéditeur depuis Azure Portal**

---

## 📋 Étapes de configuration (5 minutes)

### Option 1 : Via le Portail Azure (Recommandé)

1. **Ouvrir Azure Portal**
   - Aller sur https://portal.azure.com
   - Se connecter avec votre compte

2. **Accéder à Static Web Apps**
   - Rechercher "Static Web Apps" dans la barre de recherche
   - Cliquer sur votre app : **nice-river-096898203**

3. **Ouvrir Configuration**
   - Dans le menu de gauche, cliquer sur **"Configuration"**
   - Cliquer sur l'onglet **"Application settings"**

4. **Ajouter les variables**
   
   **Variable 1 :**
   - Cliquer sur **"+ Add"**
   - Name : `AZURE_COMMUNICATION_CONNECTION_STRING`
   - Value : `Collez votre connection string depuis Azure Communication Services`
   - Cliquer **"OK"**
   
   **Variable 2 :**
   - Cliquer sur **"+ Add"**
   - Name : `AZURE_COMMUNICATION_SENDER`
   - Value : `DoNotReply@VOTRE-GUID.azurecomm.net`
   - Cliquer **"OK"**

5. **Enregistrer**
   - Cliquer sur **"Save"** en haut
   - Attendre 2-3 minutes que l'application redémarre

---

### Option 2 : Via Azure CLI (Si installé)

```bash
# Ajouter AZURE_COMMUNICATION_CONNECTION_STRING
az staticwebapp appsettings set \
  --name nice-river-096898203 \
  --setting-names AZURE_COMMUNICATION_CONNECTION_STRING="VOTRE_CONNECTION_STRING_ICI"

# Ajouter AZURE_COMMUNICATION_SENDER
az staticwebapp appsettings set \
  --name nice-river-096898203 \
  --setting-names AZURE_COMMUNICATION_SENDER="DoNotReply@VOTRE-GUID.azurecomm.net"
```

---

## ✅ Vérification

### 1. Attendre le redémarrage (2-3 minutes)

### 2. Tester la création de compte

1. Aller sur : https://nice-river-096898203.3.azurestaticapps.net
2. Cliquer sur **"Create Account"**
3. Entrer un email (ex: saidzeghidi31@gmail.com)
4. Entrer un nom d'utilisateur
5. Cliquer sur **"Continue"**
6. ✅ Vous devriez recevoir un email avec le code de vérification !

### 3. Vérifier les logs (si problème)

```bash
# Dans Azure Portal
1. Aller dans Static Web Apps > nice-river-096898203
2. Monitoring > Application Insights
3. Logs > Rechercher "sendVerificationEmail"
```

---

## 🎨 Email que l'utilisateur recevra

```
De : DoNotReply@3fe6fd0c-6f30-4619-b3e0-a7f1847ed5c5.azurecomm.net
Sujet : Code de vérification Axilum AI

┌─────────────────────────────────┐
│     🤖 Axilum AI                │
│  Vérification de votre compte   │
└─────────────────────────────────┘

Bonjour utilisateur,

Merci de vous être inscrit sur Axilum AI !
Pour finaliser la création de votre compte,
veuillez utiliser le code de vérification :

╔═══════════════════╗
║                   ║
║     123456        ║
║                   ║
╚═══════════════════╝

⏰ Ce code expire dans 15 minutes.

Si vous n'avez pas demandé ce code,
ignorez cet email.

Cordialement,
L'équipe Axilum AI

AI Solutions Hub® - support@solutionshub.uk
```

---

## 🔒 Sécurité

⚠️ **Important** : Ne partagez jamais votre `accesskey` publiquement
- ✅ Ces variables sont stockées de manière sécurisée dans Azure
- ✅ Elles ne sont pas visibles dans le code source
- ✅ Seules les Azure Functions peuvent y accéder

---

## 📊 Quota et limites

**Azure Communication Services - Free Tier :**
- ✅ 100 emails/mois gratuits
- Ensuite : ~0.01$/email
- Pas de limite journalière

**Estimation pour Axilum AI :**
- Si 50 nouveaux utilisateurs/mois → 50 emails → 0$ (dans le quota gratuit)
- Si 200 nouveaux utilisateurs/mois → 200 emails → ~1$/mois

---

## 🎯 Prochaine étape après configuration

Une fois les variables configurées et testées :

1. ✅ L'inscription fonctionnera
2. ✅ Les utilisateurs recevront leur code par email
3. ✅ Le stockage Azure persistera les données
4. ✅ Voice mode fonctionnera
5. ✅ Toutes les fonctionnalités PRO seront opérationnelles

---

## ❓ FAQ

**Q : Combien de temps pour que les variables soient actives ?**  
R : 2-3 minutes après avoir cliqué sur "Save"

**Q : Comment savoir si ça fonctionne ?**  
R : Testez en créant un compte avec votre email

**Q : L'email va en spam ?**  
R : Peut-être la première fois. Vérifiez votre dossier spam et marquez comme "Non spam"

**Q : Puis-je changer le nom d'expéditeur ?**  
R : Oui, mais il faut configurer un domaine personnalisé (voir EMAIL_SETUP_GUIDE.md)

---

**Status** : ⏳ En attente de configuration  
**Action** : Ajouter les 2 variables dans Azure Portal  
**Temps estimé** : 5 minutes  
**Impact** : ✅ Déblocage des inscriptions utilisateur

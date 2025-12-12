# ✅ Vérification du Stockage Azure Persistant

## 📍 Étape 1 : Vérifier dans Azure Portal

1. **Allez sur** [portal.azure.com](https://portal.azure.com)

2. **Recherchez** votre Static Web App : `nice-river-096898203`

3. **Menu** → **Configuration** → **Variables d'environnement**

4. **Vérifiez que ces variables existent** :

```
✅ AZURE_STORAGE_CONNECTION_STRING
   Valeur: DefaultEndpointsProtocol=https;AccountName=axilumaistorage;...
```

---

## 🚀 Étape 2 : Redéployer l'application

Si la variable est configurée, redéployez pour qu'elle soit prise en compte :

```bash
cd /workspaces/Axilum
git add -A
git commit -m "docs: Add storage verification"
git push origin main
```

L'application va se redéployer automatiquement (5-10 minutes).

---

## 🧪 Étape 3 : Tester en production

Une fois déployée, testez la persistance :

### Test 1 : Signup Instantané
1. Allez sur https://nice-river-096898203.3.azurestaticapps.net
2. Créez un compte avec code de vérification
3. Le code sera stocké dans Azure Table Storage ✅
4. Même après redémarrage de l'app, le code existera

### Test 2 : Profils utilisateurs
1. Connectez-vous avec un compte
2. Vos données de profil sont sauvegardées
3. Même après redémarrage, votre profil existe ✅

---

## 📊 Comment vérifier que ça marche ?

### Option A : Via Azure Portal

1. **Storage Account** → `axilumaistorage`
2. **Storage Browser** → **Tables**
3. Vous devriez voir :
   - `VerificationCodes` (codes de vérification)
   - `Users` (profils utilisateurs)
   - `Roles` (rôles assignés)

### Option B : Via logs Azure

1. **Static Web App** → **Application Insights**
2. **Logs** → Cherchez "Azure Table Storage"
3. Vous verrez les opérations de stockage

---

## ⚠️ Si les données sont toujours perdues

### Problème 1 : Variable non prise en compte

**Solution** :
1. Supprimez et recréez la variable
2. Redéployez l'application
3. Attendez 10 minutes

### Problème 2 : Compte de stockage non accessible

**Vérifiez** :
1. Le compte `axilumaistorage` existe
2. Les clés d'accès sont valides
3. Les tables sont créées automatiquement

---

## 💡 Pour tester localement (optionnel)

Si vous voulez tester la persistance en développement :

### Créer un fichier .env local

```bash
cd /workspaces/Axilum/api
cat > .env << 'EOF'
AZURE_STORAGE_CONNECTION_STRING="votre-connection-string-ici"
EOF
```

### Installer dotenv

```bash
npm install dotenv
```

### Modifier les fichiers utils

Ajouter en haut de chaque fichier (`codeStorage.js`, `userStorage.js`, etc.) :

```javascript
require('dotenv').config();
```

### Tester localement

```bash
node test_storage_features.js
```

Vous verrez maintenant :
```
🔌 Stockage Azure: ✅ ACTIVÉ
```

---

## ✅ Résumé

**En production (après configuration dans Azure Portal) :**
- ✅ Données persistantes automatiquement
- ✅ Pas de perte au redémarrage
- ✅ Stockage dans Azure Table Storage

**Aucune modification de code nécessaire** - tout est déjà prêt !

---

## 🔍 Commandes de diagnostic

### Voir si la variable est configurée (production)

Via Azure CLI :
```bash
az staticwebapp appsettings list \
  --name nice-river-096898203 \
  --resource-group <votre-resource-group>
```

### Créer manuellement les tables (si nécessaire)

Via Azure CLI :
```bash
az storage table create \
  --name VerificationCodes \
  --account-name axilumaistorage

az storage table create \
  --name Users \
  --account-name axilumaistorage

az storage table create \
  --name Roles \
  --account-name axilumaistorage
```

Mais normalement, elles sont créées automatiquement au premier usage ! ✅

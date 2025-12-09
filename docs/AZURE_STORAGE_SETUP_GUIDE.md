# 🎯 Guide Complet - Création Storage Account sur Azure Portal

## 📋 Table des Matières
1. [Création du Storage Account](#étape-1-création-du-storage-account)
2. [Récupération de la Connection String](#étape-2-récupération-de-la-connection-string)
3. [Configuration Static Web App](#étape-3-configuration-static-web-app)
4. [Vérification et Tests](#étape-4-vérification-et-tests)

---

## ⚡ Option Rapide : Script Automatisé

```bash
cd /workspaces/azuredev-2641
./setup-azure-storage.sh
```

Ce script:
- ✅ Crée le Storage Account automatiquement
- ✅ Récupère la connection string
- ✅ Met à jour local.settings.json
- ✅ Crée la table 'responsehistory'
- ✅ Vous donne les commandes pour Azure Portal

---

## 🖱️ Option Manuelle : Azure Portal

### Étape 1 : Création du Storage Account

#### 1.1 Accéder à Azure Portal

1. Ouvrez votre navigateur
2. Allez sur: **https://portal.azure.com**
3. Connectez-vous avec votre compte Microsoft

#### 1.2 Créer une nouvelle ressource

1. Cliquez sur **"Créer une ressource"** (bouton bleu en haut à gauche)
   - Ou cliquez sur **"+ Créer"** dans le menu principal
2. Dans la barre de recherche, tapez: **"Compte de stockage"** ou **"Storage account"**
3. Cliquez sur **"Compte de stockage"** dans les résultats
4. Cliquez sur le bouton **"Créer"**

#### 1.3 Configuration de base (Onglet "Basics")

Remplissez les champs suivants:

**Détails du projet:**
- **Abonnement**: Sélectionnez votre abonnement Azure
- **Groupe de ressources**: 
  - Si vous avez déjà un groupe: Sélectionnez-le
  - Sinon: Cliquez sur **"Créer nouveau"** et entrez `axilum-resources`

**Détails de l'instance:**
- **Nom du compte de stockage**: `axilumaistorage` (ou un nom unique)
  - ⚠️ Doit être unique dans tout Azure
  - ⚠️ 3-24 caractères, lettres minuscules et chiffres uniquement
  - Suggestions si pris: `axilumaistorage2025`, `axilumstore`, `axilumdata`

- **Région**: `(Europe) West Europe` ou la région la plus proche
  - 💡 Choisissez la même région que votre Static Web App

- **Performance**: Sélectionnez **"Standard"** ⭐ (Le moins cher)

- **Redondance**: Sélectionnez **"Stockage localement redondant (LRS)"** ⭐ (Le moins cher)
  - Prix: ~0.045$/GB/mois
  - Suffisant pour notre usage

#### 1.4 Configuration avancée (Onglet "Advanced")

**Sécurité:**
- **Require secure transfer (HTTPS)**: ✅ Coché (recommandé)
- **Enable storage account key access**: ✅ Coché
- **Minimum TLS version**: `Version 1.2` (recommandé)

**Data Lake Storage Gen2:**
- **Enable hierarchical namespace**: ❌ Décoché (pas nécessaire)

Laissez les autres options par défaut.

#### 1.5 Réseau (Onglet "Networking")

**Connectivité réseau:**
- Sélectionnez: **"Activer l'accès public à partir de tous les réseaux"**
  - Pour production, vous pourriez le restreindre plus tard

Cliquez sur **"Suivant"**

#### 1.6 Protection des données (Onglet "Data protection")

Laissez les options par défaut (vous pouvez activer la suppression réversible si vous voulez).

Cliquez sur **"Suivant"**

#### 1.7 Chiffrement (Onglet "Encryption")

Laissez les options par défaut:
- **Encryption type**: Microsoft-managed keys (MMK)

Cliquez sur **"Suivant"**

#### 1.8 Vérification et création

1. Cliquez sur **"Vérifier + créer"** (en bas)
2. Attendez la validation (quelques secondes)
3. Vérifiez le résumé:
   - Nom: `axilumaistorage`
   - Performance: Standard
   - Redondance: LRS
   - **Coût estimé**: ~0,05$/mois ⭐
4. Cliquez sur **"Créer"**

⏱️ Le déploiement prend environ **30-60 secondes**.

Attendez le message: **"Votre déploiement a été effectué"**

Cliquez sur **"Accéder à la ressource"**

---

### Étape 2 : Récupération de la Connection String

#### 2.1 Accéder aux clés d'accès

Dans votre Storage Account:

1. Dans le menu de gauche, cherchez la section **"Sécurité + réseau"**
2. Cliquez sur **"Clés d'accès"** (Access keys)
3. Vous verrez 2 clés: **key1** et **key2**

#### 2.2 Copier la connection string

1. Sous **key1**, cliquez sur **"Afficher"** à côté de "Connection string"
2. Cliquez sur l'icône **"Copier"** (📋) à droite de la connection string
3. La connection string est maintenant dans votre presse-papiers

**Format attendu:**
```
DefaultEndpointsProtocol=https;AccountName=axilumaistorage;AccountKey=[REDACTED];EndpointSuffix=core.windows.net
```

⚠️ **Important:** Ne partagez JAMAIS cette clé publiquement!

#### 2.3 Sauvegarder temporairement

Collez la connection string dans un fichier texte temporaire (vous en aurez besoin dans les prochaines étapes).

---

### Étape 3 : Configuration Static Web App

#### 3.1 Trouver votre Static Web App

1. Dans la barre de recherche Azure (en haut), tapez: le nom de votre Static Web App
2. Cliquez sur votre Static Web App dans les résultats

#### 3.2 Ajouter la variable d'environnement

1. Dans le menu de gauche, cliquez sur **"Configuration"**
2. Vous verrez l'onglet **"Application settings"**
3. Vérifiez d'abord que `AZURE_AI_API_KEY` existe:
   - Si elle existe: ✅ Parfait
   - Si elle n'existe pas: Ajoutez-la d'abord (voir section ci-dessous)

#### 3.3 Ajouter AZURE_STORAGE_CONNECTION_STRING

1. Cliquez sur le bouton **"+ Ajouter"** (ou "+ Add")
2. Une fenêtre s'ouvre avec 2 champs:

**Nom (Name):**
```
AZURE_STORAGE_CONNECTION_STRING
```

**Valeur (Value):**
Collez la connection string copiée à l'étape 2.2

3. Cliquez sur **"OK"**
4. ⚠️ **Important:** Cliquez sur **"Enregistrer"** (Save) en haut de la page
5. Confirmez en cliquant sur **"Continuer"** dans la popup

⏱️ Attendez 1-2 minutes pour que les changements se propagent.

#### 3.4 Vérifier AZURE_AI_API_KEY (si nécessaire)

Si `AZURE_AI_API_KEY` n'existe pas, ajoutez-la:

**Nom:**
```
AZURE_AI_API_KEY
```

**Valeur:**
```
[REDACTED_AZURE_AI_API_KEY]
```

N'oubliez pas de cliquer **"Enregistrer"** !

#### 3.5 Résultat final

Vous devriez maintenant avoir 2 variables:

| Nom | Valeur (masquée) | Statut |
|-----|------------------|--------|
| `AZURE_AI_API_KEY` | `2TBSJWPBQPCA...` | ✅ Requis |
| `AZURE_STORAGE_CONNECTION_STRING` | `DefaultEndpoints...` | ✅ Configuré |

---

### Étape 4 : Vérification et Tests

#### 4.1 Vérifier le Storage Account

Retournez dans votre Storage Account:

1. Menu de gauche → **"Navigateur de stockage"** (Storage Browser)
2. Développez **"Tables"**
3. Vous devriez voir:
   - Liste vide pour l'instant (normal)
   - Après le premier appel API, la table `responsehistory` apparaîtra automatiquement

#### 4.2 Tester localement

```bash
# Terminal 1: Mettre à jour local.settings.json
cd /workspaces/azuredev-2641/api

# Ouvrez local.settings.json et ajoutez:
# "AZURE_STORAGE_CONNECTION_STRING": "votre-connection-string"

# Terminal 2: Redémarrer l'API
pkill -9 func
func start

# Terminal 3: Tester
curl -X POST http://localhost:7071/api/agents/axilum/invoke \
  -H "Content-Type: application/json" \
  -d '{"message":"Test Storage"}' | jq '.confidence_metrics.historical_stats'
```

**Résultat attendu:**
```json
{
  "avgConfidence": 0.85,
  "avgValidation": 1.0,
  "sampleSize": 1
}
```

Si `sampleSize` augmente avec chaque appel, **Table Storage fonctionne** ! ✅

#### 4.3 Vérifier dans Azure Portal

Après quelques tests:

1. Storage Account → Storage Browser → Tables
2. Cliquez sur **"responsehistory"** (créée automatiquement)
3. Vous devriez voir vos entrées:
   - `PartitionKey`: "history"
   - `RowKey`: timestamp
   - `confidence`: 0.65-0.85
   - `validation`: 0.9-1.0

#### 4.4 Tester en production

Après avoir poussé votre code:

```bash
# Pousser vers GitHub (déclenche le déploiement)
git push origin main

# Attendre 3-5 minutes

# Tester l'API production
curl -X POST https://votre-app.azurestaticapps.net/api/agents/axilum/invoke \
  -H "Content-Type: application/json" \
  -d '{"message":"Test production"}' | jq '.confidence_metrics'
```

Vérifiez que `historical_stats.sampleSize` augmente entre les appels.

---

## 🎯 Checklist Finale

Cochez chaque étape:

### Création Storage Account
- [ ] Storage Account créé avec succès
- [ ] Nom: `axilumaistorage` (ou similaire)
- [ ] Région: West Europe (ou votre région)
- [ ] Performance: Standard
- [ ] Redondance: LRS
- [ ] Coût: ~0.05$/mois confirmé

### Configuration
- [ ] Connection string copiée
- [ ] `AZURE_STORAGE_CONNECTION_STRING` ajouté dans Static Web App
- [ ] `AZURE_AI_API_KEY` vérifié dans Static Web App
- [ ] Variables sauvegardées (bouton "Enregistrer" cliqué)
- [ ] Attendu 2 minutes pour propagation

### Tests
- [ ] Test local réussi (API démarre sans erreur)
- [ ] `historical_stats` présent dans la réponse
- [ ] `sampleSize` augmente avec chaque appel
- [ ] Table `responsehistory` visible dans Storage Browser
- [ ] Entrées visibles dans la table Azure

### Production
- [ ] Code poussé sur GitHub
- [ ] Build GitHub Actions réussi ✅
- [ ] API production répond correctement
- [ ] Métriques persistées entre les redémarrages

---

## 🚨 Dépannage

### Problème: Connection string ne fonctionne pas

**Symptômes:**
```
⚠️ AZURE_STORAGE_CONNECTION_STRING non configuré, utilisation de la mémoire volatile
```

**Solutions:**
1. Vérifiez que la connection string est complète (commence par `DefaultEndpointsProtocol=https`)
2. Vérifiez qu'il n'y a pas d'espaces au début/fin
3. Dans Azure Portal, regénérez la clé: Storage Account → Access keys → Regenerate key1
4. Recopiez la nouvelle connection string

### Problème: Table ne se crée pas

**Solutions:**
1. Créez-la manuellement:
   ```bash
   az storage table create --name responsehistory \
     --account-name axilumaistorage \
     --connection-string "votre-connection-string"
   ```
2. Ou dans Azure Portal: Storage Account → Tables → + Table → Nom: `responsehistory`

### Problème: Erreur 403 Forbidden

**Solutions:**
1. Vérifiez que "Enable storage account key access" est activé
2. Storage Account → Configuration → Allow storage account key access: ✅ Coché
3. Sauvegardez et attendez 2 minutes

### Problème: Coûts inattendus

**Vérification:**
1. Azure Portal → Cost Management → Cost Analysis
2. Filtrez par Resource: votre Storage Account
3. Coût attendu: < 0.10$/mois pour Table Storage

Si plus cher:
- Vérifiez qu'il n'y a pas de Blob/File storage utilisé
- Vérifiez la redondance: doit être LRS (pas GRS/ZRS)

---

## 📊 Informations Utiles

### Commandes Azure CLI

```bash
# Voir les détails du Storage Account
az storage account show \
  --name axilumaistorage \
  --resource-group axilum-resources

# Lister les tables
az storage table list \
  --account-name axilumaistorage

# Voir les 10 dernières entrées
az storage entity query \
  --table-name responsehistory \
  --account-name axilumaistorage \
  --num-results 10

# Supprimer des anciennes entrées (cleanup)
az storage entity delete \
  --table-name responsehistory \
  --account-name axilumaistorage \
  --partition-key "history" \
  --row-key "XXXXX"
```

### URLs de Gestion

- **Azure Portal**: https://portal.azure.com
- **Storage Account**: https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.Storage%2FStorageAccounts
- **Static Web Apps**: https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.Web%2FStaticSites
- **Cost Management**: https://portal.azure.com/#view/Microsoft_Azure_CostManagement/Menu/~/costanalysis

---

## ✅ Confirmation Finale

Une fois tout configuré, vous devriez voir:

1. ✅ Storage Account visible dans Azure Portal
2. ✅ 2 variables dans Static Web App Configuration
3. ✅ Table `responsehistory` créée automatiquement
4. ✅ Entrées qui s'ajoutent à chaque appel API
5. ✅ `sampleSize` qui augmente dans les réponses
6. ✅ Coût < 0.10$/mois dans Cost Management

**🎉 Félicitations ! Votre Storage Account est configuré et fonctionnel !**

---

**Support:**
- Documentation Azure: https://docs.microsoft.com/azure/storage/
- Support Azure: https://portal.azure.com → Support
- Issues GitHub: https://github.com/zgdsai-cyber/azuredev-2641/issues

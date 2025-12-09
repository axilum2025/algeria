# 🔧 Configuration Complète Azure - Guide Étape par Étape

## Vue d'ensemble

Ce guide vous permet de configurer toutes les ressources Azure nécessaires pour Axilum AI Enhanced.

### Ressources requises
1. ✅ Azure OpenAI (GPT-5.1) - **Déjà configuré**
2. 🆕 Azure Storage Account (Table Storage)
3. ✅ Azure Static Web App - **Déjà configuré**

## 📋 Étape 1 : Créer le Storage Account

### Option A : Via le portail Azure (Recommandé)

1. **Allez sur** [portal.azure.com](https://portal.azure.com)
2. Cliquez sur **"Créer une ressource"**
3. Recherchez **"Compte de stockage"** (Storage Account)
4. Cliquez sur **"Créer"**

**Paramètres** :
- **Abonnement** : Sélectionnez votre abonnement
- **Groupe de ressources** : Utilisez le même que votre Static Web App (ou créez `axilum-resources`)
- **Nom du compte** : `axilumaistorage` (ou autre nom unique)
- **Région** : `West Europe` (même région que vos autres ressources)
- **Performances** : **Standard**
- **Redondance** : **Stockage localement redondant (LRS)** ← Le moins cher

5. Cliquez sur **"Vérifier + créer"** puis **"Créer"**

### Option B : Via Azure CLI

```bash
# 1. Créer le groupe de ressources (si nécessaire)
az group create \
  --name axilum-resources \
  --location westeurope

# 2. Créer le Storage Account
az storage account create \
  --name axilumaistorage \
  --resource-group axilum-resources \
  --location westeurope \
  --sku Standard_LRS \
  --kind StorageV2 \
  --min-tls-version TLS1_2

# 3. Récupérer la connection string
az storage account show-connection-string \
  --name axilumaistorage \
  --resource-group axilum-resources \
  --output tsv
```

**Copiez la connection string** (format : `DefaultEndpointsProtocol=https;AccountName=...`)

## 📋 Étape 2 : Configurer Azure Static Web App

### 2.1 Aller dans votre Static Web App

1. Portail Azure → Recherchez votre Static Web App
2. Menu gauche → **"Configuration"**
3. Onglet **"Application settings"**

### 2.2 Ajouter les variables d'environnement

Cliquez sur **"+ Ajouter"** pour chaque variable :

| Nom | Valeur | Description |
|-----|--------|-------------|
| `AZURE_AI_API_KEY` | `[REDACTED_AZURE_AI_API_KEY]` | Clé API Azure OpenAI |
| `AZURE_STORAGE_CONNECTION_STRING` | `DefaultEndpointsProtocol=https;AccountName=axilumaistorage;AccountKey=[REDACTED]

### 2.3 Sauvegarder

1. Cliquez sur **"Enregistrer"** en haut
2. Attendez ~1-2 minutes pour propagation
3. Les variables seront disponibles au prochain déploiement

## 📋 Étape 3 : Configuration Locale (Développement)

### 3.1 Mettre à jour `api/local.settings.json`

Ajoutez la connection string locale :

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_AI_API_KEY": "[REDACTED_AZURE_AI_API_KEY]",
    "AZURE_STORAGE_CONNECTION_STRING": "DefaultEndpointsProtocol=https;AccountName=axilumaistorage;AccountKey=[REDACTED];EndpointSuffix=core.windows.net"
  }
}
```

⚠️ **Important** : Ce fichier est dans `.gitignore`, ne le commitez jamais !

### 3.2 Alternative : Utiliser Azurite (Émulateur local)

Pour développer sans compte Azure :

```bash
# Installer Azurite globalement
npm install -g azurite

# Démarrer l'émulateur
azurite --silent --location /tmp/azurite &

# Connection string pour Azurite (à utiliser dans local.settings.json)
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=[REDACTED];BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;"
```

## 📋 Étape 4 : Tester la Configuration

### 4.1 Test local

```bash
# Terminal 1 : Démarrer Azurite (optionnel)
azurite --silent &

# Terminal 2 : Démarrer l'API
cd /workspaces/azuredev-2641/api
func start

# Terminal 3 : Tester
curl -X POST http://localhost:7071/api/agents/axilum/invoke \
  -H "Content-Type: application/json" \
  -d '{"message":"Test de configuration"}'
```

**Résultat attendu** :
```
✅ Azure Table Storage initialisé
📥 Cache chargé: 0 entrées
```

### 4.2 Vérifier les logs

Les logs Azure Functions montreront :
```
[2025-12-05T...] ✅ Azure Table Storage initialisé
[2025-12-05T...] 📥 Cache chargé: 0 entrées
[2025-12-05T...] 📊 Confiance estimée (heuristique) : 85.0%
[2025-12-05T...] ✅ Validation réussie : aucune contradiction détectée
```

### 4.3 Vérifier dans Azure Portal

1. Allez dans votre Storage Account
2. Menu gauche → **"Storage Browser"**
3. Sélectionnez **"Tables"**
4. Vous devriez voir la table **"responsehistory"**
5. Cliquez dessus pour voir les entrées

## 📋 Étape 5 : Déploiement sur Azure

### 5.1 Vérifier le workflow GitHub Actions

Le fichier `.github/workflows/deploy.yml` est déjà configuré. Vérifiez qu'il contient :

```yaml
- name: Build And Deploy
  uses: Azure/static-web-apps-deploy@v1
  with:
    azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
    repo_token: ${{ secrets.GITHUB_TOKEN }}
    action: "upload"
    app_location: "/"
    api_location: "api"
    output_location: ""
```

### 5.2 Pousser le code

```bash
cd /workspaces/azuredev-2641
git add -A
git commit -m "Enable Azure Table Storage for production"
git push origin main
```

### 5.3 Suivre le déploiement

1. Allez sur GitHub → Votre repo → **Actions**
2. Cliquez sur le dernier workflow en cours
3. Attendez le succès ✅ (3-5 minutes)

### 5.4 Tester en production

```bash
# Remplacez par votre URL Azure
curl -X POST https://votre-app.azurestaticapps.net/api/agents/axilum/invoke \
  -H "Content-Type: application/json" \
  -d '{"message":"Test production"}'
```

## 📋 Étape 6 : Configuration CORS (Si nécessaire)

Si vous accédez depuis un domaine personnalisé :

### 6.1 Via Azure Portal

1. Storage Account → **"Partage de ressources (CORS)"**
2. Onglet **"Service Table"**
3. Ajoutez une règle :
   - **Origines autorisées** : `https://votre-app.azurestaticapps.net` (ou `*` pour dev)
   - **Méthodes autorisées** : GET, POST
   - **En-têtes autorisés** : `*`
   - **En-têtes exposés** : `*`
   - **Âge maximal** : 3600

### 6.2 Via Azure CLI

```bash
az storage cors add \
  --services t \
  --methods GET POST \
  --origins "https://votre-app.azurestaticapps.net" \
  --allowed-headers "*" \
  --exposed-headers "*" \
  --max-age 3600 \
  --account-name axilumaistorage
```

## 📋 Étape 7 : Monitoring et Maintenance

### 7.1 Activer Application Insights

1. Static Web App → **"Application Insights"**
2. Cliquez sur **"Activer"**
3. Sélectionnez ou créez une ressource Application Insights

**Métriques disponibles** :
- Temps de réponse API
- Taux d'erreur
- Nombre de requêtes
- Confiance moyenne (custom metric)

### 7.2 Configurer les alertes

```bash
# Alerte si taux d'erreur > 5%
az monitor metrics alert create \
  --name "high-error-rate" \
  --resource-group axilum-resources \
  --scopes /subscriptions/.../staticSites/votre-app \
  --condition "avg requests/failed > 5" \
  --description "Taux d'erreur élevé détecté"
```

### 7.3 Nettoyage automatique (Optionnel)

Ajoutez une Azure Function Timer Trigger pour nettoyer l'historique :

```javascript
// api/cleanup/index.js
const responseHistory = require('../utils/tableStorage');

module.exports = async function (context, myTimer) {
    await responseHistory.initialize();
    await responseHistory.cleanup(1000); // Garder 1000 dernières
    context.log('✅ Nettoyage terminé');
};
```

Schedule dans `api/cleanup/function.json` :
```json
{
  "bindings": [
    {
      "name": "myTimer",
      "type": "timerTrigger",
      "direction": "in",
      "schedule": "0 0 2 * * *"
    }
  ]
}
```

## 🔍 Dépannage

### Problème : "AZURE_STORAGE_CONNECTION_STRING non configuré"

**Solution** :
1. Vérifiez que la variable existe dans Azure Portal → Static Web App → Configuration
2. Redéployez l'application (push sur GitHub)
3. Attendez 2 minutes pour propagation

### Problème : "Table 'responsehistory' not found"

**Solution** :
La table est créée automatiquement au premier appel. Si erreur :
```bash
az storage table create \
  --name responsehistory \
  --account-name axilumaistorage
```

### Problème : Erreur 401 Unauthorized

**Solution** :
1. Vérifiez que la connection string est complète (avec AccountKey)
2. Vérifiez que le Storage Account est dans la même région
3. Regénérez la clé dans Portal → Storage Account → Clés d'accès

### Problème : Performance lente

**Solution** :
1. Activez le cache hybride (déjà implémenté dans `tableStorage.js`)
2. Vérifiez la région du Storage Account (doit être proche de la Static Web App)
3. Considérez passer à Redis si latence critique

## 📊 Coûts Estimés Mensuels

| Service | Usage Estimé | Coût/Mois |
|---------|--------------|-----------|
| **Azure OpenAI (GPT-5.1)** | 10K requêtes × 2 appels | ~5-10$ |
| **Azure Static Web App** | Free tier | 0$ |
| **Azure Table Storage** | 1 GB stockage + 10K ops | ~0.05$ |
| **Application Insights** | 5 GB logs | ~2$ (peut être réduit) |
| **TOTAL** | | **~7-12$/mois** |

### Optimisations possibles :
- Réduire les logs Application Insights (50% économie)
- Utiliser cache plus longtemps (réduire appels Table Storage)
- Passer à 1 appel GPT au lieu de 2 si budget serré (-50%)

## ✅ Checklist Finale

Cochez chaque étape complétée :

- [ ] Storage Account créé dans Azure
- [ ] Connection string récupérée
- [ ] Variable `AZURE_STORAGE_CONNECTION_STRING` ajoutée dans Static Web App
- [ ] Variable `AZURE_AI_API_KEY` vérifiée dans Static Web App
- [ ] `api/local.settings.json` mis à jour localement
- [ ] Test local réussi avec Azurite ou vrai Storage Account
- [ ] Code poussé sur GitHub (`git push`)
- [ ] Déploiement GitHub Actions réussi ✅
- [ ] Test production réussi
- [ ] Table `responsehistory` visible dans Storage Browser
- [ ] Application Insights activé (optionnel mais recommandé)
- [ ] CORS configuré si domaine personnalisé (optionnel)

## 🎯 Prochaines Étapes

Une fois tout configuré :

1. **Monitoring** : Consultez Application Insights régulièrement
2. **Optimisation** : Ajustez les seuils adaptatifs selon vos besoins
3. **Scaling** : Si > 100K requêtes/mois, considérez Redis ou Cosmos DB
4. **Backup** : Exportez régulièrement les données de Table Storage
5. **Documentation** : Ajoutez vos URL et ressources dans `README.md`

---

**Besoin d'aide ?** Consultez :
- [Azure Table Storage Docs](https://learn.microsoft.com/azure/storage/tables/)
- [Azure Static Web Apps Docs](https://learn.microsoft.com/azure/static-web-apps/)
- [Azure OpenAI Docs](https://learn.microsoft.com/azure/cognitive-services/openai/)

**Ressources créées** :
- Storage Account : `axilumaistorage`
- Table : `responsehistory`
- Static Web App : [Votre nom]
- Resource Group : `axilum-resources`

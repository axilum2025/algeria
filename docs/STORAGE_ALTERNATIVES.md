# 💰 Alternative Économique à Redis : Azure Table Storage

## Comparaison des Prix

| Solution | Coût Mensuel | Coût Annuel | Notes |
|----------|--------------|-------------|-------|
| **Azure Cache for Redis (Basic)** | ~15$ | ~180$ | Serveur dédié, mémoire volatile |
| **Azure Table Storage** | ~0.045$/GB | ~0.54$/GB | Serverless, persistant |
| **Azure Cosmos DB (Serverless)** | ~0.25$/M ops | Variable | Riche en fonctionnalités |
| **Azure Blob Storage** | ~0.018$/GB | ~0.22$/GB | Le moins cher, lecture/écriture simple |
| **Mémoire volatile (actuel)** | Gratuit | Gratuit | Perte de données au redémarrage |

### Pour 1 GB de données historiques sur 1 an :
- **Redis** : 180$ ❌ Trop cher
- **Table Storage** : 0.54$ ✅ **30x moins cher**
- **Blob Storage** : 0.22$ ✅ Le moins cher mais moins pratique

## 🏆 Recommandation : Azure Table Storage

### Avantages
- ✅ **30x moins cher que Redis** (0.045$/GB vs 15$/mois)
- ✅ **Serverless** : Pas de serveur à gérer
- ✅ **Persistant** : Les données survivent aux redémarrages
- ✅ **Scaling automatique** : Pas de limite de taille
- ✅ **SLA 99.9%** : Haute disponibilité
- ✅ **API simple** : Similaire à Redis/DynamoDB
- ✅ **Transactions** : Support ACID pour les écritures

### Inconvénients
- ⚠️ Pas de tri/agrégation complexe (SQL limité)
- ⚠️ Latence légèrement plus élevée que Redis (~10-20ms vs ~1ms)
- ⚠️ Pas de pub/sub ou queues

## 📦 Installation

```bash
cd api
npm install @azure/data-tables
```

## ⚙️ Configuration Azure

### 1. Créer un compte de stockage

```bash
# Via Azure CLI
az storage account create \
  --name axilumaistorage \
  --resource-group <votre-resource-group> \
  --location westeurope \
  --sku Standard_LRS \
  --kind StorageV2

# Récupérer la connection string
az storage account show-connection-string \
  --name axilumaistorage \
  --resource-group <votre-resource-group>
```

### 2. Configurer la connection string

**Local** (`api/local.settings.json`) :
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_AI_API_KEY": "[REDACTED_AZURE_AI_API_KEY]",
    "AZURE_STORAGE_CONNECTION_STRING": "DefaultEndpointsProtocol=https;AccountName=axilumaistorage;AccountKey=[REDACTED];EndpointSuffix=core.windows.net"
  }
}
```

**Azure Portal** :
1. Allez sur votre Static Web App
2. Configuration → Application settings
3. Ajoutez : `AZURE_STORAGE_CONNECTION_STRING` = `<votre-connection-string>`

## 🚀 Implémentation

Le code a déjà été créé dans `api/utils/tableStorage.js`. Voici comment l'utiliser :

### Intégration dans index.js

```javascript
// Remplacer l'objet responseHistory par :
const responseHistory = require('./utils/tableStorage');

// Au démarrage de la fonction
module.exports = async function (context, req) {
    // Initialiser le storage (une seule fois)
    if (!responseHistory.initialized) {
        await responseHistory.initialize();
    }
    
    // Le reste du code reste identique !
    // responseHistory.add(), getStats(), getAdaptiveThreshold() fonctionnent pareil
}
```

## 🧪 Test Local

```bash
# Démarrer Azurite (émulateur local gratuit)
npm install -g azurite
azurite --silent &

# Connection string pour Azurite
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=[REDACTED];BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;"

# Démarrer l'API
cd api && func start
```

## 📊 Fonctionnement

### Architecture
```
┌─────────────────────┐
│  Azure Function     │
│  (index.js)         │
└──────────┬──────────┘
           │
           │ require('./utils/tableStorage')
           ▼
┌─────────────────────┐
│  tableStorage.js    │
│  ┌───────────────┐  │
│  │ Cache mémoire │  │  ← Lecture rapide (1ms)
│  └───────┬───────┘  │
│          │          │
│          ▼          │
│  ┌───────────────┐  │
│  │ Azure Tables  │  │  ← Écriture async (10-20ms)
│  └───────────────┘  │
└─────────────────────┘
```

### Stratégie Hybride
1. **Lecture** : Cache en mémoire (instant)
2. **Écriture** : 
   - Cache immédiatement mis à jour
   - Table Storage en arrière-plan (non-bloquant)
3. **Redémarrage** : Cache rechargé depuis Table Storage

### Performance
- **Premier appel** : ~50ms (initialisation + chargement cache)
- **Appels suivants** : ~1ms (lecture cache)
- **Écriture** : 0ms bloquant (async en arrière-plan)

## 🔧 Maintenance

### Nettoyage automatique
```javascript
// Appeler périodiquement (1x par jour)
await responseHistory.cleanup(1000); // Garder 1000 dernières entrées
```

### Monitoring
```javascript
// Voir les stats en temps réel
const stats = responseHistory.getStats();
console.log(`📊 Cache: ${stats.sampleSize} entrées`);
console.log(`📊 Confiance moyenne: ${stats.avgConfidence}`);
```

## 💡 Alternative : Blob Storage (Ultra économique)

Si vous voulez le prix le plus bas possible :

```javascript
// Prix: 0.018$/GB (le moins cher)
const { BlobServiceClient } = require('@azure/storage-blob');

// Sauvegarder toutes les 10 requêtes
if (requestCount % 10 === 0) {
    const blobClient = containerClient.getBlockBlobClient('history.json');
    await blobClient.upload(JSON.stringify(responseHistory), data.length);
}

// Charger au démarrage
const downloadResponse = await blobClient.download();
const history = JSON.parse(await streamToString(downloadResponse.readableStreamBody));
```

**Avantages** : Prix imbattable  
**Inconvénients** : Pas de requêtes, juste lecture/écriture de fichiers

## 📈 Évolution vers Cosmos DB

Si vous avez besoin d'analytics complexes plus tard :

```javascript
// Prix: 0.25$/million opérations
const { CosmosClient } = require('@azure/cosmos');

const container = client.database('axilumdb').container('history');

// Requêtes SQL riches
const { resources } = await container.items.query({
    query: "SELECT AVG(c.confidence) as avgConf FROM c WHERE c.timestamp > @date",
    parameters: [{ name: "@date", value: "2025-12-01" }]
}).fetchAll();
```

## 🎯 Coût Estimé pour Votre Usage

### Hypothèses
- 10,000 requêtes/mois
- 1 KB par entrée d'historique
- Garder 1000 dernières entrées

### Table Storage
- **Stockage** : 1 MB = 0.000045$/mois
- **Transactions** : 10,000 écritures = 0.005$/mois
- **Lectures** : 100 lectures (au démarrage) = 0.0001$/mois
- **Total** : **~0.01$/mois** (pratiquement gratuit !)

### Redis Basic
- **Total** : **15$/mois** (1500x plus cher)

## ✅ Recommandation Finale

**Utilisez Azure Table Storage** pour :
- ✅ Budget limité (30x moins cher que Redis)
- ✅ Besoin de persistance simple
- ✅ Pas besoin d'analytics complexes
- ✅ Serverless (pas de gestion de serveur)

**Passez à Redis** seulement si :
- ❌ Vous avez besoin de latence < 5ms (pub/sub, leaderboards)
- ❌ Vous utilisez des structures complexes (sorted sets, streams)
- ❌ Le budget n'est pas une contrainte

---

**Prochaine étape** : Voulez-vous que je mette à jour `api/invoke/index.js` pour utiliser Table Storage au lieu de la mémoire volatile ?

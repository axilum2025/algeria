# 🚀 Alternatives de Déploiement Azure

## Problème rencontré
Le bug persistant d'Azure Static Web Apps avec les "paramètres problématiques" empêche le déploiement même avec un nouveau compte.

## ✅ Solution 1 : Azure App Service (RECOMMANDÉ - Le plus simple)

### Avantages
- ✅ Pas de conteneur à gérer
- ✅ Scaling automatique
- ✅ Facile à configurer
- ✅ Supporte Node.js et Azure Functions
- ✅ SSL gratuit

### Étapes de configuration

#### 1. Créer l'App Service sur Azure Portal
```bash
az login

# Créer le resource group
az group create --name axilum-rg --location francecentral

# Créer l'App Service Plan (gratuit pour commencer)
az appservice plan create \
  --name axilum-plan \
  --resource-group axilum-rg \
  --sku F1 \
  --is-linux


# Créer la Web App
az webapp create \
  --name Axilum \
  --resource-group AxilumRessources \
  --plan axilum-plan \
  --runtime "NODE|20-lts"
```

#### 2. Récupérer le Publish Profile
```bash
az webapp deployment list-publishing-profiles \
  --name Axilum \
  --resource-group AxilumRessources \
  --xml
```

#### 3. Ajouter le secret dans GitHub
- Aller dans Settings → Secrets and variables → Actions
- Créer un nouveau secret : `AZURE_WEBAPP_PUBLISH_PROFILE`
- Coller le contenu XML du publish profile

#### 4. Modifier le workflow
Éditer `.github/workflows/azure-app-service-deploy.yml` :
- Changer `AZURE_WEBAPP_NAME` à `Axilum`

#### 5. Pousser vers GitHub
Le déploiement se fera automatiquement !

---

## 🐳 Solution 2 : Azure Container Apps (Le plus moderne)

### Avantages
- ✅ Basé sur Kubernetes (scaling puissant)
- ✅ Pay-per-use (très économique)
- ✅ Support de microservices
- ✅ HTTPS automatique

### Étapes de configuration

#### 1. Créer Azure Container Registry
```bash
# Créer le registry
az acr create \
  --resource-group axilum-rg \
  --name axilumregistry \
  --sku Basic

# Activer l'admin
az acr update -n axilumregistry --admin-enabled true

# Récupérer les credentials
az acr credential show --name axilumregistry
```

#### 2. Créer Container App Environment
```bash
az containerapp env create \
  --name axilum-env \
  --resource-group axilum-rg \
  --location francecentral
```

#### 3. Créer la Container App
```bash
az containerapp create \
  --name axilum-app \
  --resource-group axilum-rg \
  --environment axilum-env \
  --image axilumregistry.azurecr.io/axilum-app:latest \
  --target-port 8080 \
  --ingress external \
  --registry-server axilumregistry.azurecr.io \
  --min-replicas 0 \
  --max-replicas 5
```

#### 4. Ajouter les secrets GitHub
- `AZURE_REGISTRY_USERNAME` : nom du registry
- `AZURE_REGISTRY_PASSWORD` : password du registry

#### 5. Déployer
Pousser vers GitHub et le workflow construira et déploiera automatiquement !

---

## 📦 Solution 3 : Blob Storage + CDN + Functions séparées

### Avantages
- ✅ Le moins cher (presque gratuit)
- ✅ Performance maximale avec CDN
- ✅ Séparation front/back claire

### Étapes de configuration

#### 1. Créer Storage Account avec Static Website
```bash
# Créer le storage account
az storage account create \
  --name axilumstorageaccount \
  --resource-group axilum-rg \
  --location francecentral \
  --sku Standard_LRS

# Activer le static website
az storage blob service-properties update \
  --account-name axilumstorageaccount \
  --static-website \
  --index-document index.html \
  --404-document index.html
```

#### 2. Créer CDN (optionnel mais recommandé)
```bash
# Créer le profil CDN
az cdn profile create \
  --name axilum-cdn \
  --resource-group axilum-rg \
  --sku Standard_Microsoft

# Créer l'endpoint
az cdn endpoint create \
  --name axilum \
  --profile-name axilum-cdn \
  --resource-group axilum-rg \
  --origin axilumstorageaccount.z16.web.core.windows.net
```

#### 3. Créer Function App pour l'API
```bash
# Créer un storage pour les functions
az storage account create \
  --name axilumfuncstorage \
  --resource-group axilum-rg \
  --location francecentral

# Créer la Function App
az functionapp create \
  --name axilum-functions \
  --storage-account axilumfuncstorage \
  --resource-group axilum-rg \
  --consumption-plan-location francecentral \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4
```

#### 4. Récupérer le publish profile des Functions
```bash
az functionapp deployment list-publishing-profiles \
  --name axilum-functions \
  --resource-group axilum-rg \
  --xml
```

#### 5. Configurer les secrets GitHub
- `AZURE_CREDENTIALS` : Service Principal JSON
- `AZURE_FUNCTIONS_PUBLISH_PROFILE` : Publish profile XML
- `AZURE_RESOURCE_GROUP` : axilum-rg

#### 6. Mettre à jour l'API URL dans votre code
Dans `public/index.html` et autres fichiers :
```javascript
const API_URL = 'https://axilum-functions.azurewebsites.net/api';
```

---

## 🎯 Comparaison rapide

| Solution | Coût/mois | Complexité | Performance | Recommandé pour |
|----------|-----------|------------|-------------|-----------------|
| **App Service** | €12-50 | ⭐ Facile | ⭐⭐⭐ | Production simple |
| **Container Apps** | €5-30 | ⭐⭐ Moyen | ⭐⭐⭐⭐⭐ | Apps modernes |
| **Blob + Functions** | €2-10 | ⭐⭐⭐ Complexe | ⭐⭐⭐⭐ | Budget limité |

---

## 📝 Ma recommandation

### Pour démarrer rapidement : **Azure App Service**
C'est la solution la plus simple et directe. Un seul service à gérer.

### Pour la production long-terme : **Azure Container Apps**  
Meilleur scaling, plus économique à grande échelle, plus moderne.

### Pour un budget minimal : **Blob Storage + Functions**
Le moins cher mais nécessite de gérer deux services séparés.

---

## 🔧 Configuration finale

Après avoir choisi une solution, n'oubliez pas d'ajouter vos variables d'environnement :

```bash
# Pour App Service ou Container Apps
az webapp config appsettings set \
  --name Axilum \
  --resource-group AxilumRessources \
  --settings \
    SENDGRID_API_KEY="your-key" \
    AZURE_STORAGE_ACCOUNT="your-account" \
    AZURE_STORAGE_KEY="your-key"

# Pour Functions
az functionapp config appsettings set \
  --name axilum-functions \
  --resource-group axilum-rg \
  --settings \
    SENDGRID_API_KEY="your-key" \
    AZURE_STORAGE_ACCOUNT="your-account"
```

---

## ✅ Prochaines étapes

1. Choisir une des 3 solutions
2. Suivre les étapes de configuration
3. Désactiver/supprimer les anciens workflows Azure Static Web Apps
4. Tester le déploiement
5. Configurer votre domaine personnalisé si nécessaire

Besoin d'aide pour une solution spécifique ? Dites-moi laquelle vous choisissez ! 🚀

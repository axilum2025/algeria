# 🔴 PROBLÈME: Variables Interdites dans Azure Static Web Apps

## ❌ Erreur Rencontrée

```
Les paramètres d'application avec des noms 
« AzureWebJobsStorage, FUNCTIONS_WORKER_RUNTIME, AzureWebJobsStorageConnectionString » 
ne sont pas autorisés.
```

## 🎯 Cause du Problème

Azure Static Web Apps **gère automatiquement** les Azure Functions intégrées. Les variables suivantes sont **INTERDITES** car elles sont pour Azure Functions standalone :

❌ **VARIABLES INTERDITES** :
- `AzureWebJobsStorage`
- `FUNCTIONS_WORKER_RUNTIME`
- `AzureWebJobsStorageConnectionString`
- `WEBSITE_NODE_DEFAULT_VERSION`
- `FUNCTIONS_EXTENSION_VERSION`

⚠️ **Ces variables causent l'échec du déploiement !**

---

## ✅ SOLUTION COMPLÈTE : Redéploiement Propre

### Étape 1 : Supprimer l'ancienne application

```bash
# Via Azure Portal
1. Allez sur https://portal.azure.com
2. Recherchez votre Static Web App
3. Cliquez "Supprimer"
4. Confirmez

# Ou via CLI
az staticwebapp delete \
  --name Axilum2030 \
  --resource-group Axilum2030_group \
  --yes
```

### Étape 2 : Supprimer l'ancien workflow GitHub

```bash
# Supprimer le fichier workflow
rm .github/workflows/azure-static-web-apps-*.yml

# Commit
git add .github/workflows/
git commit -m "Remove old Azure Static Web App workflow"
git push origin main
```

### Étape 3 : Créer une nouvelle Static Web App (PROPREMENT)

**Option A : Via le script automatique** (Recommandé)

```bash
# Rendre le script exécutable
chmod +x scripts/create-new-static-app.sh

# Créer l'application
export GITHUB_TOKEN=ghp_votre_token_ici
./scripts/create-new-static-app.sh Axilum2030-clean Axilum2030_group westus2
```

**Option B : Manuellement via Azure CLI**

```bash
az staticwebapp create \
  --name Axilum2030-clean \
  --resource-group Axilum2030_group \
  --location westus2 \
  --source https://github.com/axilum2025/Axilum2030 \
  --branch main \
  --app-location "public" \
  --api-location "api" \
  --output-location "" \
  --token ghp_votre_token_ici \
  --sku Free
```

**Option C : Via le portail Azure** (Interface graphique)

1. Allez sur https://portal.azure.com
2. Créez une ressource → "Static Web App"
3. Configurez :
   - **Nom** : Axilum2030-clean
   - **Region** : West US 2
   - **Plan** : Free
   - **Source** : GitHub
   - **Repository** : axilum2025/Axilum2030
   - **Branch** : main
   - **Build Details** :
     - App location: `public`
     - Api location: `api`
     - Output location: *(laisser vide)*

### Étape 4 : Récupérer le Deployment Token

```bash
az staticwebapp secrets list \
  --name Axilum2030-clean \
  --resource-group Axilum2030_group \
  --query "properties.apiKey" -o tsv
```

### Étape 5 : Configurer le Secret GitHub

1. Allez sur https://github.com/axilum2025/Axilum2030/settings/secrets/actions
2. Cliquez "New repository secret"
3. **Nom** : `AZURE_STATIC_WEB_APPS_API_TOKEN_AXILUM2030_CLEAN`
4. **Valeur** : (le token de l'étape 4)
5. Cliquez "Add secret"

### Étape 6 : Créer le nouveau Workflow

Créez `.github/workflows/azure-static-web-apps-clean.yml` :

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true
          lfs: false
      
      - name: Build And Deploy
        id: builddeploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_AXILUM2030_CLEAN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "public"
          api_location: "api"
          output_location: ""
          skip_app_build: true

  close_pull_request_job:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request Job
    steps:
      - name: Close Pull Request
        id: closepullrequest
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_AXILUM2030_CLEAN }}
          action: "close"
          app_location: "public"
```

### Étape 7 : Configurer UNIQUEMENT les variables AUTORISÉES

Créez `.env.azure` :

```bash
# ✅ VARIABLES AUTORISÉES
GROQ_API_KEY=votre_clé
AZURE_STORAGE_CONNECTION_STRING=votre_connection_string
AZURE_COMMUNICATION_CONNECTION_STRING=votre_connection_string
AZURE_COMMUNICATION_SENDER=DoNotReply@votre-domaine.azurecomm.net
BRAVE_API_KEY=votre_clé
AZURE_VISION_ENDPOINT=https://votre-instance.cognitiveservices.azure.com
AZURE_VISION_KEY=votre_clé
GEMINI_API_KEY=votre_clé
GOOGLE_FACT_CHECK_API_KEY=votre_clé
SENDGRID_API_KEY=votre_clé
SENDGRID_SENDER=noreply@axilum.ai

# ❌ NE JAMAIS AJOUTER (INTERDIT):
# AzureWebJobsStorage
# FUNCTIONS_WORKER_RUNTIME
# AzureWebJobsStorageConnectionString
# WEBSITE_NODE_DEFAULT_VERSION
```

Puis configurez :

```bash
./configure-azure-env.sh
```

### Étape 8 : Push et Déploiement

```bash
git add .github/workflows/azure-static-web-apps-clean.yml
git commit -m "Add clean Azure Static Web App workflow - no forbidden variables"
git push origin main
```

---

## 🔍 Vérification du Déploiement

### Vérifier le workflow GitHub Actions

1. Allez sur https://github.com/axilum2025/Axilum2030/actions
2. Vérifiez que le workflow s'exécute sans erreur
3. Attendez la fin du déploiement (⏱️ ~2-3 minutes)

### Vérifier l'application

```bash
# Récupérer l'URL
az staticwebapp show \
  --name Axilum2030-clean \
  --resource-group Axilum2030_group \
  --query "defaultHostname" -o tsv

# Tester
curl https://votre-app.azurestaticapps.net/api/diagnosticEmail
```

### Vérifier qu'aucune variable interdite n'est présente

```bash
az staticwebapp appsettings list \
  --name Axilum2030-clean \
  --resource-group Axilum2030_group \
  --query "properties" -o json | jq 'keys'
```

**✅ Résultat attendu** : Aucune des variables interdites ne doit apparaître.

---

## 🛠️ Scripts Utiles

### Nettoyer les variables interdites (si nécessaire)

```bash
chmod +x scripts/clean-forbidden-settings.sh
./scripts/clean-forbidden-settings.sh Axilum2030-clean Axilum2030_group
```

### Lister les variables actuelles

```bash
az staticwebapp appsettings list \
  --name Axilum2030-clean \
  --resource-group Axilum2030_group \
  --query "properties" -o table
```

---

## 📚 Ressources

- [Azure Static Web Apps - Application Settings](https://docs.microsoft.com/en-us/azure/static-web-apps/application-settings)
- [Différences entre Static Web Apps et Azure Functions](https://docs.microsoft.com/en-us/azure/static-web-apps/apis)
- [Variables interdites](https://docs.microsoft.com/en-us/azure/static-web-apps/configuration#application-settings)

---

## ✅ Checklist Finale

- [ ] Ancienne application supprimée
- [ ] Ancien workflow supprimé
- [ ] Nouvelle application créée (sans variables interdites)
- [ ] Secret GitHub configuré
- [ ] Nouveau workflow créé et poussé
- [ ] Variables autorisées configurées
- [ ] Déploiement réussi
- [ ] Application accessible
- [ ] Aucune variable interdite dans la config
- [ ] APIs fonctionnelles

---

## 🆘 En Cas de Problème

### Erreur persiste après recréation

```bash
# 1. Vérifier les variables
./scripts/clean-forbidden-settings.sh

# 2. Vérifier le workflow
cat .github/workflows/azure-static-web-apps-*.yml

# 3. Redéployer manuellement
az staticwebapp deploy \
  --name Axilum2030-clean \
  --resource-group Axilum2030_group \
  --app-location "public" \
  --api-location "api"
```

### Support Azure

Si le problème persiste, créez un ticket de support Azure avec :
- Nom de l'application
- Resource Group
- Logs d'erreur complets
- Liste des variables configurées

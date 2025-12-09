#!/bin/bash

echo "=========================================="
echo "🚀 Création d'une Nouvelle Static Web App"
echo "=========================================="
echo ""

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier si Azure CLI est connecté
if ! az account show &>/dev/null; then
    echo -e "${RED}❌ Vous devez vous connecter à Azure CLI d'abord${NC}"
    echo "Exécutez : az login"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Azure CLI connecté${NC}"
echo ""

# Variables
APP_NAME="axilum-ai-enhanced"
RESOURCE_GROUP="axilum-resources"
LOCATION="westeurope"
REPO_URL="https://github.com/zgdsai-cyber/azuredev-2641"
BRANCH="main"

echo "📋 Configuration :"
echo "  - Nom de l'app : $APP_NAME"
echo "  - Resource Group : $RESOURCE_GROUP"
echo "  - Location : $LOCATION"
echo "  - Repository : $REPO_URL"
echo ""

# Créer le resource group s'il n'existe pas
echo "🔧 Vérification du Resource Group..."
if ! az group show --name "$RESOURCE_GROUP" &>/dev/null; then
    echo "  📦 Création du Resource Group..."
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$LOCATION"
    echo -e "${GREEN}  ✅ Resource Group créé${NC}"
else
    echo -e "${GREEN}  ✅ Resource Group existe déjà${NC}"
fi
echo ""

# Créer la Static Web App
echo "🌐 Création de la Static Web App..."
STATICWEBAPP_OUTPUT=$(az staticwebapp create \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --source "$REPO_URL" \
    --branch "$BRANCH" \
    --app-location "/" \
    --api-location "api" \
    --output json 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Static Web App créée !${NC}"
    
    # Extraire l'URL et le token
    APP_URL=$(echo "$STATICWEBAPP_OUTPUT" | jq -r '.defaultHostname')
    DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "properties.apiKey" -o tsv)
    
    echo ""
    echo "📊 Informations de déploiement :"
    echo "  🌐 URL : https://$APP_URL"
    echo "  🔑 Deployment Token : $DEPLOYMENT_TOKEN"
    echo ""
else
    echo -e "${RED}❌ Erreur lors de la création${NC}"
    echo "$STATICWEBAPP_OUTPUT"
    exit 1
fi

# Configurer les variables d'environnement Azure
echo "⚙️  Configuration des variables d'environnement..."

# Récupérer les clés Azure existantes (si disponibles)
AZURE_AI_KEY="${AZURE_AI_API_KEY:-[REDACTED_AZURE_AI_API_KEY]}"
AZURE_AI_ENDPOINT="${AZURE_AI_ENDPOINT:-https://models.inference.ai.azure.com}"
AZURE_VISION_KEY="${AZURE_VISION_KEY:-votre-azure-vision-key}"
AZURE_VISION_ENDPOINT="${AZURE_VISION_ENDPOINT:-https://votre-vision-endpoint.cognitiveservices.azure.com}"

# Ajouter les variables d'environnement (UNIQUEMENT celles autorisées)
echo "  🔧 Ajout des variables autorisées..."

az staticwebapp appsettings set \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --setting-names \
        "AZURE_AI_API_KEY=$AZURE_AI_KEY" \
        "AZURE_AI_ENDPOINT=$AZURE_AI_ENDPOINT" \
        "AZURE_VISION_KEY=$AZURE_VISION_KEY" \
        "AZURE_VISION_ENDPOINT=$AZURE_VISION_ENDPOINT" \
        "NODE_ENV=production" \
    --output none

echo -e "${GREEN}✅ Variables d'environnement configurées${NC}"
echo ""

# Mise à jour automatique du workflow GitHub
echo "🔄 Mise à jour du workflow GitHub..."

# Créer un nouveau fichier workflow
cat > .github/workflows/deploy-new.yml << 'WORKFLOW_EOF'
name: Deploy to New Azure Static Web App

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    name: Build and Deploy
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: true

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_NEW }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"
          api_location: "api"
          output_location: ""
          skip_app_build: true
WORKFLOW_EOF

echo -e "${GREEN}✅ Workflow créé : .github/workflows/deploy-new.yml${NC}"
echo ""

# Instructions pour GitHub Secrets
echo "=========================================="
echo "📝 ÉTAPES SUIVANTES - Configuration GitHub"
echo "=========================================="
echo ""
echo "1️⃣  Ajoutez le Deployment Token aux secrets GitHub :"
echo ""
echo "   Allez sur : https://github.com/zgdsai-cyber/azuredev-2641/settings/secrets/actions"
echo ""
echo "   Créez un nouveau secret :"
echo "   - Name: AZURE_STATIC_WEB_APPS_API_TOKEN_NEW"
echo "   - Value: $DEPLOYMENT_TOKEN"
echo ""
echo "2️⃣  Commitez et poussez le nouveau workflow :"
echo ""
echo "   git add .github/workflows/deploy-new.yml"
echo "   git commit -m 'Add new Azure Static Web App deployment'"
echo "   git push origin main"
echo ""
echo "3️⃣  Testez votre nouvelle application :"
echo ""
echo "   https://$APP_URL"
echo ""
echo "=========================================="
echo "🎉 Configuration terminée !"
echo "=========================================="
echo ""
echo "⚠️  NOTE : L'ancienne Static Web App peut être supprimée une fois"
echo "    que la nouvelle fonctionne correctement."
echo ""

# Sauvegarder les informations dans un fichier
cat > DEPLOYMENT_INFO.txt << EOF
Nouvelle Azure Static Web App
========================================

Resource Group: $RESOURCE_GROUP
App Name: $APP_NAME
URL: https://$APP_URL
Location: $LOCATION

Deployment Token: $DEPLOYMENT_TOKEN

Variables d'environnement configurées:
- AZURE_AI_API_KEY
- AZURE_AI_ENDPOINT
- AZURE_VISION_KEY
- AZURE_VISION_ENDPOINT
- NODE_ENV=production

Date de création: $(date)
========================================
EOF

echo "💾 Informations sauvegardées dans : DEPLOYMENT_INFO.txt"
echo ""

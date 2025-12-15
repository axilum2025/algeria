#!/bin/bash
# Script pour créer une nouvelle Azure Static Web App PROPREMENT
# Sans variables interdites

set -e

echo "🚀 CRÉATION NOUVELLE AZURE STATIC WEB APP"
echo "========================================="
echo ""

APP_NAME="${1:-Axilum2030-v2}"
RESOURCE_GROUP="${2:-Axilum2030_group}"
LOCATION="${3:-westus2}"
GITHUB_REPO="axilum2025/Axilum2030"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

echo "📋 Configuration:"
echo "   Nom: $APP_NAME"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Location: $LOCATION"
echo "   Repository: $GITHUB_REPO"
echo ""

# Vérifier si le token est fourni
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GitHub token manquant !"
    echo ""
    echo "Usage:"
    echo "  export GITHUB_TOKEN=ghp_votre_token"
    echo "  ./scripts/create-new-static-app.sh [NOM] [RESOURCE_GROUP] [LOCATION]"
    echo ""
    echo "Ou:"
    echo "  GITHUB_TOKEN=ghp_votre_token ./scripts/create-new-static-app.sh"
    exit 1
fi

# Vérifier si l'app existe déjà
echo "🔍 Vérification si l'application existe déjà..."
if az staticwebapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo "⚠️  L'application '$APP_NAME' existe déjà !"
    echo ""
    read -p "Voulez-vous la supprimer et recréer ? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Suppression de l'application existante..."
        az staticwebapp delete \
            --name "$APP_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --yes
        echo "✅ Application supprimée"
        echo ""
        sleep 5
    else
        echo "❌ Opération annulée"
        exit 1
    fi
fi

# Créer la nouvelle application
echo "🏗️  Création de la nouvelle Static Web App..."
echo ""

az staticwebapp create \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --source "https://github.com/$GITHUB_REPO" \
    --branch main \
    --app-location "public" \
    --api-location "api" \
    --output-location "" \
    --token "$GITHUB_TOKEN" \
    --sku Free

echo ""
echo "✅ Application créée avec succès !"
echo ""

# Récupérer les informations
echo "📋 Informations de l'application:"
APP_INFO=$(az staticwebapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" -o json)
APP_URL=$(echo "$APP_INFO" | jq -r '.defaultHostname')
echo "   URL: https://$APP_URL"
echo ""

# Récupérer le deployment token
echo "🔐 Récupération du deployment token..."
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.apiKey" -o tsv)

echo "   Token: ${DEPLOYMENT_TOKEN:0:20}...${DEPLOYMENT_TOKEN: -10}"
echo ""

# Sauvegarder dans un fichier
echo "💾 Sauvegarde des informations..."
cat > ".azure-app-info.txt" << EOF
Azure Static Web App - Axilum2030
==================================

Nom: $APP_NAME
Resource Group: $RESOURCE_GROUP
Location: $LOCATION
URL: https://$APP_URL

Deployment Token (à ajouter dans GitHub Secrets):
Secret Name: AZURE_STATIC_WEB_APPS_API_TOKEN_$(echo $APP_NAME | tr '[:lower:]' '[:upper:]' | tr '-' '_')
Secret Value: $DEPLOYMENT_TOKEN

Date de création: $(date)
EOF

echo "✅ Informations sauvegardées dans .azure-app-info.txt"
echo ""

echo "📝 PROCHAINES ÉTAPES:"
echo ""
echo "1️⃣  Ajouter le secret GitHub:"
echo "   Nom: AZURE_STATIC_WEB_APPS_API_TOKEN_$(echo $APP_NAME | tr '[:lower:]' '[:upper:]' | tr '-' '_')"
echo "   Valeur: (voir .azure-app-info.txt)"
echo "   URL: https://github.com/$GITHUB_REPO/settings/secrets/actions"
echo ""
echo "2️⃣  Mettre à jour le workflow:"
echo "   Fichier: .github/workflows/azure-static-web-apps-*.yml"
echo "   Modifier: azure_static_web_apps_api_token"
echo ""
echo "3️⃣  Configurer les variables d'environnement:"
echo "   ./configure-azure-env.sh"
echo ""
echo "⚠️  NE JAMAIS ajouter ces variables (interdites):"
echo "   ❌ AzureWebJobsStorage"
echo "   ❌ FUNCTIONS_WORKER_RUNTIME"
echo "   ❌ AzureWebJobsStorageConnectionString"
echo "   ❌ WEBSITE_NODE_DEFAULT_VERSION"
echo ""
echo "🎉 Création terminée !"

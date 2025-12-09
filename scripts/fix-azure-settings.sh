#!/bin/bash

echo "=========================================="
echo "🔧 Script de Correction Azure Settings"
echo "=========================================="
echo ""

# Vérifier si Azure CLI est connecté
if ! az account show &>/dev/null; then
    echo "❌ Vous devez vous connecter à Azure CLI d'abord :"
    echo "   az login"
    echo ""
    exit 1
fi

echo "✅ Azure CLI connecté"
echo ""

# Trouver le resource group
echo "🔍 Recherche de la Static Web App..."
RESOURCE_GROUP=$(az staticwebapp list --query "[?name=='proud-mushroom-019836d03'].resourceGroup" -o tsv)

if [ -z "$RESOURCE_GROUP" ]; then
    echo "❌ Static Web App 'proud-mushroom-019836d03' non trouvée"
    echo "   Vérifiez que vous êtes connecté au bon compte Azure"
    exit 1
fi

echo "✅ Resource Group trouvé : $RESOURCE_GROUP"
echo ""

# Lister les paramètres actuels
echo "📋 Paramètres d'application actuels :"
az staticwebapp appsettings list \
  --name proud-mushroom-019836d03 \
  --resource-group "$RESOURCE_GROUP" \
  --output table

echo ""
echo "🗑️  Suppression des paramètres interdits..."

# Supprimer les paramètres interdits
az staticwebapp appsettings delete \
  --name proud-mushroom-019836d03 \
  --resource-group "$RESOURCE_GROUP" \
  --setting-names AzureWebJobsStorage FUNCTIONS_WORKER_RUNTIME WEBSITE_NODE_DEFAULT_VERSION 2>/dev/null

echo ""
echo "✅ Paramètres supprimés !"
echo ""
echo "📋 Nouveaux paramètres :"
az staticwebapp appsettings list \
  --name proud-mushroom-019836d03 \
  --resource-group "$RESOURCE_GROUP" \
  --output table

echo ""
echo "=========================================="
echo "✅ Configuration corrigée !"
echo "=========================================="
echo ""
echo "Prochaines étapes :"
echo "1. Forcez un nouveau déploiement :"
echo "   git commit --allow-empty -m 'Redeploy after fixing settings'"
echo "   git push origin main"
echo ""
echo "2. Attendez 2-3 minutes"
echo ""
echo "3. Testez l'application :"
echo "   curl -s https://proud-mushroom-019836d03.3.azurestaticapps.net/version.json"
echo ""

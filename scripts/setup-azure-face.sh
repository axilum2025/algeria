#!/bin/bash

# Script de création et configuration Azure Face API
# Usage: ./scripts/setup-azure-face.sh

set -e

echo "🤖 Configuration Azure Face API pour Axilum2030"
echo "==============================================="
echo ""

# Configuration
RESOURCE_GROUP="Axilum2030_group"
STATIC_WEB_APP="Axilum2030"
FACE_RESOURCE_NAME="Axilum2030-Face"
LOCATION="francecentral"  # ou "eastus", "westeurope", etc.
SKU="F0"  # F0 = Free tier, S0 = Standard

echo "📋 Configuration:"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Static Web App: $STATIC_WEB_APP"
echo "   Face Resource: $FACE_RESOURCE_NAME"
echo "   Location: $LOCATION"
echo "   SKU: $SKU (F0=Free, S0=Standard)"
echo ""

# Vérifier si Azure CLI est installé
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI n'est pas installé"
    echo "   Installez-le: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

# Vérifier la connexion Azure
echo "🔐 Vérification de la connexion Azure..."
if ! az account show &> /dev/null; then
    echo "❌ Non connecté à Azure"
    echo "   Exécutez: az login"
    exit 1
fi

ACCOUNT=$(az account show --query name -o tsv)
echo "✅ Connecté en tant que: $ACCOUNT"
echo ""

# Vérifier si le resource group existe
echo "🔍 Vérification du resource group..."
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    echo "❌ Resource group '$RESOURCE_GROUP' introuvable"
    echo ""
    echo "Créez-le avec:"
    echo "   az group create --name $RESOURCE_GROUP --location $LOCATION"
    exit 1
fi
echo "✅ Resource group trouvé"
echo ""

# Vérifier si la ressource Face existe déjà
echo "🔍 Vérification de la ressource Face existante..."
if az cognitiveservices account show \
    --name "$FACE_RESOURCE_NAME" \
    --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo "⚠️  Ressource Face '$FACE_RESOURCE_NAME' existe déjà"
    echo ""
    read -p "Voulez-vous utiliser la ressource existante ? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Arrêt du script"
        exit 1
    fi
    echo "✅ Utilisation de la ressource existante"
else
    # Créer la ressource Face
    echo "🚀 Création de la ressource Azure Face API..."
    echo "   Cela peut prendre 1-2 minutes..."
    echo ""
    
    az cognitiveservices account create \
        --name "$FACE_RESOURCE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --kind Face \
        --sku "$SKU" \
        --location "$LOCATION" \
        --yes
    
    echo ""
    echo "✅ Ressource Face créée avec succès!"
fi

echo ""

# Récupérer l'endpoint
echo "📥 Récupération de l'endpoint..."
FACE_ENDPOINT=$(az cognitiveservices account show \
    --name "$FACE_RESOURCE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.endpoint" \
    --output tsv)

if [ -z "$FACE_ENDPOINT" ]; then
    echo "❌ Impossible de récupérer l'endpoint"
    exit 1
fi

echo "✅ Endpoint: $FACE_ENDPOINT"

# Récupérer la clé
echo "📥 Récupération de la clé d'accès..."
FACE_KEY=$(az cognitiveservices account keys list \
    --name "$FACE_RESOURCE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "key1" \
    --output tsv)

if [ -z "$FACE_KEY" ]; then
    echo "❌ Impossible de récupérer la clé"
    exit 1
fi

echo "✅ Clé: ${FACE_KEY:0:20}..."
echo ""

# Configurer dans Azure Static Web App
echo "☁️  Configuration dans Azure Static Web App..."
echo ""

az staticwebapp appsettings set \
    --name "$STATIC_WEB_APP" \
    --resource-group "$RESOURCE_GROUP" \
    --setting-names \
        AZURE_FACE_KEY="$FACE_KEY" \
        AZURE_FACE_ENDPOINT="$FACE_ENDPOINT"

echo ""
echo "✅ Variables configurées dans Azure Static Web App"
echo ""

# Mise à jour du fichier .env.azure (optionnel)
if [ -f ".env.azure" ]; then
    echo "📝 Mise à jour de .env.azure..."
    
    # Backup
    cp .env.azure .env.azure.backup
    
    # Supprimer les anciennes entrées Face si elles existent
    sed -i '/^AZURE_FACE_KEY=/d' .env.azure
    sed -i '/^AZURE_FACE_ENDPOINT=/d' .env.azure
    
    # Ajouter les nouvelles valeurs
    echo "" >> .env.azure
    echo "# Azure Face API (créé le $(date +%Y-%m-%d))" >> .env.azure
    echo "AZURE_FACE_KEY=$FACE_KEY" >> .env.azure
    echo "AZURE_FACE_ENDPOINT=$FACE_ENDPOINT" >> .env.azure
    
    echo "✅ .env.azure mis à jour (backup: .env.azure.backup)"
else
    echo "ℹ️  Créez un fichier .env.azure pour sauvegarder les credentials"
fi

# Mise à jour du fichier api/.env.local (optionnel)
if [ -f "api/.env.local" ]; then
    echo "📝 Mise à jour de api/.env.local..."
    
    # Backup
    cp api/.env.local api/.env.local.backup
    
    # Supprimer les anciennes entrées Face si elles existent
    sed -i '/^AZURE_FACE_KEY=/d' api/.env.local
    sed -i '/^AZURE_FACE_ENDPOINT=/d' api/.env.local
    sed -i '/^APPSETTING_AZURE_FACE_KEY=/d' api/.env.local
    sed -i '/^APPSETTING_AZURE_FACE_ENDPOINT=/d' api/.env.local
    
    # Ajouter les nouvelles valeurs
    echo "" >> api/.env.local
    echo "# Azure Face API (créé le $(date +%Y-%m-%d))" >> api/.env.local
    echo "AZURE_FACE_KEY=$FACE_KEY" >> api/.env.local
    echo "AZURE_FACE_ENDPOINT=$FACE_ENDPOINT" >> api/.env.local
    
    echo "✅ api/.env.local mis à jour (backup: api/.env.local.backup)"
else
    echo "⚠️  api/.env.local non trouvé - créez-le depuis api/.env.local.example"
fi

echo ""
echo "🎉 Configuration terminée avec succès!"
echo ""
echo "📊 Résumé:"
echo "   Resource: $FACE_RESOURCE_NAME"
echo "   Endpoint: $FACE_ENDPOINT"
echo "   Key: ${FACE_KEY:0:20}..."
echo "   SKU: $SKU"
echo ""
echo "🧪 Tests:"
echo "   # Test local"
echo "   ./test-vision-config.sh"
echo "   npm run dev"
echo ""
echo "   # Test Azure"
echo "   curl https://Axilum2030.azurestaticapps.net/api/vision-face \\"
echo "     -X POST -H 'Content-Type: application/json' \\"
echo "     -d '{\"imageBase64\":\"...\"}"
echo ""
echo "📚 Documentation:"
echo "   - GUIDE_CONFIG_VISION_SEARCH.md"
echo "   - https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-identity"
echo ""
echo "⚠️  Important:"
echo "   Le tier gratuit (F0) a des limites:"
echo "   - 20 transactions/minute"
echo "   - 30,000 transactions/mois"
echo ""
echo "   Pour augmenter les limites, utilisez SKU=S0:"
echo "   az cognitiveservices account update \\"
echo "     --name $FACE_RESOURCE_NAME \\"
echo "     --resource-group $RESOURCE_GROUP \\"
echo "     --sku S0"
echo ""

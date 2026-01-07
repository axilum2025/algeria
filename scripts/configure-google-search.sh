#!/bin/bash

# Script de configuration Google Custom Search dans Azure Static Web App
# Usage: ./scripts/configure-google-search.sh

set -e

echo "🔍 Configuration Google Custom Search pour Axilum2030"
echo "======================================================"
echo ""

# Configuration
RESOURCE_GROUP="Axilum2030_group"
STATIC_WEB_APP="Axilum2030"

echo "📋 Configuration:"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Static Web App: $STATIC_WEB_APP"
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

# Demander les credentials Google
echo "🔑 Credentials Google Custom Search requis"
echo ""
echo "Pour obtenir vos credentials:"
echo "1. API Key: https://console.cloud.google.com/"
echo "   → APIs & Services → Credentials → Create Credentials → API Key"
echo "   → Activez 'Custom Search API'"
echo ""
echo "2. Search Engine ID (cx): https://programmablesearchengine.google.com/"
echo "   → Create → Configure → Get code"
echo ""

read -p "Entrez votre GOOGLE_SEARCH_API_KEY: " GOOGLE_API_KEY
read -p "Entrez votre GOOGLE_SEARCH_CX: " GOOGLE_CX

if [ -z "$GOOGLE_API_KEY" ] || [ -z "$GOOGLE_CX" ]; then
    echo "❌ Les deux valeurs sont requises"
    exit 1
fi

echo ""
echo "✅ Credentials reçus"
echo "   API Key: ${GOOGLE_API_KEY:0:20}..."
echo "   CX: $GOOGLE_CX"
echo ""

# Configurer dans Azure Static Web App
echo "☁️  Configuration dans Azure Static Web App..."
echo ""

az staticwebapp appsettings set \
    --name "$STATIC_WEB_APP" \
    --resource-group "$RESOURCE_GROUP" \
    --setting-names \
        GOOGLE_SEARCH_API_KEY="$GOOGLE_API_KEY" \
        GOOGLE_SEARCH_CX="$GOOGLE_CX"

echo ""
echo "✅ Variables configurées dans Azure Static Web App"
echo ""

# Mise à jour du fichier .env.azure (optionnel)
if [ -f ".env.azure" ]; then
    echo "📝 Mise à jour de .env.azure..."
    
    # Backup
    cp .env.azure .env.azure.backup
    
    # Supprimer les anciennes entrées si elles existent
    sed -i '/^GOOGLE_SEARCH_API_KEY=/d' .env.azure
    sed -i '/^GOOGLE_SEARCH_CX=/d' .env.azure
    
    # Ajouter les nouvelles valeurs
    echo "" >> .env.azure
    echo "# Google Custom Search (créé le $(date +%Y-%m-%d))" >> .env.azure
    echo "GOOGLE_SEARCH_API_KEY=$GOOGLE_API_KEY" >> .env.azure
    echo "GOOGLE_SEARCH_CX=$GOOGLE_CX" >> .env.azure
    
    echo "✅ .env.azure mis à jour (backup: .env.azure.backup)"
fi

# Mise à jour du fichier api/.env.local (optionnel)
if [ -f "api/.env.local" ]; then
    echo "📝 Mise à jour de api/.env.local..."
    
    # Backup
    cp api/.env.local api/.env.local.backup
    
    # Supprimer les anciennes entrées si elles existent
    sed -i '/^GOOGLE_SEARCH_API_KEY=/d' api/.env.local
    sed -i '/^GOOGLE_SEARCH_CX=/d' api/.env.local
    sed -i '/^APPSETTING_GOOGLE_SEARCH_API_KEY=/d' api/.env.local
    sed -i '/^APPSETTING_GOOGLE_SEARCH_CX=/d' api/.env.local
    
    # Ajouter les nouvelles valeurs
    echo "" >> api/.env.local
    echo "# Google Custom Search (créé le $(date +%Y-%m-%d))" >> api/.env.local
    echo "GOOGLE_SEARCH_API_KEY=$GOOGLE_API_KEY" >> api/.env.local
    echo "GOOGLE_SEARCH_CX=$GOOGLE_CX" >> api/.env.local
    
    echo "✅ api/.env.local mis à jour (backup: api/.env.local.backup)"
fi

echo ""
echo "🎉 Configuration terminée avec succès!"
echo ""
echo "📊 Résumé:"
echo "   API Key: ${GOOGLE_API_KEY:0:20}..."
echo "   CX: $GOOGLE_CX"
echo ""
echo "🧪 Tests:"
echo "   # Test local"
echo "   ./test-vision-config.sh"
echo "   npm run dev"
echo ""
echo "   # Test Azure"
echo "   curl https://Axilum2030.azurestaticapps.net/api/vision-reverse-google \\"
echo "     -X POST -H 'Content-Type: application/json' \\"
echo "     -d '{\"imageBase64\":\"...\"}"
echo ""
echo "⚠️  Limites du tier gratuit:"
echo "   - 100 requêtes/jour"
echo "   - 10,000 requêtes/jour (avec facturation)"
echo ""

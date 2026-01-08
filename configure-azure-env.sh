#!/bin/bash

# Script de configuration des variables d'environnement pour Azure Static Web App
# Usage: ./configure-azure-env.sh [APP_NAME] [RESOURCE_GROUP] [ENV_FILE]

set -euo pipefail

APP_NAME="${1:-Axilum2030}"
RESOURCE_GROUP="${2:-Axilum2030_group}"
ENV_FILE="${3:-.env.azure}"

echo "🔧 Configuration des variables d'environnement pour Axilum2030"
echo "=============================================================="
echo ""
echo "⚠️  IMPORTANT : Azure Static Web Apps INTERDIT ces variables:"
echo "   ❌ AzureWebJobsStorage"
echo "   ❌ FUNCTIONS_WORKER_RUNTIME"
echo "   ❌ AzureWebJobsStorageConnectionString"
echo "   ❌ WEBSITE_NODE_DEFAULT_VERSION"
echo ""
echo "   Ces variables sont gérées automatiquement par Azure."
echo "   Ne les ajoutez JAMAIS manuellement !"
echo ""

# Vérifier si le fichier d'env existe
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Fichier $ENV_FILE non trouvé!"
    echo ""
    echo "Créez un fichier $ENV_FILE avec vos variables:"
    echo ""
    cat << 'EOF'
# .env.azure - Variables AUTORISÉES pour Azure Static Web Apps
GROQ_API_KEY=votre_clé_groq
AZURE_STORAGE_CONNECTION_STRING=votre_connection_string
AZURE_COMMUNICATION_CONNECTION_STRING=votre_connection_string
AZURE_COMMUNICATION_SENDER=DoNotReply@votre-domaine.azurecomm.net
BRAVE_API_KEY=votre_clé_brave
AZURE_VISION_ENDPOINT=https://votre-instance.cognitiveservices.azure.com
AZURE_VISION_KEY=votre_clé_vision
GEMINI_API_KEY=votre_clé_gemini
GOOGLE_FACT_CHECK_API_KEY=votre_clé_factcheck
GOOGLE_SEARCH_API_KEY=votre_clé_google_search
GOOGLE_SEARCH_CX=votre_custom_search_engine_id
AZURE_FACE_KEY=votre_clé_face_api
AZURE_FACE_ENDPOINT=https://votre-instance.cognitiveservices.azure.com
SENDGRID_API_KEY=votre_clé_sendgrid
SENDGRID_SENDER=noreply@axilum.ai

# ⚠️ NE PAS AJOUTER ces variables (interdites):
# AzureWebJobsStorage
# FUNCTIONS_WORKER_RUNTIME
# AzureWebJobsStorageConnectionString
# WEBSITE_NODE_DEFAULT_VERSION
EOF
    exit 1
fi

# Charger les variables
echo "📥 Chargement des variables depuis $ENV_FILE..."
# shellcheck disable=SC1090
source "$ENV_FILE"

# Vérifier les variables essentielles
echo "🔍 Vérification des variables essentielles..."
MISSING=0

if [ -z "${GROQ_API_KEY:-}" ]; then
    echo "❌ GROQ_API_KEY manquant"
    MISSING=1
fi

if [ -z "${AZURE_STORAGE_CONNECTION_STRING:-}" ]; then
    echo "⚠️  AZURE_STORAGE_CONNECTION_STRING manquant (optionnel mais recommandé)"
fi

if [ $MISSING -eq 1 ]; then
    echo ""
    echo "❌ Certaines variables essentielles sont manquantes!"
    exit 1
fi

echo "✅ Variables vérifiées"
echo ""

# Configuration dans Azure
echo "☁️  Configuration dans Azure Static Web App..."
echo ""

# Construction de la commande avec toutes les variables non vides
SETTINGS=()

[ -n "${GROQ_API_KEY:-}" ] && SETTINGS+=("GROQ_API_KEY=$GROQ_API_KEY")
[ -n "${AZURE_STORAGE_CONNECTION_STRING:-}" ] && SETTINGS+=("AZURE_STORAGE_CONNECTION_STRING=$AZURE_STORAGE_CONNECTION_STRING")
[ -n "${AZURE_COMMUNICATION_CONNECTION_STRING:-}" ] && SETTINGS+=("AZURE_COMMUNICATION_CONNECTION_STRING=$AZURE_COMMUNICATION_CONNECTION_STRING")
[ -n "${AZURE_COMMUNICATION_SENDER:-}" ] && SETTINGS+=("AZURE_COMMUNICATION_SENDER=$AZURE_COMMUNICATION_SENDER")
[ -n "${BRAVE_API_KEY:-}" ] && SETTINGS+=("BRAVE_API_KEY=$BRAVE_API_KEY")
[ -n "${AZURE_VISION_ENDPOINT:-}" ] && SETTINGS+=("AZURE_VISION_ENDPOINT=$AZURE_VISION_ENDPOINT")
[ -n "${AZURE_VISION_KEY:-}" ] && SETTINGS+=("AZURE_VISION_KEY=$AZURE_VISION_KEY")
[ -n "${GEMINI_API_KEY:-}" ] && SETTINGS+=("GEMINI_API_KEY=$GEMINI_API_KEY")
[ -n "${GOOGLE_FACT_CHECK_API_KEY:-}" ] && SETTINGS+=("GOOGLE_FACT_CHECK_API_KEY=$GOOGLE_FACT_CHECK_API_KEY")
[ -n "${GOOGLE_SEARCH_API_KEY:-}" ] && SETTINGS+=("GOOGLE_SEARCH_API_KEY=$GOOGLE_SEARCH_API_KEY")
[ -n "${GOOGLE_SEARCH_CX:-}" ] && SETTINGS+=("GOOGLE_SEARCH_CX=$GOOGLE_SEARCH_CX")
[ -n "${AZURE_FACE_KEY:-}" ] && SETTINGS+=("AZURE_FACE_KEY=$AZURE_FACE_KEY")
[ -n "${AZURE_FACE_ENDPOINT:-}" ] && SETTINGS+=("AZURE_FACE_ENDPOINT=$AZURE_FACE_ENDPOINT")
[ -n "${SENDGRID_API_KEY:-}" ] && SETTINGS+=("SENDGRID_API_KEY=$SENDGRID_API_KEY")
[ -n "${SENDGRID_SENDER:-}" ] && SETTINGS+=("SENDGRID_SENDER=$SENDGRID_SENDER")

if [ ${#SETTINGS[@]} -eq 0 ]; then
    echo "❌ Aucune variable à configurer (fichier env vide ?)"
    exit 1
fi

# Exécuter la commande
az staticwebapp appsettings set \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --setting-names "${SETTINGS[@]}"

echo ""
echo "✅ Configuration terminée!"
echo ""
echo "🔍 Vérification de la configuration..."
az staticwebapp appsettings list \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
  --query "properties" \
  --output table

echo ""
echo "🎉 Configuration complète!"
echo ""
echo "🧪 Pour tester:"
echo "  curl https://votre-app.azurestaticapps.net/api/diagnosticEmail"
echo "  curl https://votre-app.azurestaticapps.net/api/testConfig"
echo ""
echo "⚠️  Si vous voyez des erreurs sur variables interdites:"
echo "   Exécutez: ./scripts/clean-forbidden-settings.sh"

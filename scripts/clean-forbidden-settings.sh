#!/bin/bash
# Script pour supprimer les variables INTERDITES d'Azure Static Web Apps
# Ces variables causent l'erreur: "Les paramètres d'application ne sont pas autorisés"

set -e

echo "🧹 NETTOYAGE DES VARIABLES INTERDITES"
echo "======================================"
echo ""

APP_NAME="${1:-Axilum2030}"
RESOURCE_GROUP="${2:-Axilum2030_group}"

echo "📋 Configuration:"
echo "   App: $APP_NAME"
echo "   Resource Group: $RESOURCE_GROUP"
echo ""

# Liste des variables INTERDITES pour Azure Static Web Apps
FORBIDDEN_VARS=(
    "AzureWebJobsStorage"
    "FUNCTIONS_WORKER_RUNTIME"
    "AzureWebJobsStorageConnectionString"
    "WEBSITE_NODE_DEFAULT_VERSION"
    "FUNCTIONS_EXTENSION_VERSION"
    "FUNCTIONS_API_KEY"
    "FUNCTIONS_BASE_URL"
)

echo "⚠️  Ces variables sont INTERDITES dans Azure Static Web Apps:"
for var in "${FORBIDDEN_VARS[@]}"; do
    echo "   ❌ $var"
done
echo ""
echo "💡 Pourquoi ? Azure Static Web Apps gère automatiquement les Functions."
echo "   Ces variables sont uniquement pour Azure Functions standalone."
echo ""

# Vérifier si l'app existe
echo "🔍 Vérification de l'existence de l'application..."
if ! az staticwebapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo "❌ L'application '$APP_NAME' n'existe pas ou n'est pas accessible."
    echo ""
    echo "📝 Créez d'abord l'application:"
    echo "   ./scripts/create-new-static-app.sh"
    exit 1
fi

echo "✅ Application trouvée"
echo ""

# Lister les variables actuelles
echo "📋 Variables actuellement configurées:"
az staticwebapp appsettings list \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties" \
    -o json | jq -r 'keys[]' 2>/dev/null || echo "(aucune)"
echo ""

# Supprimer chaque variable interdite
echo "🗑️  Suppression des variables interdites..."
DELETED=0

for var in "${FORBIDDEN_VARS[@]}"; do
    echo -n "   → $var ... "
    
    if az staticwebapp appsettings delete \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --setting-names "$var" &>/dev/null; then
        echo "✅ Supprimé"
        DELETED=$((DELETED + 1))
    else
        echo "⚠️  N'existe pas"
    fi
done

echo ""
if [ $DELETED -gt 0 ]; then
    echo "✅ $DELETED variable(s) supprimée(s)"
else
    echo "✅ Aucune variable interdite trouvée"
fi

echo ""
echo "📋 Variables restantes (autorisées):"
az staticwebapp appsettings list \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties" \
    -o json | jq -r 'keys[]' 2>/dev/null || echo "(aucune)"

echo ""
echo "🎉 Nettoyage terminé !"
echo ""
echo "💡 Prochaine étape:"
echo "   Configurez vos variables autorisées avec:"
echo "   ./configure-azure-env.sh"

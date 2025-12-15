#!/bin/bash

# Script de monitoring des variables interdites
# Vérifie régulièrement qu'aucune variable interdite n'apparaît

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables interdites à surveiller
FORBIDDEN_VARS=(
    "AzureWebJobsStorage"
    "FUNCTIONS_WORKER_RUNTIME"
    "AzureWebJobsStorageConnectionString"
    "WEBSITE_NODE_DEFAULT_VERSION"
)

echo "🔍 Monitoring des variables interdites"
echo "======================================"
echo ""

# Trouver toutes les Static Web Apps Axilum
APPS=$(az staticwebapp list -o json | jq -r '.[] | select(.resourceGroup | ascii_downcase | contains("axilum")) | .name')

if [ -z "$APPS" ]; then
    echo -e "${RED}❌ Aucune Static Web App trouvée${NC}"
    exit 1
fi

TOTAL_ISSUES=0

for APP_NAME in $APPS; do
    echo -e "\n📱 Application: ${YELLOW}$APP_NAME${NC}"
    echo "-----------------------------------"
    
    # Récupérer toutes les variables
    SETTINGS=$(az staticwebapp appsettings list --name "$APP_NAME" -o json 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Erreur lors de la récupération des variables${NC}"
        continue
    fi
    
    # Vérifier chaque variable interdite
    ISSUES_FOUND=0
    for FORBIDDEN_VAR in "${FORBIDDEN_VARS[@]}"; do
        if echo "$SETTINGS" | jq -e ".properties.\"$FORBIDDEN_VAR\"" > /dev/null 2>&1; then
            echo -e "${RED}❌ VARIABLE INTERDITE DÉTECTÉE: $FORBIDDEN_VAR${NC}"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
            TOTAL_ISSUES=$((TOTAL_ISSUES + 1))
        fi
    done
    
    if [ $ISSUES_FOUND -eq 0 ]; then
        echo -e "${GREEN}✅ Aucune variable interdite${NC}"
        
        # Lister les variables présentes
        VAR_COUNT=$(echo "$SETTINGS" | jq -r '.properties | keys | length')
        echo "   Variables configurées: $VAR_COUNT"
        echo "$SETTINGS" | jq -r '.properties | keys[]' | while read -r var; do
            echo "   - $var"
        done
    else
        echo -e "${RED}   Total issues: $ISSUES_FOUND${NC}"
    fi
done

echo ""
echo "======================================"
if [ $TOTAL_ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ Tout est OK ! Aucune variable interdite détectée${NC}"
    exit 0
else
    echo -e "${RED}❌ $TOTAL_ISSUES variable(s) interdite(s) détectée(s)${NC}"
    echo ""
    echo "Actions recommandées :"
    echo "1. Exécuter: ./scripts/clean-forbidden-settings.sh"
    echo "2. Vérifier le host.json utilise Extension Bundle v3.x"
    echo "3. Consulter: FORBIDDEN_VARIABLES_ROOT_CAUSE.md"
    exit 1
fi

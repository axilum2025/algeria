#!/bin/bash

# Script de configuration Azure Storage - Guide interactif
# Ce script vous guide dans la création et configuration du Storage Account

set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Configuration Azure Storage Account - Guide Complet   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Fonction pour afficher les étapes
step() {
    echo -e "${GREEN}➜${NC} $1"
}

info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# Vérifier si Azure CLI est installé
if ! command -v az &> /dev/null; then
    error "Azure CLI n'est pas installé"
    echo ""
    echo "Installation via:"
    echo "  curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
    echo ""
    echo "Ou suivez le guide Azure Portal ci-dessous..."
    exit 0
fi

success "Azure CLI détecté"
echo ""

# Vérifier si connecté
if ! az account show &> /dev/null; then
    info "Vous n'êtes pas connecté à Azure"
    echo ""
    step "Connectez-vous maintenant:"
    az login
    echo ""
fi

# Récupérer l'abonnement actuel
SUBSCRIPTION=$(az account show --query name -o tsv 2>/dev/null)
SUBSCRIPTION_ID=$(az account show --query id -o tsv 2>/dev/null)

if [ -z "$SUBSCRIPTION" ]; then
    error "Impossible de récupérer l'abonnement Azure"
    exit 1
fi

success "Connecté à Azure"
info "Abonnement: $SUBSCRIPTION"
info "ID: $SUBSCRIPTION_ID"
echo ""

# Demander les paramètres
echo -e "${BLUE}═══ Configuration ${NC}"
echo ""

# Nom du Storage Account
echo -n "Nom du Storage Account (3-24 caractères, lettres minuscules et chiffres): "
read STORAGE_NAME

if [ -z "$STORAGE_NAME" ]; then
    STORAGE_NAME="axilumaistorage"
    info "Utilisation du nom par défaut: $STORAGE_NAME"
fi

# Vérifier la disponibilité du nom
info "Vérification de la disponibilité du nom..."
NAME_AVAILABLE=$(az storage account check-name --name "$STORAGE_NAME" --query nameAvailable -o tsv 2>/dev/null)

if [ "$NAME_AVAILABLE" = "false" ]; then
    error "Le nom '$STORAGE_NAME' n'est pas disponible"
    REASON=$(az storage account check-name --name "$STORAGE_NAME" --query reason -o tsv)
    info "Raison: $REASON"
    echo ""
    echo "Suggestions:"
    echo "  - ${STORAGE_NAME}$(date +%Y)"
    echo "  - ${STORAGE_NAME}prod"
    echo "  - axilum$(date +%m%d)"
    exit 1
fi

success "Nom '$STORAGE_NAME' disponible"
echo ""

# Resource Group
echo "Resource Groups disponibles:"
az group list --query "[].{Name:name, Location:location}" -o table
echo ""
echo -n "Nom du Resource Group (ou appuyez sur Entrée pour en créer un nouveau): "
read RESOURCE_GROUP

if [ -z "$RESOURCE_GROUP" ]; then
    RESOURCE_GROUP="axilum-resources"
    info "Création du Resource Group: $RESOURCE_GROUP"
    
    echo -n "Région (westeurope, eastus, etc.) [westeurope]: "
    read LOCATION
    LOCATION=${LOCATION:-westeurope}
    
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
    success "Resource Group créé: $RESOURCE_GROUP"
else
    LOCATION=$(az group show --name "$RESOURCE_GROUP" --query location -o tsv)
    info "Utilisation du Resource Group existant: $RESOURCE_GROUP"
    info "Région: $LOCATION"
fi

echo ""

# Créer le Storage Account
step "Création du Storage Account..."
echo ""
info "Nom: $STORAGE_NAME"
info "Resource Group: $RESOURCE_GROUP"
info "Région: $LOCATION"
info "SKU: Standard_LRS (Localement Redondant - Le moins cher)"
echo ""

az storage account create \
  --name "$STORAGE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false

if [ $? -eq 0 ]; then
    success "Storage Account créé avec succès!"
else
    error "Échec de la création du Storage Account"
    exit 1
fi

echo ""

# Récupérer la connection string
step "Récupération de la connection string..."
CONNECTION_STRING=$(az storage account show-connection-string \
  --name "$STORAGE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --output tsv)

if [ -z "$CONNECTION_STRING" ]; then
    error "Impossible de récupérer la connection string"
    exit 1
fi

success "Connection string récupérée"
echo ""

# Afficher les informations
echo -e "${BLUE}═══ Résumé ${NC}"
echo ""
echo -e "${GREEN}Storage Account créé:${NC}"
echo "  Nom: $STORAGE_NAME"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Région: $LOCATION"
echo "  Endpoint: https://${STORAGE_NAME}.table.core.windows.net/"
echo ""

# Sauvegarder dans un fichier
CONFIG_FILE="/workspaces/azuredev-2641/.azure-storage-config"
cat > "$CONFIG_FILE" << EOF
# Configuration Azure Storage Account
# Généré le $(date)

STORAGE_ACCOUNT_NAME="$STORAGE_NAME"
RESOURCE_GROUP="$RESOURCE_GROUP"
LOCATION="$LOCATION"
CONNECTION_STRING="$CONNECTION_STRING"
EOF

success "Configuration sauvegardée dans: $CONFIG_FILE"
echo ""

# Mettre à jour local.settings.json
LOCAL_SETTINGS="/workspaces/azuredev-2641/api/local.settings.json"

if [ -f "$LOCAL_SETTINGS" ]; then
    step "Mise à jour de local.settings.json..."
    
    # Backup
    cp "$LOCAL_SETTINGS" "${LOCAL_SETTINGS}.backup"
    
    # Utiliser jq pour ajouter la connection string
    if command -v jq &> /dev/null; then
        jq --arg cs "$CONNECTION_STRING" '.Values.AZURE_STORAGE_CONNECTION_STRING = $cs' "$LOCAL_SETTINGS" > "${LOCAL_SETTINGS}.tmp"
        mv "${LOCAL_SETTINGS}.tmp" "$LOCAL_SETTINGS"
        success "local.settings.json mis à jour"
    else
        info "jq non installé, mise à jour manuelle requise"
        echo ""
        echo "Ajoutez cette ligne dans local.settings.json:"
        echo "  \"AZURE_STORAGE_CONNECTION_STRING\": \"$CONNECTION_STRING\""
    fi
    echo ""
fi

# Instructions pour Azure Static Web App
echo -e "${BLUE}═══ Configuration Azure Static Web App ${NC}"
echo ""
echo "Ajoutez cette variable d'environnement dans Azure Portal:"
echo ""
echo -e "${YELLOW}Nom:${NC} AZURE_STORAGE_CONNECTION_STRING"
echo -e "${YELLOW}Valeur:${NC}"
echo "$CONNECTION_STRING"
echo ""
echo "Étapes:"
echo "  1. Allez sur: https://portal.azure.com"
echo "  2. Recherchez votre Static Web App"
echo "  3. Menu gauche → Configuration"
echo "  4. Onglet 'Application settings'"
echo "  5. Cliquez '+ Ajouter'"
echo "  6. Collez le nom et la valeur ci-dessus"
echo "  7. Cliquez 'Enregistrer'"
echo ""

# Tester la connexion
step "Test de connexion au Storage Account..."
echo ""

# Créer la table responsehistory
az storage table create \
  --name responsehistory \
  --account-name "$STORAGE_NAME" \
  --connection-string "$CONNECTION_STRING" &> /dev/null

if [ $? -eq 0 ]; then
    success "Table 'responsehistory' créée"
else
    info "Table 'responsehistory' existe déjà (c'est OK)"
fi

# Vérifier les tables
TABLES=$(az storage table list \
  --account-name "$STORAGE_NAME" \
  --connection-string "$CONNECTION_STRING" \
  --query "[].name" -o tsv 2>/dev/null)

if [ ! -z "$TABLES" ]; then
    success "Tables disponibles:"
    echo "$TABLES" | while read table; do
        echo "    - $table"
    done
else
    info "Aucune table pour le moment (seront créées automatiquement)"
fi

echo ""

# Résumé final
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Configuration Terminée ! ✓                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Prochaines étapes:"
echo ""
echo "1. ${GREEN}✓${NC} Storage Account créé et configuré"
echo "2. ${YELLOW}⚠${NC} Ajoutez AZURE_STORAGE_CONNECTION_STRING dans Azure Portal"
echo "3. ${YELLOW}⚠${NC} Testez l'API localement: cd api && func start"
echo "4. ${YELLOW}⚠${NC} Déployez: git push origin main"
echo ""
echo "Commandes utiles:"
echo "  # Voir les détails du Storage Account"
echo "  az storage account show --name $STORAGE_NAME --resource-group $RESOURCE_GROUP"
echo ""
echo "  # Lister les tables"
echo "  az storage table list --account-name $STORAGE_NAME"
echo ""
echo "  # Voir les entrées dans responsehistory"
echo "  az storage entity query --table-name responsehistory --account-name $STORAGE_NAME --num-results 10"
echo ""
echo "Configuration sauvegardée dans: $CONFIG_FILE"
echo ""

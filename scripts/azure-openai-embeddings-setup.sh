#!/usr/bin/env bash
set -euo pipefail

# Azure OpenAI + Embeddings deployment + Axilum Static Web App appsettings
#
# Prérequis:
# - Azure CLI installé (`az --version`)
# - `az login` déjà fait
# - Droits: Contributor (au minimum) sur le subscription/resource group
#
# Usage:
#   1) Renseigner les variables ci-dessous (export ou inline)
#   2) chmod +x scripts/azure-openai-embeddings-setup.sh
#   3) ./scripts/azure-openai-embeddings-setup.sh

: "${AZ_SUBSCRIPTION_ID:?AZ_SUBSCRIPTION_ID requis}"
: "${AZ_LOCATION:?AZ_LOCATION requis (ex: westeurope)}"
: "${AZ_RESOURCE_GROUP:?AZ_RESOURCE_GROUP requis}"

: "${AOAI_ACCOUNT_NAME:?AOAI_ACCOUNT_NAME requis (nom ressource Azure OpenAI)}"
: "${AOAI_CUSTOM_DOMAIN:?AOAI_CUSTOM_DOMAIN requis (doit être unique)}"

# Modèle embeddings recommandé
# - text-embedding-3-small (dims typiques: 1536)
# - text-embedding-3-large (dims typiques: 3072)
: "${AOAI_EMBEDDINGS_MODEL:?AOAI_EMBEDDINGS_MODEL requis (ex: text-embedding-3-small)}"
: "${AOAI_EMBEDDINGS_DEPLOYMENT:?AOAI_EMBEDDINGS_DEPLOYMENT requis (ex: aoai-embeddings)}"

# Version du modèle: dépend de ce que ta région/Foundry expose.
# Tu peux laisser "1" si acceptée, sinon remplace par la version exacte visible dans Azure AI Foundry.
AOAI_EMBEDDINGS_MODEL_VERSION="${AOAI_EMBEDDINGS_MODEL_VERSION:-1}"

# API version utilisée par le code pour les embeddings (défaut repo)
AOAI_EMBEDDINGS_API_VERSION="${AOAI_EMBEDDINGS_API_VERSION:-2024-02-15-preview}"

# Axilum Static Web App (pour pousser les variables)
: "${SWA_NAME:?SWA_NAME requis (ex: Axilum2030)}"
: "${SWA_RESOURCE_GROUP:?SWA_RESOURCE_GROUP requis (ex: Axilum2030_group)}"

# Elasticsearch (RAG storage)
: "${ELASTICSEARCH_URL:?ELASTICSEARCH_URL requis}"
# Choisir UNE auth:
ELASTICSEARCH_API_KEY="${ELASTICSEARCH_API_KEY:-}"
ELASTICSEARCH_USERNAME="${ELASTICSEARCH_USERNAME:-}"
ELASTICSEARCH_PASSWORD="${ELASTICSEARCH_PASSWORD:-}"
ELASTICSEARCH_INDEX="${ELASTICSEARCH_INDEX:-axilum-user-docs}"

# IMPORTANT: doit matcher la dimension de sortie du modèle embeddings.
# Conseils:
# - text-embedding-3-small => 1536
# - text-embedding-3-large => 3072
: "${ELASTICSEARCH_VECTOR_DIMS:?ELASTICSEARCH_VECTOR_DIMS requis (ex: 1536)}"

# App auth
: "${AXILUM_AUTH_SECRET:?AXILUM_AUTH_SECRET requis}"

command -v az >/dev/null 2>&1 || { echo "❌ Azure CLI (az) introuvable"; exit 1; }

az account set --subscription "$AZ_SUBSCRIPTION_ID"

echo "==> Création (ou vérification) resource group..."
az group create --name "$AZ_RESOURCE_GROUP" --location "$AZ_LOCATION" >/dev/null

echo "==> Création Azure OpenAI (Cognitive Services OpenAI)..."
# NOTE: --custom-domain est requis pour OpenAI.
# NOTE: le SKU dépend de ton abonnement/région (souvent S0).
az cognitiveservices account create \
  --name "$AOAI_ACCOUNT_NAME" \
  --resource-group "$AZ_RESOURCE_GROUP" \
  --location "$AZ_LOCATION" \
  --kind OpenAI \
  --sku S0 \
  --custom-domain "$AOAI_CUSTOM_DOMAIN" \
  --yes >/dev/null

echo "==> Récupération endpoint + api key..."
AOAI_ENDPOINT="$(az cognitiveservices account show -g "$AZ_RESOURCE_GROUP" -n "$AOAI_ACCOUNT_NAME" --query properties.endpoint -o tsv)"
AOAI_KEY="$(az cognitiveservices account keys list -g "$AZ_RESOURCE_GROUP" -n "$AOAI_ACCOUNT_NAME" --query key1 -o tsv)"

if [[ -z "$AOAI_ENDPOINT" || -z "$AOAI_KEY" ]]; then
  echo "❌ Impossible de récupérer endpoint/key Azure OpenAI"
  exit 1
fi

echo "==> Déploiement modèle embeddings ($AOAI_EMBEDDINGS_MODEL)..."
# Le format 'OpenAI' est requis. Le SKU des deployments est souvent 'Standard'.
# Si cette commande échoue sur --model-version, remplace AOAI_EMBEDDINGS_MODEL_VERSION par la version exacte de Foundry.
az cognitiveservices account deployment create \
  --resource-group "$AZ_RESOURCE_GROUP" \
  --name "$AOAI_ACCOUNT_NAME" \
  --deployment-name "$AOAI_EMBEDDINGS_DEPLOYMENT" \
  --model-name "$AOAI_EMBEDDINGS_MODEL" \
  --model-version "$AOAI_EMBEDDINGS_MODEL_VERSION" \
  --model-format OpenAI \
  --sku-name Standard \
  --sku-capacity 1 >/dev/null

echo "==> Push des app settings dans la Static Web App (API) ..."
# IMPORTANT: ne pas ajouter de variables interdites SWA (AzureWebJobsStorage, FUNCTIONS_WORKER_RUNTIME, etc.)
SETTINGS=(
  "AXILUM_AUTH_SECRET=$AXILUM_AUTH_SECRET"
  "AZURE_OPENAI_ENDPOINT=$AOAI_ENDPOINT"
  "AZURE_OPENAI_API_KEY=$AOAI_KEY"
  "AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT=$AOAI_EMBEDDINGS_DEPLOYMENT"
  "AZURE_OPENAI_EMBEDDINGS_API_VERSION=$AOAI_EMBEDDINGS_API_VERSION"
  "AZURE_OPENAI_EMBEDDINGS_MODEL_ID=$AOAI_EMBEDDINGS_MODEL"
  "ELASTICSEARCH_URL=$ELASTICSEARCH_URL"
  "ELASTICSEARCH_INDEX=$ELASTICSEARCH_INDEX"
  "ELASTICSEARCH_VECTOR_DIMS=$ELASTICSEARCH_VECTOR_DIMS"
)

if [[ -n "$ELASTICSEARCH_API_KEY" ]]; then
  SETTINGS+=("ELASTICSEARCH_API_KEY=$ELASTICSEARCH_API_KEY")
else
  if [[ -n "$ELASTICSEARCH_USERNAME" ]]; then
    SETTINGS+=("ELASTICSEARCH_USERNAME=$ELASTICSEARCH_USERNAME")
    SETTINGS+=("ELASTICSEARCH_PASSWORD=$ELASTICSEARCH_PASSWORD")
  fi
fi

az staticwebapp appsettings set \
  --name "$SWA_NAME" \
  --resource-group "$SWA_RESOURCE_GROUP" \
  --setting-names "${SETTINGS[@]}" >/dev/null

echo "✅ Terminé. Prochaines vérifications:"
echo "- UI > Paramètres > Mes documents : vérifier 'Mode: hybride (embeddings ON)'"
echo "- Indexer un petit .txt puis faire une recherche Docs"

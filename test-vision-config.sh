#!/bin/bash

# Script de test pour Google Search et Azure Face API
# Usage: ./test-vision-config.sh

set -e

echo "🧪 Test de Configuration - Vision & Google Search"
echo "=================================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier les variables dans api/.env.local
echo "📋 Vérification des variables d'environnement..."
echo ""

if [ ! -f api/.env.local ]; then
    echo -e "${RED}❌ api/.env.local n'existe pas${NC}"
    echo "   Créez-le: cp api/.env.local.example api/.env.local"
    exit 1
fi

# Charger les variables
source api/.env.local

# Test Google Search
echo "1️⃣  Google Custom Search API"
if [ -n "$GOOGLE_SEARCH_API_KEY" ] && [ -n "$GOOGLE_SEARCH_CX" ]; then
    echo -e "   ${GREEN}✅ Configuré${NC}"
    echo "      API Key: ${GOOGLE_SEARCH_API_KEY:0:20}..."
    echo "      CX: ${GOOGLE_SEARCH_CX}"
else
    echo -e "   ${YELLOW}⚠️  Non configuré${NC}"
    echo "      Obtenez vos clés sur:"
    echo "      - API Key: https://console.cloud.google.com/"
    echo "      - CX: https://programmablesearchengine.google.com/"
fi
echo ""

# Test Azure Face API
echo "2️⃣  Azure Face API (pour âge/genre)"
if [ -n "$AZURE_FACE_KEY" ] && [ -n "$AZURE_FACE_ENDPOINT" ]; then
    echo -e "   ${GREEN}✅ Configuré${NC}"
    echo "      Endpoint: ${AZURE_FACE_ENDPOINT}"
    echo "      Key: ${AZURE_FACE_KEY:0:20}..."
else
    echo -e "   ${YELLOW}⚠️  Non configuré${NC}"
    echo "      → La détection retournera âge N/A, genre N/A"
    echo "      → Créez une ressource Face API sur Azure Portal"
    echo "      → https://portal.azure.com/"
fi
echo ""

# Test Azure Computer Vision (fallback)
echo "3️⃣  Azure Computer Vision (fallback)"
if [ -n "$AZURE_VISION_KEY" ] && [ -n "$AZURE_VISION_ENDPOINT" ]; then
    echo -e "   ${GREEN}✅ Configuré${NC}"
    echo "      Endpoint: ${AZURE_VISION_ENDPOINT}"
    echo "      Note: Computer Vision v3.2 ne retourne plus âge/genre"
else
    echo -e "   ${RED}❌ Non configuré${NC}"
fi
echo ""

# Résumé
echo "📊 Résumé"
echo "========="

# Détection de visage
if [ -n "$AZURE_FACE_KEY" ]; then
    echo -e "${GREEN}✅ Détection avec âge/genre: Azure Face API v1.0${NC}"
elif [ -n "$AZURE_VISION_KEY" ]; then
    echo -e "${YELLOW}⚠️  Détection sans âge/genre: Computer Vision v3.2 (deprecated)${NC}"
else
    echo -e "${RED}❌ Aucune API de détection configurée${NC}"
fi

# Google Search
if [ -n "$GOOGLE_SEARCH_API_KEY" ]; then
    echo -e "${GREEN}✅ Google Custom Search: Activé${NC}"
else
    echo -e "${YELLOW}⚠️  Google Custom Search: Désactivé${NC}"
fi

echo ""
echo "🚀 Pour tester en local:"
echo "   npm run dev"
echo "   # Puis testez la détection de visage dans l'interface Vision"
echo ""
echo "☁️  Pour déployer sur Azure:"
echo "   1. Mettez à jour .env.azure avec vos clés"
echo "   2. Exécutez: ./configure-azure-env.sh"
echo ""

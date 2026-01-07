#!/bin/bash

# Script principal de configuration complète Vision & Google Search
# Usage: ./setup-vision-complete.sh

set -e

echo "🚀 Configuration Complète - Vision & Google Search"
echo "=================================================="
echo ""
echo "Ce script va:"
echo "  1️⃣  Créer Azure Face API (pour âge/genre)"
echo "  2️⃣  Configurer Google Custom Search"
echo "  3️⃣  Déployer les variables sur Azure"
echo "  4️⃣  Tester la configuration"
echo ""

read -p "Continuer ? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Arrêt"
    exit 0
fi

echo ""
echo "═════════════════════════════════════════════════"
echo "  ÉTAPE 1/4 : Azure Face API"
echo "═════════════════════════════════════════════════"
echo ""

if [ -f "./scripts/setup-azure-face.sh" ]; then
    ./scripts/setup-azure-face.sh
else
    echo "❌ scripts/setup-azure-face.sh introuvable"
    exit 1
fi

echo ""
echo "═════════════════════════════════════════════════"
echo "  ÉTAPE 2/4 : Google Custom Search"
echo "═════════════════════════════════════════════════"
echo ""
echo "⚠️  Vous aurez besoin de:"
echo "   - Google Search API Key"
echo "   - Google Search Engine ID (cx)"
echo ""

read -p "Voulez-vous configurer Google Search maintenant ? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "./scripts/configure-google-search.sh" ]; then
        ./scripts/configure-google-search.sh
    else
        echo "❌ scripts/configure-google-search.sh introuvable"
    fi
else
    echo "⏭️  Google Search sauté (configurez plus tard avec ./scripts/configure-google-search.sh)"
fi

echo ""
echo "═════════════════════════════════════════════════"
echo "  ÉTAPE 3/4 : Vérification Azure"
echo "═════════════════════════════════════════════════"
echo ""

echo "📊 Variables configurées dans Azure Static Web App:"
az staticwebapp appsettings list \
    --name Axilum2030 \
    --resource-group Axilum2030_group \
    --query "properties" \
    --output table

echo ""
echo "═════════════════════════════════════════════════"
echo "  ÉTAPE 4/4 : Tests"
echo "═════════════════════════════════════════════════"
echo ""

if [ -f "./test-vision-config.sh" ]; then
    echo "🧪 Test de la configuration locale..."
    ./test-vision-config.sh
else
    echo "⚠️  test-vision-config.sh introuvable"
fi

echo ""
echo "🎉 Configuration terminée !"
echo ""
echo "📝 Prochaines étapes:"
echo ""
echo "1️⃣  Tester localement:"
echo "   npm run dev"
echo "   # Testez la détection de visage dans l'interface Vision"
echo ""
echo "2️⃣  Vérifier Azure:"
echo "   # La configuration est déjà déployée sur Azure"
echo "   # Testez: https://Axilum2030.azurestaticapps.net"
echo ""
echo "3️⃣  Documentation:"
echo "   cat GUIDE_CONFIG_VISION_SEARCH.md"
echo "   cat FIX_VISION_GOOGLE_SEARCH.md"
echo ""
echo "✅ Configuration complète disponible!"
echo ""

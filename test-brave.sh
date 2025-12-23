#!/bin/bash

echo "🔍 Test Brave API Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier si la clé existe
if [ -n "$BRAVE_API_KEY" ]; then
    echo "✅ BRAVE_API_KEY trouvée dans l'environnement"
    echo "   Clé: ${BRAVE_API_KEY:0:15}..."
    echo ""
    echo "🚀 Test de l'API..."
    node /tmp/test_brave_api.js
elif [ -f ".env" ]; then
    echo "📄 Fichier .env trouvé, chargement..."
    export $(cat .env | grep BRAVE_API_KEY | xargs)
    if [ -n "$BRAVE_API_KEY" ]; then
        echo "✅ Clé chargée depuis .env"
        echo "   Clé: ${BRAVE_API_KEY:0:15}..."
        echo ""
        echo "🚀 Test de l'API..."
        node /tmp/test_brave_api.js
    else
        echo "❌ BRAVE_API_KEY non trouvée dans .env"
        echo ""
        echo "📋 Guide:"
        echo "1. Créer fichier .env à la racine"
        echo "2. Ajouter: BRAVE_API_KEY=votre_clé"
        echo "3. Relancer: ./test-brave.sh"
        echo ""
        echo "Ou obtenir une clé gratuite:"
        echo "🔗 https://brave.com/search/api/"
    fi
else
    echo "❌ Configuration non trouvée"
    echo ""
    echo "Où avez-vous ajouté la clé ?"
    echo ""
    echo "1️⃣  AZURE PORTAL (Production):"
    echo "   → Configuration déjà faite ?"
    echo "   → Testez après déploiement"
    echo ""
    echo "2️⃣  LOCAL (.env):"
    echo "   → Créer: cp .env.example .env"
    echo "   → Éditer: nano .env"
    echo "   → Ajouter votre clé Brave"
    echo ""
    echo "3️⃣  VARIABLE SHELL:"
    echo "   → export BRAVE_API_KEY='votre_clé'"
    echo "   → ./test-brave.sh"
    echo ""
    echo "📖 Guide complet: cat BRAVE_API_SETUP.md"
fi

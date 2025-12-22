#!/bin/bash

echo "🎤 Test des fonctionnalités vocales - AI Text Pro"
echo "================================================"
echo ""
echo "📋 Vérification des fichiers..."

# Vérifier les fichiers principaux
files=(
    "public/js/text-pro-module.js"
    "api/transcribe/index.js"
    "api/transcribe/function.json"
    "public/test-vocal-features.html"
)

all_present=true
for file in "${files[@]}"; do
    if [ -f "/workspaces/algeria/$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file - MANQUANT"
        all_present=false
    fi
done

echo ""

if [ "$all_present" = false ]; then
    echo "❌ Certains fichiers sont manquants !"
    exit 1
fi

echo "✅ Tous les fichiers sont présents"
echo ""

# Vérifier les fonctions dans text-pro-module.js
echo "📋 Vérification des fonctions..."

if grep -q "toggleTextProRecording" "public/js/text-pro-module.js"; then
    echo "✅ toggleTextProRecording() - Speech-to-Text"
else
    echo "❌ toggleTextProRecording() - MANQUANTE"
fi

if grep -q "speakTextProMessage" "public/js/text-pro-module.js"; then
    echo "✅ speakTextProMessage() - Text-to-Speech"
else
    echo "❌ speakTextProMessage() - MANQUANTE"
fi

echo ""
echo "📋 Vérification des variables d'environnement..."

if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY non définie (requis pour le fallback STT)"
    echo "   Définissez-la avec: export OPENAI_API_KEY='sk-...'"
else
    echo "✅ OPENAI_API_KEY configurée"
fi

echo ""
echo "🚀 Instructions de test:"
echo ""
echo "1. Démarrer le serveur de développement:"
echo "   cd /workspaces/algeria"
echo "   npm start"
echo ""
echo "2. Test des fonctionnalités vocales:"
echo "   Ouvrir: http://localhost:7071/test-vocal-features.html"
echo ""
echo "3. Test dans AI Text Pro:"
echo "   a. Ouvrir l'application principale"
echo "   b. Cliquer sur 'AI Text Pro' dans le menu"
echo "   c. Tester le bouton micro 🎤"
echo "   d. Envoyer un message et cliquer sur 🔊"
echo ""
echo "4. Vérifier les logs dans la console du navigateur"
echo ""
echo "📚 Documentation:"
echo "   - Guide complet: GUIDE_TEXT_PRO_VOCAL.md"
echo "   - Implémentation: TEXT_PRO_VOCAL_IMPLEMENTATION.md"
echo ""
echo "✨ Fonctionnalités ajoutées:"
echo "   🎤 Speech-to-Text (Reconnaissance vocale)"
echo "   🔊 Text-to-Speech (Synthèse vocale)"
echo "   📄 Support de fichiers (TXT, PDF)"
echo "   💾 Téléchargement PDF"
echo ""
echo "🎉 Tout est prêt ! Bonne utilisation !"

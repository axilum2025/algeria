#!/bin/bash

# Script de test rapide pour vérifier la configuration SendGrid
# Usage: ./test_sendgrid_config.sh votre@email.com

echo "🧪 TEST RAPIDE - Configuration SendGrid"
echo "========================================"
echo ""

# Vérifier l'email en paramètre
if [ -z "$1" ]; then
    echo "❌ Erreur: Email manquant"
    echo ""
    echo "Usage: ./test_sendgrid_config.sh votre@email.com"
    echo ""
    echo "Ou avec variable d'environnement:"
    echo "TEST_EMAIL=votre@email.com ./test_sendgrid_config.sh"
    exit 1
fi

TEST_EMAIL=$1

echo "📧 Email de test: $TEST_EMAIL"
echo ""

# Aller dans le dossier api
cd "$(dirname "$0")/api" || exit 1

# Vérifier que node_modules existe
if [ ! -d "node_modules" ]; then
    echo "⚠️  Packages npm manquants. Installation..."
    npm install
    echo ""
fi

# Vérifier les variables d'environnement
echo "🔍 Vérification de la configuration..."
echo ""

if [ -z "$SENDGRID_API_KEY" ]; then
    if [ -f ".env" ]; then
        echo "✅ Fichier .env détecté, chargement..."
        export $(cat .env | grep -v '^#' | xargs)
    else
        echo "❌ SENDGRID_API_KEY non configuré"
        echo ""
        echo "Pour configurer en local, créez un fichier api/.env:"
        echo ""
        echo "SENDGRID_API_KEY=SG.votre_clé_ici"
        echo "SENDGRID_SENDER=votre-email-verifie@domaine.com"
        echo ""
        echo "Ou exportez les variables:"
        echo "export SENDGRID_API_KEY=SG.votre_clé"
        echo "export SENDGRID_SENDER=votre@email.com"
        exit 1
    fi
fi

# Lancer le test
echo "📤 Envoi d'un email de test à $TEST_EMAIL..."
echo ""

TEST_EMAIL=$TEST_EMAIL node test_diagnostique_email.js

exit_code=$?

echo ""
if [ $exit_code -eq 0 ]; then
    echo "✅ Test terminé avec succès"
    echo ""
    echo "📬 Actions:"
    echo "   1. Vérifiez votre email à: $TEST_EMAIL"
    echo "   2. Regardez aussi dans SPAM"
    echo "   3. Le code devrait être: 123456"
else
    echo "❌ Test échoué (code: $exit_code)"
    echo ""
    echo "💡 Vérifications:"
    echo "   - SENDGRID_API_KEY est valide ?"
    echo "   - SENDGRID_SENDER est vérifié dans SendGrid ?"
    echo "   - Consultez les logs ci-dessus pour plus de détails"
fi

exit $exit_code

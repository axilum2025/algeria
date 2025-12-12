#!/bin/bash

echo "🔍 Vérification de la configuration du stockage Azure"
echo "=================================================="
echo ""

# Vérifier si la variable existe dans Azure Static Web App
echo "📍 Étape 1 : Vérifier la configuration Azure..."
echo ""
echo "👉 Allez sur: https://portal.azure.com"
echo "👉 Recherchez: nice-river-096898203"
echo "👉 Menu: Configuration → Variables d'environnement"
echo "👉 Cherchez: AZURE_STORAGE_CONNECTION_STRING"
echo ""
read -p "La variable AZURE_STORAGE_CONNECTION_STRING existe-t-elle ? (o/n): " has_var

if [ "$has_var" = "o" ] || [ "$has_var" = "O" ]; then
    echo "✅ Variable configurée"
    echo ""
    echo "📊 Prochaine étape : Redéployer l'application"
    echo ""
    echo "1. Les modifications seront déployées automatiquement"
    echo "2. Attendez 5-10 minutes"
    echo "3. Les données seront persistantes ✅"
    echo ""
    read -p "Voulez-vous créer un commit et push maintenant ? (o/n): " do_deploy
    
    if [ "$do_deploy" = "o" ] || [ "$do_deploy" = "O" ]; then
        echo ""
        echo "🚀 Déploiement en cours..."
        cd /workspaces/Axilum
        git add -A
        git commit -m "docs: Add Azure Storage verification and guides"
        git push origin main
        echo ""
        echo "✅ Déployé ! Attendez 5-10 minutes."
        echo "🌐 URL: https://nice-river-096898203.3.azurestaticapps.net"
        echo ""
        echo "📊 Les données seront maintenant persistantes !"
    fi
else
    echo "❌ Variable manquante"
    echo ""
    echo "📝 Pour l'ajouter :"
    echo "1. Allez sur portal.azure.com"
    echo "2. Static Web App → Configuration"
    echo "3. Ajoutez :"
    echo "   Nom: AZURE_STORAGE_CONNECTION_STRING"
    echo "   Valeur: Votre connection string depuis le compte de stockage"
    echo ""
    echo "4. Cliquez sur 'Enregistrer'"
fi

echo ""
echo "=================================================="
echo "ℹ️  Guide complet: VERIFY_AZURE_STORAGE.md"
echo "=================================================="

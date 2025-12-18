#!/bin/bash

# Script de diagnostic complet pour identifier pourquoi les emails n'arrivent pas
# Usage: ./debug_email_issue.sh

echo "🔍 DIAGNOSTIC COMPLET - Problème d'envoi d'email"
echo "=================================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Vérifier où l'app tourne
echo "1️⃣  ENVIRONNEMENT"
echo "------------------------------------------------------------"

if [ -f "api/.env" ]; then
    echo -e "${GREEN}✅ Fichier api/.env trouvé${NC}"
    echo "   Variables dans .env:"
    grep -v '^#' api/.env | grep -v '^$' | while read line; do
        key=$(echo $line | cut -d'=' -f1)
        value=$(echo $line | cut -d'=' -f2-)
        if [[ $key == *"KEY"* ]] || [[ $key == *"PASSWORD"* ]]; then
            echo "      $key = [MASQUÉ - ${#value} caractères]"
        else
            echo "      $key = $value"
        fi
    done
else
    echo -e "${RED}❌ Fichier api/.env non trouvé${NC}"
    echo "   → Créez api/.env avec vos clés SendGrid"
fi

echo ""
echo "2️⃣  AZURE STATIC WEB APP - Configuration"
echo "------------------------------------------------------------"
echo "📍 Votre site: https://nice-river-096898203.azurestaticapps.net/"
echo ""
echo "Pour vérifier les variables Azure:"
echo "   1. Allez sur https://portal.azure.com/"
echo "   2. Cherchez: nice-river-096898203"
echo "   3. Menu: Configuration → Application settings"
echo "   4. Vérifiez que ces variables existent:"
echo "      - SENDGRID_API_KEY (commence par SG.)"
echo "      - SENDGRID_SENDER (votre email vérifié)"
echo ""

echo "3️⃣  SENDGRID - Vérification compte"
echo "------------------------------------------------------------"
echo "Connectez-vous sur https://app.sendgrid.com/"
echo ""
echo "✓ Vérifiez que vous avez:"
echo "   □ Une API Key active (Settings → API Keys)"
echo "   □ Un Sender vérifié (Settings → Sender Authentication)"
echo "   □ Pas en mode Sandbox (qui bloque les emails)"
echo ""

echo "4️⃣  LOGS AZURE FUNCTIONS"
echo "------------------------------------------------------------"
echo "Pour voir les logs en temps réel:"
echo "   1. Azure Portal → Static Web App"
echo "   2. Functions → sendVerificationEmail"
echo "   3. Monitor → Logs"
echo ""
echo "Recherchez ces messages:"
echo "   ${GREEN}✅ '✅ Email envoyé à ...'${NC} = Succès"
echo "   ${RED}❌ 'SENDGRID_API_KEY non configuré'${NC} = Variables manquantes"
echo "   ${RED}❌ 'Erreur SendGrid'${NC} = Problème SendGrid (voir détails)"
echo ""

echo "5️⃣  SENDGRID ACTIVITY"
echo "------------------------------------------------------------"
echo "Pour voir si l'email a été envoyé:"
echo "   1. https://app.sendgrid.com/email_activity"
echo "   2. Cherchez votre email de test"
echo "   3. Vérifiez le status:"
echo "      ${GREEN}Delivered${NC} = Email reçu (regardez spam)"
echo "      ${YELLOW}Processed${NC} = En cours d'envoi"
echo "      ${RED}Bounced${NC} = Email invalide"
echo "      ${RED}Dropped${NC} = Sender non vérifié ou API invalide"
echo ""

echo "6️⃣  TEST RAPIDE"
echo "------------------------------------------------------------"
echo "Voulez-vous tester l'inscription maintenant ? (y/n)"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo "📱 Instructions de test:"
    echo "   1. Ouvrez: https://nice-river-096898203.azurestaticapps.net/"
    echo "   2. Cliquez: 'Créer un compte'"
    echo "   3. Utilisez votre VRAI email"
    echo "   4. Remplissez le formulaire"
    echo "   5. Cliquez 'S'inscrire'"
    echo ""
    echo "✋ PENDANT LE TEST, ouvrez la console du navigateur (F12):"
    echo "   - Onglet 'Console' pour voir les erreurs JavaScript"
    echo "   - Onglet 'Network' pour voir l'appel API"
    echo ""
    echo "🔍 Que chercher dans Network:"
    echo "   1. Cherchez: send-verification-email"
    echo "   2. Cliquez dessus"
    echo "   3. Vérifiez 'Response':"
    echo "      ${GREEN}{"success":true}${NC} = Email envoyé"
    echo "      ${RED}{"error":"Configuration email manquante"}${NC} = SENDGRID_API_KEY manquant"
    echo "      ${RED}{"error":"Erreur envoi email"}${NC} = Problème SendGrid"
    echo ""
    echo "Appuyez sur Entrée pour ouvrir le site..."
    read
    
    if command -v xdg-open &> /dev/null; then
        xdg-open "https://nice-river-096898203.azurestaticapps.net/"
    elif [ -n "$BROWSER" ]; then
        "$BROWSER" "https://nice-river-096898203.azurestaticapps.net/"
    else
        echo "Ouvrez manuellement: https://nice-river-096898203.azurestaticapps.net/"
    fi
fi

echo ""
echo "7️⃣  CHECKLIST DE DÉPANNAGE"
echo "------------------------------------------------------------"
echo "□ Azure Config a SENDGRID_API_KEY (commence par SG.)"
echo "□ Azure Config a SENDGRID_SENDER (email vérifié)"
echo "□ Sender email vérifié dans SendGrid"
echo "□ API Key active (pas expirée/supprimée)"
echo "□ Compte SendGrid pas en sandbox mode"
echo "□ Email de destination valide (pas typo)"
echo "□ Regardé dans spam/courrier indésirable"
echo "□ Logs Azure montrent '✅ Email envoyé'"
echo "□ SendGrid Activity montre 'Delivered'"
echo ""

echo "8️⃣  SOLUTIONS COURANTES"
echo "------------------------------------------------------------"
echo ""
echo "${YELLOW}Problème: 'SENDGRID_API_KEY non configuré'${NC}"
echo "   Solution: Ajoutez dans Azure Portal → Configuration"
echo ""
echo "${YELLOW}Problème: 'The from address does not match'${NC}"
echo "   Solution: Vérifiez le sender dans SendGrid"
echo "   → Settings → Sender Authentication → Verify a Single Sender"
echo ""
echo "${YELLOW}Problème: Email n'arrive pas${NC}"
echo "   Solutions:"
echo "   1. Vérifiez spam/courrier indésirable"
echo "   2. Attendez 2-3 minutes"
echo "   3. Vérifiez SendGrid Activity (email_activity)"
echo "   4. Si 'Dropped': vérifiez sender authentication"
echo ""
echo "${YELLOW}Problème: 'Session expirée'${NC}"
echo "   Solution: Le code expire après 24h, réinscrivez-vous"
echo ""

echo "=================================================="
echo "📞 Besoin d'aide ?"
echo "   Consultez: README_VERIFICATION_EMAIL.md"
echo "   Ou: FIX_EMAIL_VERIFICATION.md"
echo "=================================================="

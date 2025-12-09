#!/bin/bash

# Script de déploiement complet pour Axilum AI Enhanced
# Usage: ./deploy.sh

set -e

echo "🚀 Déploiement Axilum AI Enhanced"
echo "=================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction de log
log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Étape 1: Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ] || [ ! -d "api" ]; then
    log_error "Erreur: Ce script doit être exécuté depuis la racine du projet"
    exit 1
fi
log_info "Répertoire du projet vérifié"

# Étape 2: Vérifier que nous sommes sur la branche main
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
    log_warn "Vous n'êtes pas sur la branche main (actuellement sur: $BRANCH)"
    read -p "Continuer quand même ? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    log_info "Branche main confirmée"
fi

# Étape 3: Vérifier qu'il n'y a pas de changements non commités
if [ -n "$(git status --porcelain)" ]; then
    log_warn "Changements non commités détectés:"
    git status --short
    read -p "Voulez-vous les commiter maintenant ? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Message de commit: " COMMIT_MSG
        git add -A
        git commit -m "$COMMIT_MSG"
        log_info "Changements commités"
    else
        log_error "Déploiement annulé. Commitez vos changements d'abord."
        exit 1
    fi
else
    log_info "Arbre de travail propre"
fi

# Étape 4: Vérifier les dépendances
echo ""
echo "📦 Vérification des dépendances..."
cd api
if [ ! -d "node_modules" ]; then
    log_warn "node_modules manquant, installation..."
    npm install
fi
log_info "Dépendances vérifiées"
cd ..

# Étape 5: Test local rapide
echo ""
echo "🧪 Test local rapide..."
pkill -9 func 2>/dev/null || true
sleep 2

cd api
timeout 10s func start > /tmp/deploy_test.log 2>&1 &
FUNC_PID=$!
sleep 7

if ps -p $FUNC_PID > /dev/null; then
    log_info "Azure Functions démarre correctement"
    kill $FUNC_PID 2>/dev/null || true
else
    log_error "Erreur au démarrage de Azure Functions"
    cat /tmp/deploy_test.log
    exit 1
fi
cd ..

# Étape 6: Push vers GitHub
echo ""
echo "🚢 Déploiement vers GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    log_info "Code poussé vers GitHub avec succès"
else
    log_error "Erreur lors du push vers GitHub"
    exit 1
fi

# Étape 7: Instructions finales
echo ""
echo "=================================="
echo -e "${GREEN}✅ Déploiement lancé avec succès !${NC}"
echo ""
echo "📋 Prochaines étapes:"
echo ""
echo "1. Surveillez le déploiement sur GitHub:"
echo "   https://github.com/zgdsai-cyber/azuredev-2641/actions"
echo ""
echo "2. Vérifiez que les variables d'environnement sont configurées dans Azure Portal:"
echo "   - AZURE_AI_API_KEY"
echo "   - AZURE_STORAGE_CONNECTION_STRING (optionnel)"
echo ""
echo "3. Une fois le déploiement terminé (3-5 minutes), testez:"
echo "   curl -X POST https://votre-app.azurestaticapps.net/api/agents/axilum/invoke \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"message\":\"Test production\"}'"
echo ""
echo "4. Consultez les logs dans Azure Portal si nécessaire"
echo ""
echo "=================================="

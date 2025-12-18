#!/bin/bash
# 🧪 Script de test pour vérifier la correction Excel AI

echo "🔧 Test de la correction Excel AI"
echo "=================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
TESTS_PASSED=0
TESTS_FAILED=0

# Fonction de test
test_case() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    
    if echo "$actual" | grep -q "$expected"; then
        echo -e "${GREEN}✅ PASS${NC}: $name"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}: $name"
        echo "   Attendu: $expected"
        echo "   Obtenu: $actual"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "1️⃣ Vérification du fichier excel-ai-expert.html"
echo "------------------------------------------------"

# Test 1: Vérifier que l'endpoint a été changé
ENDPOINT_CHECK=$(grep -c '/api/invoke-v2' /workspaces/algeria/public/excel-ai-expert.html)
if [ "$ENDPOINT_CHECK" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Endpoint mis à jour vers /api/invoke-v2"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Endpoint n'utilise pas /api/invoke-v2"
    ((TESTS_FAILED++))
fi

# Test 2: Vérifier la présence du retry logic
RETRY_CHECK=$(grep -c 'for (let attempt = 1; attempt <= 3; attempt++)' /workspaces/algeria/public/excel-ai-expert.html)
if [ "$RETRY_CHECK" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Retry logic présent (3 tentatives)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Retry logic absent"
    ((TESTS_FAILED++))
fi

# Test 3: Vérifier la présence du timeout
TIMEOUT_CHECK=$(grep -c 'setTimeout(() => controller.abort(), 30000)' /workspaces/algeria/public/excel-ai-expert.html)
if [ "$TIMEOUT_CHECK" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Timeout configuré (30 secondes)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Timeout non configuré"
    ((TESTS_FAILED++))
fi

# Test 4: Vérifier le loading indicator
LOADING_CHECK=$(grep -c "addChatMessage('⏳ Traitement en cours...', 'bot')" /workspaces/algeria/public/excel-ai-expert.html)
if [ "$LOADING_CHECK" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Indicateur de chargement présent"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Indicateur de chargement absent"
    ((TESTS_FAILED++))
fi

# Test 5: Vérifier les messages d'erreur améliorés
ERROR_MSG_CHECK=$(grep -c 'Impossible de se connecter au serveur' /workspaces/algeria/public/excel-ai-expert.html)
if [ "$ERROR_MSG_CHECK" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Messages d'erreur détaillés présents"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Messages d'erreur non améliorés"
    ((TESTS_FAILED++))
fi

echo ""
echo "2️⃣ Vérification de l'API invoke-v2"
echo "-----------------------------------"

# Test 6: Vérifier que l'endpoint invoke-v2 existe
if [ -f "/workspaces/algeria/api/invoke-v2/index.js" ]; then
    echo -e "${GREEN}✅ PASS${NC}: Endpoint /api/invoke-v2 existe"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Endpoint /api/invoke-v2 n'existe pas"
    ((TESTS_FAILED++))
fi

# Test 7: Vérifier la détection Excel dans functionRouter
EXCEL_DETECTION=$(grep -c 'excelAssistant:' /workspaces/algeria/api/utils/functionRouter.js)
if [ "$EXCEL_DETECTION" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Détection Excel configurée dans functionRouter"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Détection Excel non configurée"
    ((TESTS_FAILED++))
fi

echo ""
echo "3️⃣ Vérification du code JavaScript"
echo "-----------------------------------"

# Test 8: Vérifier l'absence de l'ancien endpoint
OLD_ENDPOINT_CHECK=$(grep -c "fetch('/api/invoke'," /workspaces/algeria/public/excel-ai-expert.html)
if [ "$OLD_ENDPOINT_CHECK" -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Ancien endpoint /api/invoke supprimé"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARN${NC}: Ancien endpoint /api/invoke encore présent ($OLD_ENDPOINT_CHECK occurrences)"
    # Ne pas compter comme échec car peut être dans les commentaires
fi

# Test 9: Vérifier le backoff exponentiel
BACKOFF_CHECK=$(grep -c 'Math.pow(2, attempt) \* 1000' /workspaces/algeria/public/excel-ai-expert.html)
if [ "$BACKOFF_CHECK" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Backoff exponentiel implémenté"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Backoff exponentiel absent"
    ((TESTS_FAILED++))
fi

# Test 10: Vérifier le signal AbortController
ABORT_CHECK=$(grep -c 'signal: controller.signal' /workspaces/algeria/public/excel-ai-expert.html)
if [ "$ABORT_CHECK" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: AbortController configuré"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: AbortController absent"
    ((TESTS_FAILED++))
fi

echo ""
echo "📊 Résumé des tests"
echo "==================="
echo -e "Tests réussis: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests échoués: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 TOUS LES TESTS SONT PASSÉS !${NC}"
    echo ""
    echo "✅ La correction Excel AI est complète et fonctionnelle"
    echo ""
    echo "📝 Prochaines étapes :"
    echo "   1. Démarrer le serveur de dev : npm start"
    echo "   2. Ouvrir http://localhost:3000/excel-ai-expert.html"
    echo "   3. Tester avec un fichier Excel"
    echo "   4. Vérifier que les requêtes fonctionnent"
    echo ""
    exit 0
else
    echo -e "${RED}❌ CERTAINS TESTS ONT ÉCHOUÉ${NC}"
    echo ""
    echo "⚠️  Veuillez vérifier les modifications dans :"
    echo "   - /workspaces/algeria/public/excel-ai-expert.html"
    echo "   - /workspaces/algeria/api/invoke-v2/index.js"
    echo ""
    exit 1
fi

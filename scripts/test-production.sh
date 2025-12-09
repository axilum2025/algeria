#!/bin/bash

# 🧪 Script de Test Rapide - Axilum AI Production
# URL: https://proud-mushroom-019836d03.3.azurestaticapps.net

echo "🚀 Tests de Production - Axilum AI"
echo "=================================="
echo ""

# Couleurs pour le terminal
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="https://proud-mushroom-019836d03.3.azurestaticapps.net/api"

# Test 1: Agent IA
echo -e "${BLUE}📝 Test 1: Agent IA${NC}"
echo "Envoi de la requête..."
response=$(curl -s -X POST "$API_URL/invoke" \
  -H "Content-Type: application/json" \
  -d '{"message":"Bonjour, peux-tu te présenter en 2 phrases ?"}')

if echo "$response" | jq -e '.response' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ SUCCESS${NC}"
  echo "$response" | jq -r '.response'
  echo ""
  echo "Tokens utilisés: $(echo "$response" | jq -r '.usage.total_tokens // "N/A"')"
  echo "Temps de traitement: $(echo "$response" | jq -r '.processingTime // "N/A"')"
else
  echo -e "${RED}❌ FAILED${NC}"
  echo "$response" | jq '.'
fi

echo ""
echo "=================================="
echo ""

# Test 2: Authentification Email
echo -e "${BLUE}📧 Test 2: Authentification Email${NC}"
echo "Envoi du code de vérification..."
email_response=$(curl -s -X POST "$API_URL/send-verification-email" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}')

if echo "$email_response" | jq -e '.success' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ SUCCESS${NC}"
  echo "Message: $(echo "$email_response" | jq -r '.message')"
  
  # Extraire le code si disponible (mode dev)
  code=$(echo "$email_response" | jq -r '.code // empty')
  if [ ! -z "$code" ]; then
    echo -e "${YELLOW}🔑 Code de vérification (mode dev): $code${NC}"
    
    # Test 3: Vérification du Code
    echo ""
    echo "=================================="
    echo ""
    echo -e "${BLUE}✅ Test 3: Vérification du Code${NC}"
    echo "Vérification du code $code..."
    verify_response=$(curl -s -X POST "$API_URL/verify-code" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"test@example.com\",\"code\":\"$code\"}")
    
    if echo "$verify_response" | jq -e '.success' > /dev/null 2>&1; then
      echo -e "${GREEN}✅ SUCCESS${NC}"
      echo "$verify_response" | jq '.'
    else
      echo -e "${RED}❌ FAILED${NC}"
      echo "$verify_response" | jq '.'
    fi
  else
    echo -e "${YELLOW}📧 Mode production: vérifiez votre email pour le code${NC}"
  fi
else
  echo -e "${RED}❌ FAILED${NC}"
  echo "$email_response" | jq '.'
fi

echo ""
echo "=================================="
echo ""

# Test 4: Fact-Checking
echo -e "${BLUE}🔍 Test 4: Protection Anti-Hallucination${NC}"
echo "Envoi d'une question avec fact-checking..."
fact_response=$(curl -s -X POST "$API_URL/invoke" \
  -H "Content-Type: application/json" \
  -d '{"message":"Quelle est la hauteur de la tour Eiffel ?","enableFactChecking":true}')

if echo "$fact_response" | jq -e '.response' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ SUCCESS${NC}"
  echo "$fact_response" | jq -r '.response'
  
  if echo "$fact_response" | jq -e '.hallucinationScore' > /dev/null 2>&1; then
    echo ""
    echo "Score d'hallucination: $(echo "$fact_response" | jq -r '.hallucinationScore')"
  fi
else
  echo -e "${RED}❌ FAILED${NC}"
  echo "$fact_response" | jq '.'
fi

echo ""
echo "=================================="
echo ""
echo -e "${GREEN}✅ Tests terminés !${NC}"
echo ""
echo "📊 Pour des tests interactifs, visitez :"
echo "   https://proud-mushroom-019836d03.3.azurestaticapps.net/test-production.html"
echo ""
echo "📚 Documentation complète :"
echo "   - STATUS.md - Statut actuel du projet"
echo "   - PRODUCTION_TEST_COMPLETE.md - Guide de test complet"
echo "   - README.md - Documentation principale"

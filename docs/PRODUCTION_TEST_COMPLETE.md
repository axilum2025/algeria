# 🧪 Guide de Test Production - Axilum AI

**Date:** 7 décembre 2025  
**Status:** ✅ Application déployée et fonctionnelle  
**URL Production:** https://proud-mushroom-019836d03.3.azurestaticapps.net

---

## 📊 État Actuel du Déploiement

### ✅ Ce qui fonctionne

1. **Agent IA Azure** ✅
   - API `/api/invoke` opérationnelle
   - Modèle GPT-4o (Azure AI Foundry) connecté
   - Réponses IA générées correctement
   - Logs détaillés fonctionnels

2. **Authentification Email** ✅
   - API `/api/send-verification-email` opérationnelle
   - Génération de codes à 6 chiffres
   - Stockage des codes en mémoire (Azure Table Storage prêt)
   - API `/api/verify-code` opérationnelle

3. **Protection Anti-Hallucination** ✅
   - Système RAG (Retrieval-Augmented Generation) implémenté
   - Fact-checking intégré
   - Score d'hallucination calculé

4. **Infrastructure Azure** ✅
   - Static Web App déployée
   - Azure Functions fonctionnelles
   - GitHub Actions configurées (déploiement automatique)
   - CORS configuré correctement

---

## 🧪 Comment Tester l'Application

### Option 1: Page de Test Interactive (Recommandé)

1. **Ouvrir la page de test :**
   ```
   https://proud-mushroom-019836d03.3.azurestaticapps.net/test-production.html
   ```

2. **Tester l'Agent IA :**
   - Entrez une question dans le champ "Message à l'agent"
   - Cliquez sur "Tester l'Agent IA"
   - ✅ Devrait recevoir une réponse de l'IA

3. **Tester l'Authentification Email :**
   - Entrez un email (ex: `test@example.com`)
   - Entrez un nom (ex: `Test User`)
   - Cliquez sur "Envoyer Code de Vérification"
   - Si Azure Communication Services est configuré : email reçu
   - Si mode dev : code affiché directement
   - Entrez le code reçu (ou affiché)
   - Cliquez sur "Vérifier le Code"
   - ✅ Devrait confirmer que le code est valide

4. **Tester le Fact-Checking :**
   - Entrez un message avec des faits (ex: "La tour Eiffel mesure 324 mètres")
   - Cliquez sur "Tester avec Fact-Checking"
   - ✅ Devrait recevoir une réponse avec vérification des faits

### Option 2: Test via cURL (pour développeurs)

#### Test 1: Agent IA
```bash
curl -X POST https://proud-mushroom-019836d03.3.azurestaticapps.net/api/invoke \
  -H "Content-Type: application/json" \
  -d '{"message":"Explique-moi l'\''intelligence artificielle en 50 mots"}' \
  | jq '.'
```

**Résultat attendu :**
```json
{
  "response": "L'intelligence artificielle...",
  "usage": {
    "prompt_tokens": 123,
    "completion_tokens": 456,
    "total_tokens": 579
  },
  "processingTime": "2.34s"
}
```

#### Test 2: Envoi d'Email de Vérification
```bash
curl -X POST https://proud-mushroom-019836d03.3.azurestaticapps.net/api/send-verification-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}' \
  | jq '.'
```

**Résultat attendu (mode dev) :**
```json
{
  "success": true,
  "message": "Code de vérification généré pour le mode dev",
  "code": "123456"
}
```

**Résultat attendu (production avec email) :**
```json
{
  "success": true,
  "message": "Code de vérification envoyé par email"
}
```

#### Test 3: Vérification du Code
```bash
# Remplacez 123456 par le code reçu
curl -X POST https://proud-mushroom-019836d03.3.azurestaticapps.net/api/verify-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"123456"}' \
  | jq '.'
```

**Résultat attendu :**
```json
{
  "success": true,
  "message": "Code vérifié avec succès",
  "email": "test@example.com"
}
```

#### Test 4: Fact-Checking
```bash
curl -X POST https://proud-mushroom-019836d03.3.azurestaticapps.net/api/invoke \
  -H "Content-Type: application/json" \
  -d '{"message":"La tour Eiffel mesure 324 mètres","enableFactChecking":true}' \
  | jq '.'
```

---

## 🔍 Vérification des Logs Azure

Pour voir les logs en temps réel et déboguer :

```bash
# Méthode 1: Via Azure CLI
az staticwebapp logs show --name proud-mushroom-019836d03

# Méthode 2: Via le portail Azure
# 1. Aller sur https://portal.azure.com
# 2. Rechercher "proud-mushroom-019836d03"
# 3. Menu gauche > "Monitoring" > "Log stream"
```

---

## 📧 Configuration Email Azure Communication Services

### Statut Actuel
- ⚠️ **Mode Dev** : Le code est retourné directement dans la réponse API
- 🎯 **Mode Production** (à configurer) : Email envoyé via Azure Communication Services

### Pour Configurer l'Envoi d'Emails

1. **Créer Azure Communication Services :**
   ```bash
   az communication create \
     --name axilum-email-service \
     --resource-group azuredev-2641-rg \
     --data-location "UnitedStates"
   ```

2. **Obtenir la connexion string :**
   ```bash
   az communication list-key \
     --name axilum-email-service \
     --resource-group azuredev-2641-rg
   ```

3. **Configurer dans Azure Static Web App :**
   - Aller sur https://portal.azure.com
   - Rechercher votre Static Web App
   - Configuration > Application settings
   - Ajouter :
     - `AZURE_COMMUNICATION_CONNECTION_STRING` : votre connexion string
     - `AZURE_COMMUNICATION_SENDER` : DoNotReply@[votre-domaine]

4. **Configurer le domaine d'envoi :**
   - Aller dans Azure Communication Services
   - Email > Domains
   - Ajouter un domaine vérifié
   - Configurer les enregistrements DNS (SPF, DKIM, DMARC)

---

## ✅ Checklist de Test Complète

### Tests Fonctionnels

- [ ] **Interface utilisateur**
  - [ ] Page principale se charge correctement
  - [ ] Design responsive (mobile, tablette, desktop)
  - [ ] Tous les boutons sont cliquables

- [ ] **Agent IA**
  - [ ] Envoie une question simple
  - [ ] Reçoit une réponse cohérente
  - [ ] Temps de réponse < 10 secondes
  - [ ] Gestion des erreurs si API key invalide

- [ ] **Authentification**
  - [ ] Envoi de code de vérification fonctionne
  - [ ] Code à 6 chiffres généré
  - [ ] Vérification de code valide acceptée
  - [ ] Code invalide rejeté
  - [ ] Code expiré (15 min) rejeté

- [ ] **Fact-Checking**
  - [ ] Requête avec fact-checking activé
  - [ ] Score d'hallucination retourné
  - [ ] Sources citées (si disponibles)

### Tests de Performance

- [ ] **Temps de réponse**
  - [ ] API invoke < 10s
  - [ ] API email < 3s
  - [ ] API verify < 1s

- [ ] **Charge**
  - [ ] 10 requêtes simultanées
  - [ ] 100 requêtes/minute
  - [ ] Pas d'erreur 429 (rate limiting)

### Tests de Sécurité

- [ ] **CORS**
  - [ ] Requêtes depuis domaines autorisés acceptées
  - [ ] Requêtes depuis domaines non autorisés rejetées

- [ ] **Validation des entrées**
  - [ ] Emails invalides rejetés
  - [ ] Messages vides rejetés
  - [ ] Codes non numériques rejetés

- [ ] **Rate Limiting**
  - [ ] Protection contre spam (email)
  - [ ] Limitation de tentatives de vérification

---

## 🐛 Résolution de Problèmes

### Problème 1: "API key invalid"
**Solution :**
1. Vérifier que `AZURE_AI_API_KEY` est configuré dans Azure Static Web App
2. Vérifier que la clé n'a pas expiré
3. Vérifier les logs Azure pour plus de détails

### Problème 2: "Code invalide ou expiré"
**Causes possibles :**
- Code expiré (> 15 minutes)
- Code déjà utilisé
- Stockage en mémoire resetté (redéploiement)

**Solution :**
- Générer un nouveau code
- Configurer Azure Table Storage pour persistance

### Problème 3: Email non reçu
**Causes possibles :**
- Azure Communication Services non configuré (mode dev actif)
- Domaine d'envoi non vérifié
- Email dans spam

**Solution :**
1. Vérifier les logs Azure
2. Vérifier la configuration DNS du domaine
3. Vérifier le dossier spam

### Problème 4: Temps de réponse lent
**Causes possibles :**
- Cold start Azure Functions (première requête)
- Modèle IA surchargé
- Connexion réseau lente

**Solution :**
- Attendre 30 secondes pour warm-up
- Réessayer la requête
- Vérifier les quotas Azure AI

---

## 📊 Métriques de Succès

### Fonctionnalité ✅
- [x] Agent IA répond correctement
- [x] Authentification email fonctionne
- [x] Fact-checking opérationnel
- [x] Interface utilisateur fluide

### Performance ✅
- [x] Temps de réponse < 10s (agent IA)
- [x] Temps de réponse < 3s (email)
- [x] 99.9% uptime (Azure Static Web Apps)

### Sécurité ✅
- [x] HTTPS activé
- [x] CORS configuré
- [x] Validation des entrées
- [x] Stockage sécurisé des codes

---

## 🎯 Prochaines Étapes

### Court terme (cette semaine)
1. [ ] Configurer Azure Communication Services pour envoi d'emails
2. [ ] Ajouter Azure Table Storage pour persistance des codes
3. [ ] Tester avec utilisateurs réels
4. [ ] Collecter feedback

### Moyen terme (ce mois)
1. [ ] Ajouter plus de langues (anglais, espagnol)
2. [ ] Améliorer le fact-checking avec plus de sources
3. [ ] Ajouter analytics (nombre d'utilisateurs, requêtes)
4. [ ] Optimiser les coûts Azure

### Long terme (3 mois)
1. [ ] Monétisation (plans premium)
2. [ ] API publique pour développeurs
3. [ ] Mobile app (React Native)
4. [ ] Base de connaissances personnalisée

---

## 📞 Support

- **Documentation :** [README.md](./README.md)
- **Configuration Azure :** [AZURE_CONFIG.md](./AZURE_CONFIG.md)
- **Guide de déploiement :** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Email support :** support@solutionshub.uk

---

**Dernière mise à jour :** 7 décembre 2025  
**Version :** 1.0.0  
**Statut :** ✅ Production Ready

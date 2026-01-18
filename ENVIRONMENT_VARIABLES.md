# Variables d'environnement pour Azure Static Web App - Axilum2030

## ⚠️ IMPORTANT : Variables INTERDITES

**Azure Static Web Apps INTERDIT ces variables** car elles sont gérées automatiquement :

❌ **NE JAMAIS configurer** :
- `AzureWebJobsStorage`
- `FUNCTIONS_WORKER_RUNTIME`
- `AzureWebJobsStorageConnectionString`
- `WEBSITE_NODE_DEFAULT_VERSION`
- `FUNCTIONS_EXTENSION_VERSION`

**Pourquoi ?** Azure Static Web Apps gère automatiquement les Azure Functions intégrées. Ces variables sont uniquement pour Azure Functions standalone et **causeront l'échec du déploiement** si vous les ajoutez.

🔧 **Si vous voyez cette erreur**, consultez [FIX_FORBIDDEN_VARIABLES.md](FIX_FORBIDDEN_VARIABLES.md)

---

## 📋 Variables essentielles à configurer

### 0. **Authentification (JWT)**

⚠️ **Non configuré automatiquement** : vous devez définir ce secret en production.

```bash
AXILUM_AUTH_SECRET=un_secret_long_aleatoire
```

- **Utilisé dans** : `auth-login`, `auth-verify` et tous les endpoints protégés via `Authorization: Bearer <jwt>`.
- **Impact** : si manquant, le login/verify échoue (erreur `AXILUM_AUTH_SECRET manquant`).
- **Génération recommandée** (exemples) :
  - `openssl rand -base64 48`
  - `openssl rand -hex 32`
- **Rotation** : si vous changez ce secret, tous les JWT existants deviennent invalides (les utilisateurs devront se reconnecter).

### Provisionnement utilisateur (Instant Code) — admin-only

Utile pour créer un utilisateur **sans dépendre d'un provider email** (ex: SendGrid) en environnement de production.

Variables:

```bash
# Active/désactive les endpoints /api/generate-instant-code et /api/verify-instant-code
INSTANT_CODE_ENABLED=0

# Recommande: exiger une clé admin en prod
INSTANT_CODE_REQUIRE_ADMIN=1
ADMIN_API_KEY=...
```

Recommandation:
- Activez `INSTANT_CODE_ENABLED=1` uniquement le temps de créer le compte.
- Remettez `INSTANT_CODE_ENABLED=0` après.

#### Mode DEV (bypass de login)

Pour tester rapidement les endpoints protégés (ex: Agent ToDo `/api/tasks/*`) sans config e-mail (SendGrid/Azure Communication), vous pouvez forcer une identité en **développement uniquement** :

```bash
AXILUM_DEV_AUTH_EMAIL=votre@email.test
```

Notes:
- Ce fallback est ignoré quand `NODE_ENV=production`.
- Utile si `TODO_TASKS_REQUIRE_AUTH=true` mais que le flux login/verify n'est pas encore opérationnel.

### 1. **GROQ API** (IA - LLM Principal)
```bash
GROQ_API_KEY=votre_clé_groq_ici
```
**Utilisé dans** : invoke, invoke-v2, invokeFree, taskManager, excelAssistant, translate, hallucinationDetector
**Obtenir la clé** : https://console.groq.com/

### Suivi & budget IA (Azure Table)

- `AZURE_STORAGE_CONNECTION_STRING` (ou `APPSETTING_AZURE_STORAGE_CONNECTION_STRING`) : requis pour persister les métriques dans Azure Table.
- `AI_BUDGET_MONTHLY` : budget mensuel (nombre). Si défini et > 0, l'API bloque quand le budget est dépassé.
- `AI_BUDGET_CURRENCY` : devise affichée (ex: `USD`, `EUR`, `DZD`).
- `AI_PRICING_JSON` : table de prix par modèle (JSON). Format recommandé (prix par 1M tokens):
  - `{"llama-3.3-70b-versatile":{"in":0.0,"out":0.0},"llama-3.1-8b-instant":{"in":0.0,"out":0.0}}`
- `AI_PRICING_CURRENCY` : devise des prix dans `AI_PRICING_JSON` (défaut: `EUR`).
- `AI_COST_CURRENCY` : devise dans laquelle on calcule les coûts (défaut: `EUR`).
- `AI_FX_USD_TO_EUR` : taux de conversion si `AI_PRICING_CURRENCY=USD` et `AI_COST_CURRENCY=EUR`.

### Rate limiting (Azure Table)

Pour limiter le bruteforce sur certains endpoints (codes / vérifications), l'app peut persister les compteurs dans Azure Table (multi-instances).

- `AZURE_STORAGE_CONNECTION_STRING` (ou `APPSETTING_AZURE_STORAGE_CONNECTION_STRING`) : requis.
- `RATE_LIMIT_TABLE_ENABLED` : défaut `true` (mettre `false` pour désactiver et revenir au mode mémoire).
- `RATE_LIMIT_TABLE_NAME` : défaut `RateLimits`.
- `RATE_LIMIT_CLEANUP_ENABLED` : si `1`, active l'endpoint admin `POST /api/admin-rate-limits-cleanup` en production (sinon 404).

Notes:
- Les clés stockées sont hashées (pas d'IP/email/token en clair).
- En mode serverless, la persistance Table est recommandée pour une limitation cohérente entre instances.

### Quota prépayé utilisateur (EUR)

- `AI_CREDIT_ENFORCE=1` : active le blocage basé sur le crédit prépayé utilisateur.
- Stockage: table `UserCredits` (PartitionKey par user, RowKey `BALANCE`) avec `balanceCents` en centimes.

Notes:
- Si `AI_CREDIT_ENFORCE=1`, il faut aussi configurer `AI_PRICING_JSON` sinon l'API ne peut pas calculer le coût.
- Si vos prix Groq sont en USD (cas courant), utilisez:
  - `AI_PRICING_CURRENCY=USD`
  - `AI_COST_CURRENCY=EUR`
  - `AI_FX_USD_TO_EUR=0.92` (exemple)

Exemple `AI_PRICING_JSON` (USD / 1M tokens, à adapter aux IDs exacts des modèles):

```json
{
  "gpt-oss-20b": { "in": 0.075, "out": 0.30 },
  "gpt-oss-safeguard-20b": { "in": 0.075, "out": 0.30 },
  "gpt-oss-120b": { "in": 0.15, "out": 0.60 },
  "llama-4-scout": { "in": 0.11, "out": 0.34 },
  "llama-4-maverick": { "in": 0.20, "out": 0.60 },
  "llama-guard-4": { "in": 0.20, "out": 0.20 },
  "qwen3-32b": { "in": 0.29, "out": 0.59 },
  "llama-3.3-70b-versatile": { "in": 0.59, "out": 0.79 },
  "llama-3.1-8b-instant": { "in": 0.05, "out": 0.08 }
}
```

---

## 📦 Estimation des coûts Azure (pour fixer un prix + marge)

L'application utilise aussi des services Azure (Table Storage, Blob Storage, Vision/OCR, Email). Pour estimer ces coûts et produire un prix de vente « raisonnable + marge », l'endpoint `GET /api/admin-cost-estimate` calcule:
- Coût IA (depuis `AiUsageMonthly.totalCost`)
- Surcoûts Azure estimés (configurables)
- Prix conseillé = (coût total + fixe) × (1 + marge)

Variables (toutes en EUR):

```bash
# (Optionnel) sécurise l'endpoint /api/admin-cost-estimate
ADMIN_API_KEY=...

# Pricing (marge)
PRICING_MARGIN_PCT=0.15
PRICING_FIXED_EUR=0

# Azure overhead (mettre à jour selon votre région/pricing Azure)
AZ_COST_FIXED_MONTHLY_EUR=0
AZ_COST_TABLE_EUR_PER_100K_TXN=0
AZ_COST_TABLE_TXN_PER_AI_CALL=8
AZ_COST_FUNCTIONS_EUR_PER_1M_INVOCATIONS=0
AZ_COST_FUNCTIONS_INVOCATIONS_PER_AI_CALL=1

AZ_COST_BLOB_EUR_PER_GB_MONTH=0
AZ_COST_BLOB_EUR_PER_10K_WRITE=0
AZ_COST_BLOB_EUR_PER_10K_READ=0
AZ_COST_EGRESS_EUR_PER_GB=0

AZ_COST_VISION_EUR_PER_1K_TXN=0
AZ_COST_FORMRECOGNIZER_EUR_PER_1K_PAGES=0
AZ_COST_EMAIL_EUR_PER_1K=0
```

Tester avec overrides (POST JSON):

```json
{
  "azure": {
    "blobStorageGbMonth": 5,
    "blobWrites": 200,
    "blobReads": 800,
    "egressGb": 10,
    "visionTransactions": 100,
    "formRecognizerPages": 500,
    "emailsSent": 50
  }
}
```

Notes:
- Le blocage se base sur les coûts calculés à partir de `usage.prompt_tokens` / `usage.completion_tokens` retournés par Groq.
- Les écritures se font dans les tables `AiUsage` (détails) et `AiUsageMonthly` (agrégats mensuels).
---

### 2. **Azure Storage** (Stockage utilisateurs et données)
```bash
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
```
**Utilisé dans** : tableStorage, userStorage, sendVerificationEmail
**Obtenir** : Azure Portal > Storage Account > Access Keys

---

### 3. **Azure Communication Services** (Emails)
```bash
AZURE_COMMUNICATION_CONNECTION_STRING=endpoint=https://...;accesskey=...
AZURE_COMMUNICATION_SENDER=DoNotReply@votre-domaine.azurecomm.net
```
**Utilisé dans** : testSendEmail, diagnosticEmail, test_email_production
**Obtenir** : Azure Portal > Communication Services > Keys

---

### 4. **Brave Search API** (Recherche web)
```bash
BRAVE_API_KEY=votre_clé_brave_ici
```
**Utilisé dans** : invoke, invokeFree (pour recherche web)
**Obtenir la clé** : https://brave.com/search/api/

---

### 5. **Azure Vision** (Analyse d'images Pro)
```bash
AZURE_VISION_ENDPOINT=https://votre-instance.cognitiveservices.azure.com
AZURE_VISION_KEY=votre_clé_vision_ici
```
**Utilisé dans** : analyzeImagePro
**Obtenir** : Azure Portal > Computer Vision > Keys and Endpoint

---

### 6. **Gemini API** (IA - Vérification hallucination)
```bash
GEMINI_API_KEY=votre_clé_gemini_ici
```
**Utilisé dans** : hallucinationDetector
**Obtenir la clé** : https://makersuite.google.com/app/apikey

---

### 7. **Google Fact Check API** (Vérification des faits)
```bash
GOOGLE_FACT_CHECK_API_KEY=votre_clé_factcheck_ici
```
**Utilisé dans** : factChecker, invokeFree
**Obtenir** : https://console.cloud.google.com/

---

### 8. **SendGrid** (Emails - Alternative)
```bash
SENDGRID_API_KEY=SG.votre_clé_sendgrid_ici
SENDGRID_SENDER=noreply@axilum.ai
```
**Utilisé dans** : sendVerificationEmail
**Obtenir** : https://sendgrid.com/

---

## 🚀 Comment configurer les variables dans Azure

### Méthode 1 : Via Azure CLI (Recommandé)

```bash
az staticwebapp appsettings set \
  --name Axilum2030 \
  --resource-group Axilum2030_group \
  --setting-names \
    GROQ_API_KEY="votre_clé" \
    AZURE_STORAGE_CONNECTION_STRING="votre_connection_string" \
    AZURE_COMMUNICATION_CONNECTION_STRING="votre_connection_string" \
    AZURE_COMMUNICATION_SENDER="DoNotReply@votre-domaine.azurecomm.net" \
    BRAVE_API_KEY="votre_clé" \
    AZURE_VISION_ENDPOINT="https://votre-instance.cognitiveservices.azure.com" \
    AZURE_VISION_KEY="votre_clé" \
    GEMINI_API_KEY="votre_clé" \
    GOOGLE_FACT_CHECK_API_KEY="votre_clé" \
    SENDGRID_API_KEY="votre_clé" \
    SENDGRID_SENDER="noreply@axilum.ai"
```

### Méthode 2 : Via le portail Azure

1. Allez sur : https://portal.azure.com
2. Recherchez "Axilum2030" dans la barre de recherche
3. Sélectionnez votre Static Web App
4. Dans le menu de gauche, cliquez sur **"Configuration"**
5. Cliquez sur **"+ Add"** pour chaque variable
6. Entrez le nom et la valeur de chaque variable
7. Cliquez sur **"Save"** en haut de la page

---

## 📝 Script de configuration automatique

Créez un fichier `.env.azure` (NE PAS COMMIT) avec vos valeurs :

```bash
# .env.azure (à créer localement - NE PAS COMMIT)
GROQ_API_KEY=votre_clé_groq
AZURE_STORAGE_CONNECTION_STRING=votre_connection_string
AZURE_COMMUNICATION_CONNECTION_STRING=votre_connection_string
AZURE_COMMUNICATION_SENDER=DoNotReply@votre-domaine.azurecomm.net
BRAVE_API_KEY=votre_clé_brave
AZURE_VISION_ENDPOINT=https://votre-instance.cognitiveservices.azure.com
AZURE_VISION_KEY=votre_clé_vision
GEMINI_API_KEY=votre_clé_gemini
GOOGLE_FACT_CHECK_API_KEY=votre_clé_factcheck
SENDGRID_API_KEY=votre_clé_sendgrid
SENDGRID_SENDER=noreply@axilum.ai
```

Puis exécutez ce script :

```bash
#!/bin/bash
# configure-azure-env.sh

# Charger les variables depuis .env.azure
source .env.azure

# Configurer dans Azure Static Web App
az staticwebapp appsettings set \
  --name Axilum2030 \
  --resource-group Axilum2030_group \
  --setting-names \
    GROQ_API_KEY="$GROQ_API_KEY" \
    AZURE_STORAGE_CONNECTION_STRING="$AZURE_STORAGE_CONNECTION_STRING" \
    AZURE_COMMUNICATION_CONNECTION_STRING="$AZURE_COMMUNICATION_CONNECTION_STRING" \
    AZURE_COMMUNICATION_SENDER="$AZURE_COMMUNICATION_SENDER" \
    BRAVE_API_KEY="$BRAVE_API_KEY" \
    AZURE_VISION_ENDPOINT="$AZURE_VISION_ENDPOINT" \
    AZURE_VISION_KEY="$AZURE_VISION_KEY" \
    GEMINI_API_KEY="$GEMINI_API_KEY" \
    GOOGLE_FACT_CHECK_API_KEY="$GOOGLE_FACT_CHECK_API_KEY" \
    SENDGRID_API_KEY="$SENDGRID_API_KEY" \
    SENDGRID_SENDER="$SENDGRID_SENDER"

echo "✅ Variables d'environnement configurées dans Azure Static Web App"
```

---

## 🔍 Vérifier les variables configurées

```bash
# Lister toutes les variables
az staticwebapp appsettings list \
  --name Axilum2030 \
  --resource-group Axilum2030_group

# Voir uniquement les noms (sans les valeurs)
az staticwebapp appsettings list \
  --name Axilum2030 \
  --resource-group Axilum2030_group \
  --query "properties" \
  --output table
```

---

## 🧪 Tester la configuration

Après avoir configuré les variables, testez avec :

```bash
# Test de l'endpoint diagnostic
curl https://delightful-rock-0b18acd1e.3.azurestaticapps.net/api/diagnosticEmail

# Test de configuration
curl https://delightful-rock-0b18acd1e.3.azurestaticapps.net/api/testConfig
```

---

## ⚠️ Variables optionnelles selon les fonctionnalités

### Boost interne Axilum (enrichissement invisible)
Permet à Axilum de consulter des "notes internes" (agents experts) sur les requêtes complexes, sans changer l'UX.

```bash
# Active/désactive le boost interne (défaut: true)
AXILUM_INTERNAL_BOOST_ENABLED=true

# Limite le nombre d'experts consultés (0-3, défaut: 2)
AXILUM_INTERNAL_BOOST_MAX_AGENTS=2

# Limite le nombre de tours d'historique injectés dans la requête interne (0-10, défaut: 6)
AXILUM_INTERNAL_BOOST_MAX_TURNS=6
```

### Si vous n'utilisez PAS certaines fonctionnalités :

- **Pas d'analyse d'images Pro** → Pas besoin de `AZURE_VISION_*`
- **Pas de recherche web** → Pas besoin de `BRAVE_API_KEY`
- **Pas de fact-checking** → Pas besoin de `GOOGLE_FACT_CHECK_API_KEY`
- **Pas de Gemini** → Pas besoin de `GEMINI_API_KEY`
- **Utilisation d'Azure Communication seulement** → Pas besoin de `SENDGRID_*`

---

## 🔒 Sécurité

- **JAMAIS** commiter les fichiers `.env*` dans Git
- Ajoutez `.env.azure` dans votre `.gitignore`
- Les variables sont chiffrées dans Azure
- Utilisez des clés API avec des permissions minimales nécessaires
- Rotez régulièrement vos clés API

---

## 📚 Documentation liée

- [Azure Static Web Apps - Application Settings](https://docs.microsoft.com/en-us/azure/static-web-apps/application-settings)
- [GROQ API Documentation](https://console.groq.com/docs)
- [Brave Search API](https://brave.com/search/api/)
- [Azure Communication Services](https://docs.microsoft.com/en-us/azure/communication-services/)

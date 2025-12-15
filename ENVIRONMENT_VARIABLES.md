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

### 1. **GROQ API** (IA - LLM Principal)
```bash
GROQ_API_KEY=votre_clé_groq_ici
```
**Utilisé dans** : invoke, invoke-v2, invokeFree, taskManager, excelAssistant, translate, hallucinationDetector
**Obtenir la clé** : https://console.groq.com/

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

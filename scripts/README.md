# 🚀 Scripts de Configuration Automatique

## 📋 Vue d'ensemble

Scripts CLI pour configurer automatiquement Azure Face API et Google Custom Search pour Axilum2030.

---

## 🎯 Scripts Disponibles

### 🔐 Provisionner un utilisateur (PROD, sans SendGrid)

Crée un utilisateur via les endpoints admin (instant code) puis vérifie un login.

```bash
APP_URL="https://<votre-app>.azurewebsites.net" \
EMAIL="user@example.com" \
DISPLAY_NAME="User" \
./scripts/provision-prod-user.sh
```

Si l'endpoint est protégé (recommandé en prod), ajoute aussi :

```bash
ADMIN_API_KEY="<admin_key>"
```

Prérequis côté prod:
- `INSTANT_CODE_ENABLED=1` (temporaire)
- Recommandé: `ADMIN_API_KEY` + `INSTANT_CODE_REQUIRE_ADMIN=1`
- Recommandé après création: remettre `INSTANT_CODE_ENABLED=0`

### 1️⃣ **Configuration Complète** (Recommandé)
```bash
./setup-vision-complete.sh
```
Configure tout automatiquement en une seule commande :
- ✅ Crée Azure Face API
- ✅ Configure Google Custom Search
- ✅ Déploie les variables sur Azure
- ✅ Teste la configuration

### 2️⃣ **Azure Face API uniquement**
```bash
./scripts/setup-azure-face.sh
```
Crée et configure Azure Face API pour la détection d'âge/genre.

### 3️⃣ **Google Search uniquement**
```bash
./scripts/configure-google-search.sh
```
Configure Google Custom Search pour la recherche d'images inversée.

### 4️⃣ **Test de Configuration**
```bash
./test-vision-config.sh
```
Vérifie que toutes les variables sont correctement configurées.

---

## 🔧 Prérequis

### Azure CLI
```bash
# Vérifier si installé
az --version

# Installer (si nécessaire)
# Linux/WSL
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# macOS
brew install azure-cli

# Windows
# Télécharger: https://aka.ms/installazurecliwindows
```

### Connexion Azure
```bash
# Se connecter
az login

# Vérifier la connexion
az account show
```

### Credentials Requis

#### Pour Azure Face API
Aucun credential externe requis - tout est créé automatiquement !

#### Pour Google Custom Search
1. **API Key**:
   - Allez sur [Google Cloud Console](https://console.cloud.google.com/)
   - APIs & Services → Credentials → Create Credentials → API Key
   - Activez "Custom Search API"

2. **Search Engine ID (cx)**:
   - Allez sur [Programmable Search Engine](https://programmablesearchengine.google.com/)
   - Create → Configure votre moteur de recherche
   - Copiez l'ID du moteur

---

## 📖 Guide d'Utilisation

### Option A : Configuration Complète (Recommandé)

```bash
# Étape 1 : Exécuter le script principal
./setup-vision-complete.sh

# Le script va :
# 1. Créer Azure Face API automatiquement
# 2. Demander vos credentials Google Search
# 3. Configurer tout dans Azure
# 4. Tester la configuration

# Étape 2 : Tester localement
npm run dev
```

### Option B : Configuration Manuelle par Étapes

```bash
# 1. Créer Azure Face API
./scripts/setup-azure-face.sh

# 2. Configurer Google Search
./scripts/configure-google-search.sh

# 3. Vérifier la configuration
./test-vision-config.sh

# 4. Tester
npm run dev
```

---

## 🎯 Ce que font les Scripts

### `setup-azure-face.sh`

1. ✅ Vérifie la connexion Azure
2. ✅ Crée la ressource Azure Face API (tier gratuit F0)
3. ✅ Récupère automatiquement l'endpoint et la clé
4. ✅ Configure les variables dans Azure Static Web App
5. ✅ Met à jour `.env.azure` et `api/.env.local`
6. ✅ Crée des backups automatiques

**Variables configurées**:
```bash
AZURE_FACE_KEY=...
AZURE_FACE_ENDPOINT=https://axilum2030-face.cognitiveservices.azure.com
```

### `configure-google-search.sh`

1. ✅ Vérifie la connexion Azure
2. ✅ Demande vos credentials Google
3. ✅ Configure les variables dans Azure Static Web App
4. ✅ Met à jour `.env.azure` et `api/.env.local`
5. ✅ Crée des backups automatiques

**Variables configurées**:
```bash
GOOGLE_SEARCH_API_KEY=...
GOOGLE_SEARCH_CX=...
```

### `test-vision-config.sh`

1. ✅ Vérifie `api/.env.local`
2. ✅ Liste toutes les variables configurées
3. ✅ Affiche l'état de chaque service
4. ✅ Donne des recommandations

---

## 📊 Résultats Attendus

### Avec Azure Face API Configurée
```json
{
  "faceCount": 1,
  "faces": [
    {
      "age": 32,
      "gender": "male",
      "smile": 0.8,
      "emotion": { "happiness": 0.9 },
      "glasses": "NoGlasses"
    }
  ],
  "apiUsed": "Azure Face API v1.0"
}
```

### Sans Azure Face API (Fallback)
```json
{
  "faceCount": 1,
  "faces": [
    {
      "age": "N/A",
      "gender": "N/A",
      "faceRectangle": { ... }
    }
  ],
  "apiUsed": "Computer Vision v3.2 (age/gender deprecated)"
}
```

---

## 🔍 Dépannage

### Erreur : `az: command not found`
```bash
# Installez Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### Erreur : `Please run 'az login'`
```bash
# Connectez-vous à Azure
az login
```

### Erreur : `Resource group not found`
```bash
# Créez le resource group
az group create --name Axilum2030_group --location francecentral
```

### Erreur : `Static Web App not found`
```bash
# Vérifiez le nom de votre app
az staticwebapp list --resource-group Axilum2030_group --query "[].name"

# Modifiez le nom dans le script si nécessaire
```

### Les variables ne sont pas visibles dans Azure
```bash
# Vérifiez la configuration
az staticwebapp appsettings list \
  --name Axilum2030 \
  --resource-group Axilum2030_group

# Reconfigurez si nécessaire
./configure-azure-env.sh
```

---

## 💰 Coûts

### Azure Face API

| Tier | Prix | Transactions | Limite/minute |
|------|------|--------------|---------------|
| F0 (Free) | Gratuit | 30,000/mois | 20/min |
| S0 (Standard) | $1/1000 | Illimité | Variable |

### Google Custom Search

| Plan | Prix | Requêtes |
|------|------|----------|
| Gratuit | $0 | 100/jour |
| Avec facturation | $5/1000 requêtes | 10,000/jour max |

### Pour augmenter les limites

```bash
# Azure Face : passer au tier Standard
az cognitiveservices account update \
  --name Axilum2030-Face \
  --resource-group Axilum2030_group \
  --sku S0
```

---

## 📚 Documentation

- [GUIDE_CONFIG_VISION_SEARCH.md](../GUIDE_CONFIG_VISION_SEARCH.md) - Guide complet de configuration
- [FIX_VISION_GOOGLE_SEARCH.md](../FIX_VISION_GOOGLE_SEARCH.md) - Correction des problèmes
- [Azure Face API Docs](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-identity)
- [Google Custom Search Docs](https://developers.google.com/custom-search/v1/introduction)

---

## ✅ Checklist

Avant d'exécuter les scripts :
- [ ] Azure CLI installé (`az --version`)
- [ ] Connecté à Azure (`az login`)
- [ ] Resource group existe (`az group show --name Axilum2030_group`)
- [ ] Static Web App existe (`az staticwebapp show --name Axilum2030`)

Pour Google Search (optionnel) :
- [ ] Google Cloud projet créé
- [ ] Custom Search API activée
- [ ] API Key créée
- [ ] Search Engine configuré (cx obtenu)

Après exécution :
- [ ] `./test-vision-config.sh` passe sans erreur
- [ ] Variables visibles dans Azure Portal
- [ ] Test local fonctionne (`npm run dev`)
- [ ] Test Azure fonctionne (site déployé)

---

## 🎉 Résultat Final

✅ **Azure Face API** : Créée et configurée automatiquement  
✅ **Google Search** : Configuré avec vos credentials  
✅ **Variables Azure** : Déployées sur Azure Static Web App  
✅ **Fichiers locaux** : Mis à jour automatiquement  
✅ **Backups** : Créés automatiquement  
✅ **Tests** : Configuration validée  

**La détection de visage retourne maintenant âge, genre et émotions !**

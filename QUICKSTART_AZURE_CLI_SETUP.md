# 🚀 Guide Rapide : Configuration Azure via CLI

## ⚡ Démarrage Rapide

### Option 1 : Configuration Automatique Complète (Recommandé)

```bash
# Une seule commande pour tout configurer !
./setup-vision-complete.sh
```

Cela va :
1. ✅ Créer Azure Face API (gratuit)
2. ✅ Configurer Google Custom Search
3. ✅ Déployer sur Azure Static Web App
4. ✅ Mettre à jour les fichiers locaux
5. ✅ Tester la configuration

---

## 📋 Prérequis (5 minutes)

### 1. Installer Azure CLI
```bash
# Linux/WSL/Codespaces
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# macOS
brew install azure-cli

# Vérifier
az --version
```

### 2. Se connecter à Azure
```bash
az login

# Si vous êtes dans Codespaces/WSL, utilisez
az login --use-device-code
```

### 3. Obtenir vos credentials Google (optionnel)

#### API Key
1. [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials
3. Create Credentials → API Key
4. Activez "Custom Search API"

#### Search Engine ID (cx)
1. [Programmable Search Engine](https://programmablesearchengine.google.com/)
2. Create → Configurez votre moteur
3. Copiez l'ID (cx)

---

## 🎯 Commandes Disponibles

### Configuration Complète
```bash
./setup-vision-complete.sh
# Configure tout en une fois
```

### Azure Face API uniquement
```bash
./scripts/setup-azure-face.sh
# Crée et configure Azure Face API pour détection âge/genre
```

### Google Search uniquement
```bash
./scripts/configure-google-search.sh
# Configure Google Custom Search
```

### Test de Configuration
```bash
./test-vision-config.sh
# Vérifie que tout est configuré correctement
```

---

## 📊 Ce qui sera créé

### Ressources Azure
```
Axilum2030-Face (Azure Face API)
├── Tier: F0 (Gratuit)
├── Location: francecentral
├── Endpoint: https://axilum2030-face.cognitiveservices.azure.com
└── Key: Généré automatiquement
```

### Variables dans Azure Static Web App
```bash
AZURE_FACE_KEY=...
AZURE_FACE_ENDPOINT=...
GOOGLE_SEARCH_API_KEY=...
GOOGLE_SEARCH_CX=...
```

### Fichiers mis à jour
```
.env.azure              # Credentials pour Azure (avec backup)
api/.env.local          # Credentials pour dev local (avec backup)
```

---

## 🧪 Tester la Configuration

### 1. Test Local
```bash
# Vérifier les variables
./test-vision-config.sh

# Lancer l'app
npm run dev

# Tester dans l'interface Vision
# → Upload une image avec visage
# → Devrait retourner âge, genre, émotions
```

### 2. Test Azure
```bash
# Vérifier les variables déployées
az staticwebapp appsettings list \
  --name Axilum2030 \
  --resource-group Axilum2030_group

# Tester l'API
curl -X POST https://axilum2030.azurestaticapps.net/api/vision-face \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"..."}'
```

---

## 📸 Résultats Attendus

### Avant (sans Face API)
```json
{
  "faces": [{
    "age": "N/A",
    "gender": "N/A"
  }]
}
```

### Après (avec Face API)
```json
{
  "faces": [{
    "age": 32,
    "gender": "male",
    "smile": 0.8,
    "emotion": {
      "happiness": 0.9,
      "neutral": 0.1
    },
    "glasses": "NoGlasses"
  }],
  "apiUsed": "Azure Face API v1.0"
}
```

---

## 🔍 Dépannage Rapide

### `az: command not found`
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### `Please run 'az login'`
```bash
az login --use-device-code
```

### `Resource group not found`
```bash
az group create --name Axilum2030_group --location francecentral
```

### Les variables ne sont pas visibles
```bash
# Vérifier
az staticwebapp appsettings list \
  --name Axilum2030 \
  --resource-group Axilum2030_group

# Reconfigurer
./configure-azure-env.sh
```

### Le script s'arrête avec une erreur
```bash
# Mode debug
bash -x ./scripts/setup-azure-face.sh

# Vérifier les logs
cat /tmp/azure-setup.log
```

---

## 💡 Conseils

### Tier Gratuit Suffisant ?

**Azure Face API (F0)** :
- ✅ 30,000 transactions/mois
- ✅ 20 transactions/minute
- ✅ Parfait pour prototypage et petites apps

**Google Search (gratuit)** :
- ✅ 100 requêtes/jour
- ✅ Suffisant pour usage occasionnel

### Augmenter les Limites

Si vous dépassez les limites :

```bash
# Azure Face : passer à S0 (Standard)
az cognitiveservices account update \
  --name Axilum2030-Face \
  --resource-group Axilum2030_group \
  --sku S0
# Prix : ~$1 pour 1000 transactions
```

---

## 📚 Documentation Complète

- [scripts/README.md](scripts/README.md) - Documentation détaillée des scripts
- [GUIDE_CONFIG_VISION_SEARCH.md](GUIDE_CONFIG_VISION_SEARCH.md) - Guide de configuration manuel
- [FIX_VISION_GOOGLE_SEARCH.md](FIX_VISION_GOOGLE_SEARCH.md) - Explications des corrections

---

## ✅ Checklist de Configuration

### Avant de commencer
- [ ] Azure CLI installé
- [ ] Connecté à Azure (`az login`)
- [ ] Resource group existe
- [ ] Google credentials prêts (optionnel)

### Configuration
- [ ] Exécuté `./setup-vision-complete.sh`
- [ ] Azure Face API créée
- [ ] Variables configurées dans Azure
- [ ] Fichiers locaux mis à jour

### Tests
- [ ] `./test-vision-config.sh` passe
- [ ] Test local fonctionne
- [ ] Test Azure fonctionne
- [ ] Détection retourne âge/genre

---

## 🎉 Résultat

✅ **Azure Face API** créée en 2 minutes  
✅ **Variables** déployées automatiquement  
✅ **Fichiers locaux** mis à jour avec backups  
✅ **Configuration** testée et validée  

**La détection de visage retourne maintenant toutes les informations !**

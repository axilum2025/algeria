# Guide de Configuration - Vision & Recherche Google

## 🎯 Problèmes Résolus

### ✅ **Problème 1**: Google Custom Search non configuré
**Symptôme**: `Google Custom Search peut être lancé directement (si configurée)`

### ✅ **Problème 2**: Détection de visage retourne âge N/A, genre N/A
**Symptôme**: `Visage 1 : âge N/A, genre N/A (rect=57,52,83x83)`

---

## 📋 Configuration Requise

### 1️⃣ **Google Custom Search API**

#### Créer une Custom Search Engine
1. Allez sur [Google Programmable Search Engine](https://programmablesearchengine.google.com/)
2. Cliquez sur **"Add"** ou **"Create"**
3. Configurez:
   - **Sites to search**: `www.google.com` (ou spécifiez vos sites)
   - **Name**: `Axilum Search`
   - Activez **"Search the entire web"**
4. Récupérez votre **Search Engine ID (cx)**

#### Obtenir une API Key
1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Activez **Custom Search API**
3. Créez des identifiants → **API Key**
4. Copiez votre clé API

#### Configuration Locale
```bash
# Dans api/.env.local (créez-le depuis api/.env.local.example)
GOOGLE_SEARCH_API_KEY=votre_clé_api_ici
GOOGLE_SEARCH_CX=votre_search_engine_id_ici
```

#### Configuration Azure
```bash
# Dans .env.azure
GOOGLE_SEARCH_API_KEY=votre_clé_api_ici
GOOGLE_SEARCH_CX=votre_search_engine_id_ici

# Puis exécutez
./configure-azure-env.sh
```

---

### 2️⃣ **Azure Face API (pour âge/genre)**

#### 🚨 Important
**Azure Computer Vision v3.2** ne retourne **plus** les informations d'âge et de genre depuis 2020 pour des raisons éthiques. Il faut utiliser **Azure Face API** à la place.

#### Créer une ressource Face API
1. Allez sur [Azure Portal](https://portal.azure.com/)
2. Créez une ressource **"Face"** (pas Computer Vision)
3. Récupérez:
   - **Endpoint**: `https://votre-instance.cognitiveservices.azure.com`
   - **Key**: Clé d'accès 1 ou 2

#### Configuration Locale
```bash
# Dans api/.env.local
AZURE_FACE_KEY=votre_clé_face_api
AZURE_FACE_ENDPOINT=https://votre-instance.cognitiveservices.azure.com
```

#### Configuration Azure
```bash
# Dans .env.azure
AZURE_FACE_KEY=votre_clé_face_api
AZURE_FACE_ENDPOINT=https://votre-instance.cognitiveservices.azure.com

# Puis exécutez
./configure-azure-env.sh
```

---

## 🔧 Modifications Effectuées

### 1. [api/.env.local.example](api/.env.local.example)
Ajout des variables:
```bash
# Google Custom Search
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_CX=

# Azure Face API
AZURE_FACE_KEY=
AZURE_FACE_ENDPOINT=
```

### 2. [api/vision-face/index.js](api/vision-face/index.js)
- ✅ Détection automatique de Face API (si configurée)
- ✅ Fallback sur Computer Vision v3.2 (mais âge/genre = N/A)
- ✅ Retourne maintenant: âge, genre, smile, emotion, glasses
- ✅ Indique quelle API a été utilisée dans la réponse

### 3. [configure-azure-env.sh](configure-azure-env.sh)
Ajout de la configuration pour:
- `GOOGLE_SEARCH_API_KEY`
- `GOOGLE_SEARCH_CX`
- `AZURE_FACE_KEY`
- `AZURE_FACE_ENDPOINT`

---

## 🧪 Tests

### Test Google Search
```bash
curl -X POST https://localhost:7071/api/vision-reverse-google \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"..."}'
```

**Avant**: 
```json
{
  "error": "Google Custom Search not configured"
}
```

**Après** (avec config):
```json
{
  "results": [
    {
      "title": "Similar image found",
      "link": "https://...",
      "snippet": "..."
    }
  ]
}
```

### Test Détection de Visage

#### Sans Azure Face API (Computer Vision uniquement)
```json
{
  "faceCount": 1,
  "faces": [
    {
      "age": "N/A",
      "gender": "N/A",
      "faceRectangle": { "left": 57, "top": 52, "width": 83, "height": 83 }
    }
  ],
  "apiUsed": "Computer Vision v3.2 (age/gender deprecated)"
}
```

#### Avec Azure Face API configurée
```json
{
  "faceCount": 1,
  "faces": [
    {
      "age": 32,
      "gender": "male",
      "smile": 0.8,
      "emotion": {
        "happiness": 0.9,
        "neutral": 0.1
      },
      "glasses": "NoGlasses",
      "faceRectangle": { "left": 57, "top": 52, "width": 83, "height": 83 }
    }
  ],
  "apiUsed": "Azure Face API v1.0"
}
```

---

## 📚 Documentation

### Google Custom Search
- [Setup Guide](https://developers.google.com/custom-search/v1/introduction)
- [API Reference](https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list)

### Azure Face API
- [Overview](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-identity)
- [Face Detection](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/concept-face-detection)
- [Migration from Computer Vision](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/identity-overview#deprecated-features)

---

## ✅ Checklist

- [ ] Google Search API Key créée
- [ ] Google Search Engine ID (cx) récupéré
- [ ] Variables ajoutées dans `api/.env.local`
- [ ] Azure Face API ressource créée
- [ ] Variables Azure Face ajoutées dans `.env.azure`
- [ ] Script `./configure-azure-env.sh` exécuté
- [ ] Tests effectués localement
- [ ] Déploiement sur Azure vérifié

---

## 🎯 Résultat Final

✅ **Google Custom Search**: Fonctionne si `GOOGLE_SEARCH_API_KEY` et `GOOGLE_SEARCH_CX` configurés  
✅ **Détection de visage**: Retourne âge, genre, émotions avec Azure Face API  
✅ **Fallback gracieux**: Utilise Computer Vision si Face API non disponible  
✅ **Transparence**: La réponse indique quelle API a été utilisée

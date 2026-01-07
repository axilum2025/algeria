# ⚠️ Azure Face API - Attributs Dépréciés (2024)

## 🚨 Erreur Rencontrée

```
Error: InvalidRequest - UnsupportedFeature
Message: Return Attributes (emotion, gender, age, smile, facial hair, hair and makeup) 
have been deprecated and are no longer supported.
```

## 📋 Attributs Dépréciés

Azure a retiré la support des attributs suivants à partir de **2024** :

| Attribut | Statut | Alternative |
|----------|--------|-------------|
| `age` | ❌ Déprécié | Amazon Rekognition, Google Cloud Vision |
| `gender` | ❌ Déprécié | Services tiers ou modèles locaux |
| `emotion` | ❌ Déprécié | Idem |
| `smile` | ❌ Déprécié | Idem |
| `facialHair` | ❌ Déprécié | Idem |
| `hair` | ❌ Déprécié | Idem |
| `makeup` | ❌ Déprécié | Idem |
| `glasses` | ❌ Déprécié | Idem |
| `accessories` | ❌ Déprécié | Idem |
| `blur` | ❌ Déprécié | Idem |
| `exposure` | ❌ Déprécié | Idem |
| `noise` | ❌ Déprécié | Idem |

**Attributs Toujours Supportés:**
- ✅ `faceId`
- ✅ `faceRectangle` (localisation)
- ✅ `faceLandmarks` (points caractéristiques)

---

## 🔧 Solution Appliquée

### Code Modifié: [api/vision-face/index.js](../api/vision-face/index.js)

```javascript
// AVANT (❌ Erreur 403)
const params = new URLSearchParams({
    returnFaceId: 'true',
    returnFaceLandmarks: 'false',
    returnFaceAttributes: 'age,gender,smile,emotion,glasses'  // ❌ Dépréciés!
});

// APRÈS (✅ Fonctionne)
const params = new URLSearchParams({
    returnFaceId: 'true',
    returnFaceLandmarks: 'false'
    // Attributs dépréciés supprimés
});
```

---

## 📊 Résultat Actuel

La détection retourne maintenant **uniquement** :

```json
{
  "faceCount": 1,
  "faces": [
    {
      "faceId": "12345678-1234-1234-1234-123456789012",
      "faceRectangle": {
        "top": 52,
        "left": 57,
        "width": 83,
        "height": 83
      },
      "faceLandmarks": {
        "pupilLeft": { "x": 65, "y": 60 },
        "pupilRight": { "x": 80, "y": 60 },
        "noseTip": { "x": 72, "y": 75 },
        ...
      }
    }
  ],
  "warning": "Attributs (âge, genre, émotions) ont été dépréciés par Azure"
}
```

---

## 🔍 Alternatives Recommandées

### 1️⃣ **Amazon Rekognition** (Meilleur pour âge/genre)
```bash
# Détecte: age range, gender, emotions, smile, glasses, etc.
Exemple: age: { low: 25, high: 35 }, gender: { value: "Male", confidence: 0.95 }
Coût: $0.001 par image analysée
```

### 2️⃣ **Google Cloud Vision API**
```bash
# Détecte: face detection avec attributs
# Coût: $1.50 par 1000 images
```

### 3️⃣ **Modèles Locaux** (Gratuit)
```bash
# OpenCV + Deep Learning
# Python: opencv-contrib-python, dlib
# Node.js: face-api.js, tracking.js
```

---

## 🔄 Migration vers Amazon Rekognition

Si vous avez besoin d'âge/genre, je peux créer une API qui utilise AWS Rekognition à la place :

```javascript
// Exemple avec AWS Rekognition
const AWS = require('aws-sdk');
const rekognition = new AWS.Rekognition();

const result = await rekognition.detectFaces({
    Image: { Bytes: imageBuffer },
    Attributes: ['ALL']
}).promise();

// Retourne: AgeRange, Gender, Smile, EyesOpen, Confidence, etc.
```

---

## 📝 Fichiers Modifiés

| Fichier | Statut | Détails |
|---------|--------|---------|
| [api/vision-face/index.js](../api/vision-face/index.js) | ✅ Mis à jour | Attributs dépréciés supprimés |
| [api/vision-face-minimal/index.js](../api/vision-face-minimal/index.js) | 🆕 Créé | Version minimal sans attributs |
| [api/vision-face-enhanced/index.js](../api/vision-face-enhanced/index.js) | ⚠️ Non fonctionnel | Utilise attributs dépréciés |

---

## ✅ Prochaines Étapes

### Option 1: Utiliser Uniquement Localisation
```bash
# ✅ Fonctionne maintenant
# Détecte: position du visage, landmarks
# Limite: pas d'âge/genre/émotions
```

### Option 2: Intégrer AWS Rekognition
```bash
# À implémenter
# Détecte: tout (âge, genre, émotions, sourire, etc.)
# Coût: ~$0.001 par image
```

### Option 3: Modèle Local
```bash
# À implémenter
# Détecte: âge, genre avec modèle local
# Coût: 0 (mais moins précis)
```

---

## 📚 Documentation

- [Microsoft Azure Face API - Changelog](https://aka.ms/facerecognition)
- [Amazon Rekognition Documentation](https://docs.aws.amazon.com/rekognition/)
- [Google Cloud Vision Documentation](https://cloud.google.com/vision/docs)

---

## ⚠️ Note Importante

Azure a déprécié ces attributs en raison de **préoccupations éthiques** autour de la reconnaissance biométrique (détection d'âge/genre). C'est une décision politique d'Azure pour limiter les utilisations problématiques.

**Recommandation:** Si vous avez besoin de ces attributs, utilisez une alternative explicitement conçue pour cela (AWS Rekognition) et assurez-vous d'avoir les permissions légales/éthiques appropriées.

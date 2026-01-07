# ⚠️ Azure Face API - Restriction Identification/Verification

## 🚨 Nouvelle Erreur Rencontrée

```
Error: InvalidRequest
Code: UnsupportedFeature
Message: "Feature is not supported, missing approval for one or more 
of the following features: Identification,Verification. 
Please apply for access at https://aka.ms/facerecognition"
```

## 📋 Explication

Microsoft exige une **approbation explicite** pour utiliser certaines fonctionnalités d'identification/vérification de visages pour des raisons de **conformité légale et éthique**.

### Fonctionnalités Restreintes

| Fonctionnalité | Status | Nécessite Approbation |
|---|---|---|
| `returnFaceId` | ⚠️ Restreint | ✅ OUI |
| `Identification` | ⚠️ Restreint | ✅ OUI |
| `Verification` | ⚠️ Restreint | ✅ OUI |
| `Detection` (localisation) | ✅ Libre | ❌ Non |

---

## ✅ Solution Appliquée

### Code Modifié

```javascript
// AVANT (❌ Erreur 403)
const params = new URLSearchParams({
    returnFaceId: 'true',        // ❌ Restreint!
    returnFaceLandmarks: 'false'
});

// APRÈS (✅ Fonctionne)
const params = new URLSearchParams({
    returnFaceId: 'false',       // ✅ Sans approbation requise
    returnFaceLandmarks: 'false'
});
```

### Fichiers Modifiés

- ✅ `api/vision-face/index.js` - returnFaceId set to false
- ✅ `api/vision-face-minimal/index.js` - returnFaceId et returnFaceLandmarks set to false

---

## 📊 Ce Qui Est Possible Maintenant

### Sans Approbation (Gratuit)
```json
{
  "faceCount": 1,
  "faces": [{
    "faceRectangle": {
      "top": 52,
      "left": 57,
      "width": 83,
      "height": 83
    }
  }],
  "message": "Localisation du visage uniquement"
}
```

**Fonctionnalités disponibles:**
- ✅ Détection de présence de visage
- ✅ Localisation (rectangle)
- ✅ Nombre de visages

**Fonctionnalités NON disponibles:**
- ❌ ID du visage (nécessite approbation)
- ❌ Points caractéristiques (nécessite approbation)
- ❌ Âge, genre, émotions (dépréciés + approbation)

---

## 🔓 Si Vous Avez Besoin d'Identification/Verification

### Demander l'Accès à Microsoft

1. Allez sur [aka.ms/facerecognition](https://aka.ms/facerecognition)
2. Remplissez le formulaire d'accès
3. Microsoft examinera votre cas d'usage
4. Approbation en quelques jours/semaines
5. Une fois approuvé, vous pouvez utiliser `returnFaceId: true`

**Conditions Microsoft:**
- Expliquer votre cas d'usage
- Conformité RGPD/CCPA
- Consentement utilisateur clair
- Transparence sur l'utilisation
- Aucune discrimination

---

## 🔧 Alternatives Sans Approbation

### 1. Computer Vision API (Azure)
```javascript
// Pas de restriction d'identification
const analyzeUrl = `${endpoint}/vision/v4.0/analyze?visualFeatures=Faces`;

// Retourne: faceRectangles uniquement
```

### 2. Amazon Rekognition
```javascript
// Pas d'approbation requise
// Retourne: âge, genre, émotions, faceId, etc.
// Prix: $0.001 par image
```

### 3. Google Cloud Vision
```javascript
// Pas d'approbation requise
// Retourne: détection complète
// Prix: $1.50 par 1000 images
```

### 4. Modèles Locaux (Gratuit)
```javascript
// OpenCV, dlib, face-api.js
// Aucune restriction, gratuit
// Moins précis qu'Azure/AWS/Google
```

---

## 📝 Résumé des Restrictions Azure

### Couche 0 : Libre (Pas d'Approbation)
```
✅ Detection (localisation)
✅ Localisation des visages (rectangle)
✅ Comptage de visages
```

### Couche 1 : Restreint (Approbation Requise)
```
⚠️ returnFaceId
⚠️ returnFaceLandmarks
⚠️ Identification
⚠️ Verification
```

### Couche 2 : Déprécié (Retiré)
```
❌ age, gender, emotion, smile
❌ facialHair, hair, makeup, glasses
❌ accessories, blur, exposure, noise
```

---

## 🎯 Cas d'Usage Azure Face API

| Cas d'Usage | Possible | Restriction |
|---|---|---|
| Compter des visages | ✅ Oui | Aucune |
| Localiser des visages | ✅ Oui | Aucune |
| Identifier une personne | ⚠️ Oui | Approbation |
| Vérifier l'identité | ⚠️ Oui | Approbation |
| Détecter l'âge | ❌ Non | Déprécié |
| Détecter le genre | ❌ Non | Déprécié |
| Détecter émotions | ❌ Non | Déprécié |

---

## 📚 Documentation

- [Azure Face API - Approbation](https://aka.ms/facerecognition)
- [Microsoft Responsible AI - Face API](https://learn.microsoft.com/en-us/legal/cognitive-services/computer-vision/responsible-use-of-ai-for-face-api)
- [Amazon Rekognition - Pas de restriction](https://docs.aws.amazon.com/rekognition/)

---

## ⚠️ Important

Microsoft a implémenté ces restrictions pour respecter les normes éthiques et légales de la reconnaissance faciale. C'est une **bonne pratique** qui montre une attention à la protection des droits des utilisateurs.

Si vous avez un cas d'usage légitime d'identification/vérification, demandez l'accès à Microsoft. Le processus est transparent et l'approbation est généralement accordée pour les usages valides.

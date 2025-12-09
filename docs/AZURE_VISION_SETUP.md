# Configuration Azure Computer Vision - Plan PRO

## 📋 Vue d'ensemble

Le plan **PRO** utilise **Azure Computer Vision** (Florence-2) pour l'analyse d'images, offrant :
- ✅ Descriptions détaillées multi-régions
- ✅ Détection d'objets et de personnes
- ✅ Extraction de texte (OCR)
- ✅ Tags et métadonnées
- ✅ Haute précision et fiabilité

Le plan **FREE** utilise Google Gemini Vision (gratuit, 15 req/min).

---

## 🔑 Configuration requise

### 1. Clé API Azure Computer Vision

L'endpoint est déjà configuré :
```
https://axilumazurevision.cognitiveservices.azure.com
```

### 2. Ajouter la clé à Azure Static Web Apps

1. Accédez au [Portail Azure](https://portal.azure.com)
2. Recherchez votre ressource **Computer Vision** : `axilumazurevision`
3. Dans le menu de gauche : **Keys and Endpoint**
4. Copiez **KEY 1** ou **KEY 2**

5. Allez dans votre **Static Web App** : `proud-mushroom-019836d03`
6. Menu de gauche : **Configuration**
7. Cliquez sur **+ Add**
8. Ajoutez la variable :
   - **Name** : `AZURE_VISION_KEY`
   - **Value** : Votre clé copiée
9. Cliquez **OK** puis **Save**

---

## 🧪 Test de la configuration

### Option 1 : Via l'interface web

1. Connectez-vous en mode **PRO**
2. Uploadez une image (JPG, PNG, etc.)
3. Vérifiez le message : `🔍 Analyse avec Azure Vision...`
4. L'analyse devrait afficher : `_Analysé par Azure Computer Vision_`

### Option 2 : Via curl

```bash
curl -X POST https://proud-mushroom-019836d03.3.azurestaticapps.net/api/analyze-image-pro \
  -H "Content-Type: application/json" \
  -d '{
    "imageBase64": "data:image/jpeg;base64,/9j/4AAQ...",
    "question": "Que vois-tu sur cette image ?"
  }'
```

**Réponse attendue** :
```json
{
  "analysis": "**Description :** A person standing in front of a building...",
  "provider": "Azure Computer Vision",
  "model": "Florence-2",
  "confidence": 0.87
}
```

---

## 🔍 Fonctionnalités de l'analyse

### Ce que détecte Azure Vision :

| Fonctionnalité | Description |
|---------------|-------------|
| **Caption** | Description générale de l'image |
| **Dense Captions** | Descriptions détaillées de régions spécifiques |
| **Objects** | Objets détectés avec positions |
| **Tags** | Tags automatiques avec scores de confiance |
| **OCR (Read)** | Extraction de tout texte visible |
| **People** | Détection du nombre de personnes |

### Exemple de sortie :

```
**Description :** Un homme travaillant sur un ordinateur portable dans un café

**Détails :**
- Un ordinateur portable ouvert sur une table
- Une tasse de café à côté du clavier
- Un environnement lumineux avec des fenêtres

**Objets détectés :** laptop, coffee cup, table, chair, window

**Tags :** indoor, person, computer, work, café, technology, modern, business

**Texte extrait :** MENU Coffee Shop Open 8AM-6PM

**Personnes détectées :** 1

_Analysé par Azure Computer Vision_
```

---

## 💰 Coûts Azure Computer Vision

Avec le **Free Tier (F0)** :
- ✅ **5 000 transactions/mois** gratuites
- ✅ Toutes les fonctionnalités incluses
- ✅ Pas de carte de crédit requise

Au-delà du Free Tier :
- **S1** : $1.50 / 1000 transactions

**Estimation pour 100 utilisateurs PRO** :
- 100 users × 50 images/mois = 5 000 images
- Coût : **0€** (dans le Free Tier)

---

## 🆚 Comparaison FREE vs PRO

| Aspect | FREE (Gemini) | PRO (Azure Vision) |
|--------|---------------|-------------------|
| **Provider** | Google Gemini 1.5 Flash | Azure Computer Vision |
| **Modèle** | Gemini Vision | Florence-2 |
| **Rate Limit** | 15 req/min | Illimité (5k/mois) |
| **Détails** | Descriptions générales | Multi-régions détaillées |
| **OCR** | Basique | Avancé (multi-langue) |
| **Objets** | Non | Oui (avec positions) |
| **Personnes** | Non | Oui (comptage) |
| **Précision** | Bonne | Excellente |
| **Coût** | 0€ | 0€ (Free Tier) |

---

## 🐛 Dépannage

### Erreur 403 (Forbidden)
```json
{"error": "Invalid Azure Computer Vision API key"}
```
**Solution** : Vérifiez que `AZURE_VISION_KEY` est correctement configurée dans Azure Static Web App.

### Erreur 404 (Not Found)
```json
{"error": "Service d'analyse temporairement indisponible"}
```
**Solution** : Attendez quelques minutes pour le déploiement de la fonction. Vérifiez les logs GitHub Actions.

### Erreur 429 (Rate Limit)
```json
{"error": "Rate limit exceeded"}
```
**Solution** : Vous avez dépassé 5 000 images/mois. Passez au plan S1 ou attendez le mois prochain.

### Erreur 400 (Bad Request)
```json
{"error": "Invalid image data"}
```
**Solution** : L'image est corrompue ou dans un format non supporté. Formats acceptés : JPG, PNG, GIF, BMP.

---

## 📊 Monitoring

Pour suivre l'utilisation :

1. **Portail Azure** → **axilumazurevision**
2. Menu **Metrics**
3. Graphiques disponibles :
   - Total Calls (transactions)
   - Data In/Out
   - Latency
   - Errors

---

## 🔒 Sécurité

- ✅ La clé API est stockée comme variable d'environnement
- ✅ Jamais exposée au frontend
- ✅ CORS configuré correctement
- ✅ Rotation possible via le portail Azure

---

## 📚 Documentation officielle

- [Azure Computer Vision Overview](https://learn.microsoft.com/azure/ai-services/computer-vision/overview)
- [Image Analysis 4.0 API](https://learn.microsoft.com/azure/ai-services/computer-vision/concept-tag-images-40)
- [Pricing Calculator](https://azure.microsoft.com/pricing/details/cognitive-services/computer-vision/)

---

## ✅ Checklist de configuration

- [ ] Clé API Computer Vision copiée
- [ ] Variable `AZURE_VISION_KEY` ajoutée dans Azure Static Web App
- [ ] Configuration sauvegardée
- [ ] Test avec une image en mode PRO
- [ ] Message de confirmation : "Analysé par Azure Computer Vision"
- [ ] Vérification des détails (objets, tags, OCR)

Une fois configuré, les utilisateurs PRO bénéficieront d'analyses d'images professionnelles avec Azure Computer Vision !

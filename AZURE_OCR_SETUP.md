# 🔍 Configuration Azure OCR pour Détection de Factures

**Date:** 26 décembre 2024  
**Module:** Finance & Accounting Hub  
**Fonctionnalité:** Lecture automatique de factures (OCR)

---

## 📋 Problème Actuel

Lorsque vous uploadez une facture, vous voyez :
```
✓ Lecture de factures: fournisseur inconnu, montant non détecté
```

**Cause:** Azure Form Recognizer n'est pas configuré, le système utilise un fallback basique qui ne peut pas extraire d'informations réelles.

---

## ✅ Solution : Configurer Azure Form Recognizer

### Option 1 : Azure Form Recognizer (Recommandé)

Azure Form Recognizer est un service d'IA qui extrait automatiquement les informations des factures avec une très haute précision.

#### 1. Créer le Service Azure

```bash
# Via Azure CLI
az cognitiveservices account create \
  --name axilum-form-recognizer \
  --resource-group axilum-resources \
  --kind FormRecognizer \
  --sku S0 \
  --location westeurope \
  --yes

# Récupérer les credentials
az cognitiveservices account keys list \
  --name axilum-form-recognizer \
  --resource-group axilum-resources
```

#### 2. Configuration des Variables d'Environnement

**Fichier:** `/workspaces/algeria/api/.env`

```env
# Azure Form Recognizer
AZURE_FORM_RECOGNIZER_ENDPOINT=https://axilum-form-recognizer.cognitiveservices.azure.com/
AZURE_FORM_RECOGNIZER_KEY=votre_clé_primaire_ici

# OU via les alias
FORM_RECOGNIZER_ENDPOINT=https://axilum-form-recognizer.cognitiveservices.azure.com/
FORM_RECOGNIZER_KEY=votre_clé_primaire_ici
```

#### 3. Configuration Azure Web App (Production)

Dans le portail Azure, pour votre Function App :

1. Aller dans **Configuration** → **Application settings**
2. Ajouter les variables :

| Nom | Valeur |
|-----|--------|
| `APPSETTING_FORM_RECOGNIZER_ENDPOINT` | `https://axilum-form-recognizer.cognitiveservices.azure.com/` |
| `APPSETTING_FORM_RECOGNIZER_KEY` | `votre_clé_ici` |

3. Cliquer **Save** puis **Continue**

---

### Option 2 : Azure Computer Vision (Gratuit/Basic)

Si Form Recognizer est trop cher, Computer Vision Read API offre un OCR basique gratuit.

#### 1. Créer le Service

```bash
az cognitiveservices account create \
  --name axilum-vision \
  --resource-group axilum-resources \
  --kind ComputerVision \
  --sku F0 \
  --location westeurope \
  --yes
```

#### 2. Configuration

```env
# Azure Computer Vision
AZURE_VISION_ENDPOINT=https://axilum-vision.cognitiveservices.azure.com/
AZURE_VISION_KEY=votre_clé_ici
```

**Note:** Computer Vision extrait uniquement le texte brut. Notre parser intelligent (implémenté dans ce commit) essaie ensuite de trouver le fournisseur, montant, date, etc. via regex.

---

## 🧪 Test de Validation

### 1. Test Local

```bash
cd /workspaces/algeria/api

# Tester avec une URL de facture
curl -X POST http://localhost:7071/api/finance/invoices/ocr \
  -H "Content-Type: application/json" \
  -d '{"fileUrl": "https://example.com/facture.pdf"}'

# Tester avec un fichier base64
curl -X POST http://localhost:7071/api/finance/invoices/ocr \
  -H "Content-Type: application/json" \
  -d '{"contentBase64": "'$(base64 -w 0 facture.pdf)'"}'
```

### 2. Test via UI

1. Ouvrir Finance & Accounting Hub
2. Cliquer bouton upload (flèche haut verte)
3. Sélectionner une facture PDF ou image
4. Vérifier le message :

**Avant (sans Azure):**
```
✓ Lecture de factures: fournisseur inconnu, montant non détecté
```

**Après (avec Azure Form Recognizer):**
```
✓ Lecture de factures: ACME Corporation, 5432.50 EUR • archivé: https://...
```

**Après (avec Computer Vision + Parser):**
```
✓ Lecture de factures: ACME SARL, 1250 EUR • archivé: https://...
```

---

## 📊 Comparaison des Options

| Critère | Form Recognizer | Computer Vision | Fallback Stub |
|---------|----------------|-----------------|---------------|
| **Précision** | ⭐⭐⭐⭐⭐ 95%+ | ⭐⭐⭐ 60-80% | ⭐ 0% |
| **Coût** | ~1$/1000 pages | Gratuit (5000/mois) | Gratuit |
| **Champs extraits** | Tous (vendor, montant, TVA, date, lignes...) | Texte brut + parsing regex | Aucun |
| **Langues** | 100+ langues | 100+ langues | N/A |
| **Formats** | PDF, PNG, JPG, TIFF | PDF, PNG, JPG, TIFF | N/A |
| **Factures complexes** | ✅ Oui | ⚠️ Limité | ❌ Non |
| **Multi-pages** | ✅ Oui | ✅ Oui | ❌ Non |
| **Tableaux** | ✅ Oui | ❌ Non | ❌ Non |

---

## 🎯 Recommandation

### Pour Production
**Azure Form Recognizer** - Meilleure précision, extraction complète des champs structurés.

### Pour Développement/Test
**Computer Vision** - Gratuit, suffisant pour tester l'interface utilisateur.

### Pour Demo Sans Azure
**Parser Intelligent** (implémenté dans ce commit) - Extrait texte puis parse avec regex.

---

## 🔧 Améliorations Implémentées (Ce Commit)

### 1. Parser Intelligent

**Fichier:** [api/finance-invoices-ocr/index.js](api/finance-invoices-ocr/index.js)

```javascript
const fallbackStub = (fileUrl, textContent = null) => {
    // Si textContent fourni (depuis OCR basique), parse intelligemment:
    
    // ✅ Extraction fournisseur (premières lignes, patterns)
    // ✅ Extraction montant (avec devise: EUR, USD, DZD, etc.)
    // ✅ Extraction date (formats multiples)
    // ✅ Extraction numéro facture
    // ✅ Fallback sur heuristiques si rien trouvé
};
```

**Patterns Supportés:**

- **Fournisseur:** 
  - `From: ACME Corp`
  - `Fournisseur: XYZ SARL`
  - Première ligne non vide
  
- **Montant:**
  - `Total: 5000 EUR`
  - `€ 1,250.00`
  - `3500 DZD`
  - `Amount: $750`

- **Date:**
  - `2024-12-26`
  - `26/12/2024`
  - `Date: 15-12-2024`

- **Numéro:**
  - `Invoice: INV-2024-12345`
  - `Facture N° 12345`
  - `FA-2024-001`

### 2. Fallback avec Computer Vision

Si Form Recognizer échoue, le système essaie automatiquement Computer Vision Read API, puis parse le texte extrait avec le parser intelligent.

### 3. Messages d'Erreur Améliorés

```json
{
  "vendor": "Fournisseur Inconnu",
  "amount": null,
  "warning": "Azure Form Recognizer non configuré",
  "recommendation": "Configurez AZURE_FORM_RECOGNIZER_ENDPOINT et KEY",
  "method": "heuristic-stub"
}
```

---

## 📝 Utilisation

### Backend (Déjà Implémenté)

```javascript
// Appel API
POST /api/finance/invoices/ocr
Content-Type: application/json

{
  "contentBase64": "JVBERi0xLjQKJ..." // PDF/Image en base64
}

// OU

{
  "fileUrl": "https://example.com/facture.pdf"
}
```

### Frontend (Déjà Implémenté)

```javascript
// Bouton upload dans Finance Hub
<button onclick="openFinanceUpload()">
    <svg>...</svg> <!-- Icône upload -->
</button>

// Handler
async function onFinanceInvoiceSelected(e) {
    const file = e.target.files[0];
    const base64 = await fileToBase64(file);
    
    // Appel API + stockage contexte
    const data = await callOCRApi({ contentBase64: base64 });
    financeContext.lastInvoice = data;
}
```

---

## 🚀 Déploiement

### Local

```bash
# Démarrer le serveur Azure Functions
cd /workspaces/algeria/api
func start
```

### Azure

```bash
# Déployer les fonctions
cd /workspaces/algeria
func azure functionapp publish axilum-functions

# Redémarrer l'app
az functionapp restart --name axilum-functions --resource-group axilum-resources
```

---

## 🐛 Troubleshooting

### "fournisseur inconnu, montant non détecté"

**Causes possibles:**
1. ❌ Azure non configuré → Configurer `.env`
2. ❌ Credentials invalides → Vérifier clés Azure
3. ❌ Endpoint incorrect → Vérifier URL (doit finir par `.cognitiveservices.azure.com`)
4. ⚠️ Facture manuscrite → Utiliser facture imprimée/numérique
5. ⚠️ Qualité image faible → Scanner en 300 DPI minimum
6. ⚠️ Format non standard → Tester avec facture standard

### Debugging

```javascript
// Console DevTools
console.log('Azure configuré?', process.env.AZURE_FORM_RECOGNIZER_KEY);

// Logs backend
context.log('[OCR] Method:', result.method);
context.log('[OCR] Text extracted:', textContent);
```

### Logs Azure Functions

```bash
# Voir les logs en temps réel
func azure functionapp logstream axilum-functions
```

---

## 💰 Coûts

### Azure Form Recognizer

- **Tier gratuit:** 500 pages/mois
- **Standard (S0):**
  - 0-1M pages: 1$/1000 pages
  - 1M-10M: 0.60$/1000 pages
  - 10M+: 0.40$/1000 pages

### Azure Computer Vision

- **Tier gratuit (F0):** 5000 transactions/mois
- **Standard (S1):** 
  - 0-1M: 1$/1000 transactions
  - 1M-10M: 0.60$/1000 transactions

### Calcul Exemple

**1000 factures/mois:**
- Form Recognizer: ~1$/mois (+ précision maximale)
- Computer Vision: Gratuit (dans limite 5000)

---

## 📚 Ressources

- [Azure Form Recognizer Docs](https://learn.microsoft.com/azure/ai-services/document-intelligence/)
- [Computer Vision Read API](https://learn.microsoft.com/azure/ai-services/computer-vision/overview-ocr)
- [Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
- [API Reference](https://westus.dev.cognitive.microsoft.com/docs/services/form-recognizer-api-2023-07-31/operations/AnalyzeDocument)

---

## ✅ Checklist

- [ ] Créer ressource Azure Form Recognizer
- [ ] Copier endpoint et clé
- [ ] Ajouter dans `/api/.env` localement
- [ ] Ajouter dans Azure Web App Configuration
- [ ] Tester avec une facture
- [ ] Vérifier extraction : fournisseur, montant, date
- [ ] Confirmer archivage Blob Storage
- [ ] Tester avec agent : "Quel est le montant?"

---

**Statut Actuel:** ⚠️ Azure non configuré (fallback stub actif)  
**Objectif:** ✅ Azure Form Recognizer configuré + extraction complète  
**Prochaine étape:** Configurer credentials Azure

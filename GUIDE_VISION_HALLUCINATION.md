# Guide de Développement - Modules Analyse Vision & Hallucination Detector

## Vue d'Ensemble

Ce guide couvre deux modules innovants de la plateforme Algeria :
1. **Analyse Vision** - Analyse intelligente d'images avec Azure Computer Vision
2. **Hallucination Detector** - Détection de fiabilité et fact-checking des réponses IA

---

## 1. Analyse Vision

### État Actuel

- ✅ **Module créé** : `/public/js/vision-module.js`
- ✅ **Chargement dynamique** : Fonction `loadVisionModule()` dans index.html
- ✅ **Bouton sidebar** : Opérationnel
- ⏳ **Implémentation** : À développer

### Fonctionnalités Cibles

#### Phase 1 - OCR & Détection de Base

**OCR (Optical Character Recognition) :**
```javascript
async function extractTextFromImage(imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    const response = await fetch('/api/vision/ocr', {
        method: 'POST',
        body: formData
    });
    
    const result = await response.json();
    
    return {
        text: result.text,
        confidence: result.confidence,
        language: result.language,
        regions: result.regions.map(r => ({
            text: r.text,
            boundingBox: r.boundingBox,
            confidence: r.confidence
        }))
    };
}
```

**Détection d'objets :**
```javascript
async function detectObjects(imageFile) {
    const analysis = await azureComputerVision.analyzeImage(imageFile, {
        features: ['objects', 'tags', 'description']
    });
    
    return {
        objects: analysis.objects.map(obj => ({
            name: obj.object,
            confidence: obj.confidence,
            boundingBox: obj.rectangle
        })),
        tags: analysis.tags,
        description: analysis.description.captions[0]?.text
    };
}
```

#### Phase 2 - Analyse de Documents

**Factures & Documents structurés :**
```javascript
async function analyzeInvoice(imageFile) {
    // Azure Form Recognizer
    const analysis = await azureFormRecognizer.analyzeDocument('prebuilt-invoice', imageFile);
    
    return {
        invoiceNumber: analysis.fields.InvoiceId?.value,
        date: analysis.fields.InvoiceDate?.value,
        dueDate: analysis.fields.DueDate?.value,
        vendor: {
            name: analysis.fields.VendorName?.value,
            address: analysis.fields.VendorAddress?.value
        },
        customer: {
            name: analysis.fields.CustomerName?.value,
            address: analysis.fields.CustomerAddress?.value
        },
        items: analysis.fields.Items?.values?.map(item => ({
            description: item.Description?.value,
            quantity: item.Quantity?.value,
            unitPrice: item.UnitPrice?.value,
            amount: item.Amount?.value
        })),
        subtotal: analysis.fields.SubTotal?.value,
        tax: analysis.fields.TotalTax?.value,
        total: analysis.fields.InvoiceTotal?.value
    };
}
```

#### Phase 3 - Reconnaissance Faciale

```javascript
async function detectFaces(imageFile) {
    const faces = await azureComputerVision.detectFaces(imageFile);
    
    return faces.map(face => ({
        age: face.faceAttributes.age,
        gender: face.faceAttributes.gender,
        emotion: getTopEmotion(face.faceAttributes.emotion),
        accessories: face.faceAttributes.accessories,
        boundingBox: face.faceRectangle,
        confidence: face.confidence
    }));
}

function getTopEmotion(emotions) {
    return Object.entries(emotions)
        .sort(([,a], [,b]) => b - a)[0][0];
}
```

### Interface Utilisateur

```
┌────────────────────────────────────────────────┐
│  👁️ Analyse Vision                            │
├────────────────────────────────────────────────┤
│  [Drag & Drop ou Cliquer pour Upload]         │
│                                                │
│  ┌──────────────────┐  Résultats :            │
│  │                  │                          │
│  │   [Image]        │  📝 Texte extrait (OCR) │
│  │                  │  ┌──────────────────┐   │
│  │                  │  │ Lorem ipsum...   │   │
│  └──────────────────┘  └──────────────────┘   │
│                                                │
│  🏷️ Tags : laptop, desk, office, indoor       │
│  📦 Objets : laptop (92%), cup (87%)          │
│  👤 Visages : 1 personne détectée             │
│                                                │
│  [Exporter OCR] [Télécharger Rapport]         │
└────────────────────────────────────────────────┘
```

---

## 2. Hallucination Detector

### État Actuel

- ✅ **Module créé** : `/public/js/hallucination-module.js`
- ✅ **Chargement dynamique** : Fonction `loadHallucinationModule()` dans index.html
- ✅ **Bouton sidebar** : Opérationnel
- ⏳ **Implémentation** : À développer

### Concept : Hallucination Index (HI)

Le **Hallucination Index** est un score de 0-100 indiquant la probabilité qu'une réponse IA contienne des informations incorrectes ou inventées.

**Échelle HI :**
- 0-20% : ✅ Très fiable
- 21-40% : ✓ Fiable
- 41-60% : ⚠️ Modéré
- 61-80% : ⚠️ Suspect
- 81-100% : ❌ Hallucination probable

### Algorithme de Détection

```javascript
async function calculateHallucinationIndex(aiResponse, context) {
    // 1. Analyse de cohérence interne (30%)
    const coherenceScore = await analyzeCoherence(aiResponse, context);
    
    // 2. Extraction et vérification des affirmations (40%)
    const claims = await extractClaims(aiResponse);
    const verificationResults = await Promise.all(
        claims.map(claim => verifyClaimWithSearch(claim))
    );
    const verificationScore = calculateVerificationScore(verificationResults);
    
    // 3. Confiance du modèle (20%)
    const modelConfidence = aiResponse.confidence || 0.5;
    
    // 4. Historique de fiabilité du modèle (10%)
    const historicalScore = getHistoricalReliability(aiResponse.model);
    
    // Calcul final (inversé : plus le score est bas, meilleur c'est)
    const hi = 100 - (
        coherenceScore * 0.3 +
        verificationScore * 0.4 +
        modelConfidence * 100 * 0.2 +
        historicalScore * 0.1
    );
    
    return Math.max(0, Math.min(100, hi));
}
```

### Fact-Checking avec Brave Search

```javascript
async function verifyClaimWithSearch(claim) {
    // Recherche web
    const searchResults = await braveSearch(claim);
    
    // Analyse des résultats
    const analysis = await analyzeSearchResults(claim, searchResults);
    
    return {
        claim: claim,
        verified: analysis.verified,
        confidence: analysis.confidence,
        sources: analysis.sources,
        summary: analysis.summary
    };
}

async function braveSearch(query) {
    const response = await fetch('/api/brave-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            q: query,
            count: 10
        })
    });
    
    return await response.json();
}

async function analyzeSearchResults(claim, results) {
    // Utiliser Azure OpenAI pour analyser si les résultats confirment la claim
    const prompt = `
    Affirmation à vérifier : "${claim}"
    
    Résultats de recherche :
    ${results.web.results.map(r => `- ${r.title}: ${r.description}`).join('\n')}
    
    Analyse :
    1. Cette affirmation est-elle vérifiée par les sources ?
    2. Quel est ton niveau de confiance (0-100%) ?
    3. Résume les preuves trouvées.
    
    Réponds en JSON : { "verified": boolean, "confidence": number, "summary": string }
    `;
    
    const analysis = await callAzureOpenAI(prompt);
    return {
        ...JSON.parse(analysis),
        sources: results.web.results.slice(0, 3).map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.description
        }))
    };
}
```

### Interface Utilisateur

```
┌────────────────────────────────────────────────┐
│  🛡️ Hallucination Detector                    │
├────────────────────────────────────────────────┤
│  Réponse IA à analyser :                       │
│  ┌──────────────────────────────────────────┐  │
│  │ Paris est la capitale de la France avec │  │
│  │ une population de 2.2 millions d'hab.   │  │
│  │ La Tour Eiffel mesure 330 mètres.       │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [Analyser] [Mode Auto]                        │
│                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                │
│  Hallucination Index : 12/100                  │
│  ███░░░░░░ Très fiable ✅                      │
│                                                │
│  📊 Détails :                                  │
│  • Cohérence interne : 98% ✓                   │
│  • Affirmations vérifiées : 3/3 ✓              │
│  • Confiance du modèle : 94% ✓                 │
│                                                │
│  ✓ Affirmations vérifiées :                    │
│  • Paris capitale de France [3 sources]        │
│  • Population 2.2M [INSEE]                     │
│  • Tour Eiffel 330m [Wikipedia]                │
│                                                │
│  📚 12 sources consultées                      │
│  [Voir le rapport détaillé]                    │
└────────────────────────────────────────────────┘
```

### Intégration dans le Chat

**Mode automatique :**
```javascript
// Activer la vérification automatique
let autoVerifyEnabled = false;

async function sendMessageWithVerification(message) {
    // 1. Obtenir la réponse de l'IA
    const aiResponse = await getAIResponse(message);
    
    // 2. Si auto-verify activé, analyser la réponse
    if (autoVerifyEnabled) {
        const hiAnalysis = await calculateHallucinationIndex(aiResponse, message);
        
        // 3. Afficher warning si HI > seuil
        if (hiAnalysis.hi > 40) {
            showHIWarning(hiAnalysis);
        }
        
        // 4. Ajouter badge HI à la réponse
        displayMessageWithHI(aiResponse, hiAnalysis);
    } else {
        displayMessage(aiResponse);
    }
}

function displayMessageWithHI(response, hiAnalysis) {
    const badge = getHIBadge(hiAnalysis.hi);
    // Afficher la réponse avec badge
    appendMessage({
        text: response.text,
        badge: badge,
        onClick: () => showHIDetails(hiAnalysis)
    });
}

function getHIBadge(hi) {
    if (hi <= 20) return '✅ Très fiable';
    if (hi <= 40) return '✓ Fiable';
    if (hi <= 60) return '⚠️ Modéré';
    if (hi <= 80) return '⚠️ Suspect';
    return '❌ À vérifier';
}
```

---

## Intégration des Deux Modules

### Cas d'Usage Combiné

**Analyse de document + Fact-checking :**
```javascript
async function analyzeDocumentWithVerification(imageFile) {
    // 1. Extraire le texte (Vision)
    const ocrResult = await extractTextFromImage(imageFile);
    
    // 2. Identifier les affirmations clés
    const claims = await extractClaims(ocrResult.text);
    
    // 3. Vérifier chaque affirmation (Hallucination Detector)
    const verifiedClaims = await Promise.all(
        claims.map(claim => verifyClaimWithSearch(claim))
    );
    
    // 4. Générer rapport
    return {
        originalText: ocrResult.text,
        claims: verifiedClaims,
        overallReliability: calculateOverallReliability(verifiedClaims),
        warnings: generateWarnings(verifiedClaims)
    };
}
```

---

## Timeline de Développement

### Analyse Vision

**Sprint 1-2 (4 semaines) - MVP :**
- [ ] Upload et prévisualisation d'images
- [ ] OCR basique (Azure Computer Vision)
- [ ] Détection d'objets
- [ ] Génération de description
- [ ] Export texte extrait

**Sprint 3-4 (4 semaines) - Documents :**
- [ ] Analyse de factures
- [ ] Cartes d'identité
- [ ] Tableaux et formulaires
- [ ] Batch processing
- [ ] Historique des analyses

**Sprint 5-6 (4 semaines) - Avancé :**
- [ ] Reconnaissance faciale
- [ ] Analyse de scènes
- [ ] Classification avancée
- [ ] Intégrations (Drive, Dropbox)
- [ ] API publique

### Hallucination Detector

**Sprint 1-2 (4 semaines) - MVP :**
- [ ] Analyse manuelle de texte
- [ ] Extraction d'affirmations
- [ ] Brave Search integration
- [ ] Calcul HI basique
- [ ] Interface de visualisation

**Sprint 3-4 (4 semaines) - Auto-Verify :**
- [ ] Mode automatique dans chat
- [ ] Badges HI en temps réel
- [ ] Highlights sur texte suspect
- [ ] Rapport détaillé
- [ ] Historique des analyses

**Sprint 5-6 (4 semaines) - Avancé :**
- [ ] Multi-sources validation
- [ ] ML pattern detection
- [ ] Custom knowledge bases
- [ ] Analytics et benchmarks
- [ ] API publique

---

## Technologies Requises

### Analyse Vision
- Azure Computer Vision API v4.0
- Azure Form Recognizer
- Canvas API (annotations)
- Tesseract.js (fallback OCR)

### Hallucination Detector
- Azure OpenAI (GPT-4)
- Brave Search API
- Named Entity Recognition
- Text similarity algorithms

---

## Checklist de Migration

### Analyse Vision
- [x] Créer `/public/js/vision-module.js`
- [x] Ajouter `loadVisionModule()` dans index.html
- [x] Mettre à jour bouton sidebar
- [x] Documenter dans ce guide
- [ ] Implémenter MVP
- [ ] Tests et validation

### Hallucination Detector
- [x] Créer `/public/js/hallucination-module.js`
- [x] Ajouter `loadHallucinationModule()` dans index.html
- [x] Mettre à jour bouton sidebar
- [x] Documenter dans ce guide
- [ ] Implémenter MVP
- [ ] Tests et validation

---

## Support

Pour développer ces modules :
1. Consulter ce guide
2. Voir `DEVELOPPEMENT_MODULAIRE.md` pour l'architecture
3. Tester les modules via sidebar

**Prêt à innover ! 🚀**

// Système de tracking historique avec Azure Table Storage (30x moins cher que Redis)
// Fallback vers mémoire volatile si Table Storage non disponible
let responseHistory;
try {
    responseHistory = require('../utils/tableStorage');
} catch (error) {
    // Fallback vers mémoire volatile si module non disponible
    responseHistory = {
        initialized: false,
        entries: [],
        async initialize() { this.initialized = true; },
        add(entry) {
            this.entries.push({ ...entry, timestamp: new Date().toISOString() });
            if (this.entries.length > 100) this.entries.shift();
        },
        getStats() {
            if (this.entries.length === 0) return { avgConfidence: 0.7, avgValidation: 1.0, sampleSize: 0 };
            const avgConfidence = this.entries.reduce((sum, e) => sum + e.confidence, 0) / this.entries.length;
            const avgValidation = this.entries.reduce((sum, e) => sum + e.validation, 0) / this.entries.length;
            return {
                avgConfidence: Math.round(avgConfidence * 100) / 100,
                avgValidation: Math.round(avgValidation * 100) / 100,
                sampleSize: this.entries.length
            };
        },
        getAdaptiveThreshold() {
            const stats = this.getStats();
            if (stats.avgValidation < 0.8) return 0.25;
            else if (stats.avgConfidence > 0.85) return 0.35;
            return 0.30;
        }
    };
}

// RAG System pour recherche vectorielle et fact-checking interne
let ragSystem;
try {
    const RAGSystem = require('../utils/ragSystem');
    ragSystem = new RAGSystem();
} catch (error) {
    console.log('⚠️  RAG System non disponible - fonctionnalité désactivée');
    ragSystem = {
        enabled: false,
        async search() { return []; },
        async verifyClaim() { return { verified: false, found: false }; },
        async enrichContext() { return { enriched: false }; }
    };
}

// Fact-Checker avec Google Fact Check Tools API
let factChecker;
try {
    const FactChecker = require('../utils/factChecker');
    factChecker = new FactChecker();
} catch (error) {
    console.log('⚠️  Fact-Checker non disponible - fonctionnalité désactivée');
    factChecker = {
        enabled: false,
        async checkText() { return { checked: false }; },
        async checkClaim() { return { checked: false }; }
    };
}

// Protection contre accumulation d'hallucinations
let hallucinationProtection;
try {
    hallucinationProtection = require('../utils/hallucinationProtection');
} catch (error) {
    console.log('⚠️  Hallucination Protection non disponible - fonctionnalité désactivée');
    hallucinationProtection = {
        analyzeConversationRisk() {
            return {
                level: 'safe',
                stats: { avgHI: 0, maxHI: 0, recentAvgHI: 0, totalMessages: 0, highRiskCount: 0, trend: 'stable' },
                action: { type: 'NONE', message: '', description: '', actions: [], icon: '', color: '' },
                shouldIntervene: false,
                shouldBlock: false
            };
        }
    };
}

// 🚀 CACHE SIMPLE : Réponses rapides pour questions fréquentes
const responseCache = new Map();
const CACHE_TTL = 3600000; // 1 heure en millisecondes
const MAX_CACHE_SIZE = 100;

function getCacheKey(message, historyLength) {
    // Normaliser le message pour le cache (lowercase, trim, pas d'historique pour les questions simples)
    const normalizedMsg = message.toLowerCase().trim();
    // Si pas d'historique, utiliser juste le message
    if (historyLength === 0) {
        return normalizedMsg;
    }
    // Avec historique, inclure la taille pour éviter les collisions
    return `${normalizedMsg}:${historyLength}`;
}

function getCachedResponse(cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.response;
    }
    if (cached) {
        responseCache.delete(cacheKey); // Expirer
    }
    return null;
}

function setCachedResponse(cacheKey, response) {
    // Limiter la taille du cache
    if (responseCache.size >= MAX_CACHE_SIZE) {
        const firstKey = responseCache.keys().next().value;
        responseCache.delete(firstKey);
    }
    responseCache.set(cacheKey, {
        response: response,
        timestamp: Date.now()
    });
}

module.exports = async function (context, req) {
    // Initialiser le storage au premier appel
    if (!responseHistory.initialized) {
        await responseHistory.initialize();
    }
    
    // startTime sera déclaré plus tard après validation du message
    context.log('Axilum AI - Hallucination Detection started');
    context.log('Request method:', req.method);
    context.log('Request body:', JSON.stringify(req.body));

    try {
        const userMessage = req.body?.message || req.query?.message;
        
        if (!userMessage) {
            context.log.warn('No message provided in request');
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { error: "Message is required", received: req.body }
            };
            return;
        }

        const apiKey = process.env.AZURE_AI_API_KEY;
        const endpoint = 'https://saidzeghidi-2025-1-resource.cognitiveservices.azure.com';
        const deploymentName = 'gpt-5.1-chat';

        if (!apiKey) {
            context.log.error('AZURE_AI_API_KEY not configured');
            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    error: "API Key not configured",
                    hint: "Please configure AZURE_AI_API_KEY in Azure Static Web App settings"
                }
            };
            return;
        }

        // 🚀 PERFORMANCE : Démarrer le timer
        const startTime = Date.now();
        
        context.log('Using GPT-5.1 with hallucination detection');
        context.log('Message length:', userMessage.length);
        
        // 🚀 CACHE CHECK : Vérifier si la réponse est déjà en cache
        const conversationHistory = req.body.history || [];
        const cacheKey = getCacheKey(userMessage, conversationHistory.length);
        const cachedResponse = getCachedResponse(cacheKey);
        
        if (cachedResponse) {
            const cacheTime = Date.now() - startTime;
            context.log(`⚡ CACHE HIT! Response time: ${cacheTime}ms`);
            context.res = {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Cache': 'HIT',
                    'X-Response-Time': `${cacheTime}ms`
                },
                body: {
                    ...cachedResponse,
                    cached: true,
                    cacheResponseTime: `${cacheTime}ms`
                }
            };
            return;
        }
        
        context.log('💾 Cache miss, generating new response');

        // 🎨 DÉTECTION GÉNÉRATION D'IMAGES : Vérifier si l'utilisateur demande une image
        const imageKeywords = ['photo', 'image', 'picture', 'génère', 'génerer', 'crée', 'créer', 'dessine', 'dessiner', 'illustre', 'illustration', 'visualise'];
        const messageWords = userMessage.toLowerCase().split(/\s+/);
        const isImageRequest = imageKeywords.some(keyword => 
            messageWords.some(word => word.includes(keyword))
        );

        // Si demande d'image détectée, générer avec Pollinations.ai
        if (isImageRequest && (userMessage.toLowerCase().includes('une') || userMessage.toLowerCase().includes('un'))) {
            context.log('🎨 Image generation request detected');
            
            try {
                // Extraire le prompt de génération d'image
                const imagePrompt = userMessage
                    .replace(/génère|génerer|crée|créer|dessine|dessiner|illustre|illustration|visualise|photo|image|picture/gi, '')
                    .replace(/une|un|de|d'|du/gi, '')
                    .trim();
                
                context.log('🎨 Image prompt:', imagePrompt);
                
                // Appeler l'API de génération d'image
                const generateImageUrl = process.env.NODE_ENV === 'production' 
                    ? 'https://proud-mushroom-019836d03.3.azurestaticapps.net/api/generate-image'
                    : 'http://localhost:7071/api/generate-image';
                
                const imageResponse = await fetch(generateImageUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        prompt: imagePrompt || userMessage,
                        width: 1024,
                        height: 1024
                    })
                });
                
                if (!imageResponse.ok) {
                    throw new Error(`Image generation failed: ${imageResponse.status}`);
                }
                
                const imageData = await imageResponse.json();
                const processingTime = Date.now() - startTime;
                
                context.log('✅ Image generated:', imageData.imageUrl);
                
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        text: `Voici l'image générée pour : "${imagePrompt || userMessage}" 🎨`,
                        imageUrl: imageData.imageUrl,
                        imageGenerated: true,
                        prompt: imagePrompt || userMessage,
                        model: imageData.model,
                        hallucinationIndex: 0,
                        contextHistoryRatio: 0,
                        responseTime: `${processingTime}ms`,
                        cached: false
                    }
                };
                return;
                
            } catch (error) {
                context.log.error('❌ Image generation error:', error);
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        text: `Désolé, je n'ai pas pu générer l'image. Erreur : ${error.message}`,
                        hallucinationIndex: 0,
                        contextHistoryRatio: 0,
                        responseTime: `${Date.now() - startTime}ms`,
                        cached: false,
                        error: true
                    }
                };
                return;
            }
        }

        const systemPrompt = `Tu es Axilum AI, un assistant intelligent avec un système rigoureux de calcul d'hallucinations.

## Capacités Spéciales

**Génération d'images** : Tu peux générer des images via l'API Pollinations.ai
- Quand l'utilisateur demande une image, réponds avec : "Je génère l'image : [description]"
- Le système détectera automatiquement cette phrase et appellera l'API de génération
- L'image sera affichée dans le chat après génération
- Exemples de demandes : "génère une image de...", "crée une photo de...", "dessine-moi..."

## Contraintes de Format
- **Longueur maximale : 400 mots**
- Reste concis et précis
- Si le sujet nécessite plus, propose de détailler un aspect spécifique

## Processus en 2 Étapes

### ÉTAPE 1 : Analyse Interne (ne pas afficher à l'utilisateur)

1. **Génère mentalement ta réponse** (R) à la question de l'utilisateur
2. **Décompose R en affirmations atomiques** (claims) - chaque fait vérifiable séparément
3. **Classifie chaque claim** :
   - SUPPORTED : Affirmation vérifiable et correcte selon tes connaissances
   - NOT_SUPPORTED : Affirmation incertaine ou non vérifiable
   - CONTRADICTORY : Affirmation fausse ou contradictoire avec tes connaissances fiables
4. **Calcule les indices** :
   - H = ((0.5 * NOT_SUPPORTED) + (1.0 * CONTRADICTORY)) / total_claims
   - C = confiance moyenne dans tes sources (0.7-0.9 pour connaissances générales, 0.3-0.6 pour incertain)
   - U = urgence/impact si faux (0.3-0.5 pour info générale, 0.7-1.0 pour médical/financier)
   - Rc = 1 - C
   - CHR = 0.5 * H + 0.3 * U + 0.2 * Rc
5. **Convertis en pourcentages** :
   - HI% = round(H * 100, 1)
   - CHR% = round(CHR * 100, 1)

### ÉTAPE 2 : Décision et Réponse

**Si HI% ≥ 30% OU CHR% ≥ 30%** :
- Réécris ta réponse en étant plus prudent
- Utilise des formulations nuancées ("généralement", "selon", "il semble")
- Évite les affirmations non vérifiables
- Ajoute un avertissement

**Si HI% < 30% ET CHR% < 30%** :
- Réponds normalement avec confiance

## Ta Mission

Réponds naturellement aux questions tout en calculant rigoureusement le risque d'hallucination.

## Règles de Calcul Strictes

1. **Décomposition systématique** : Identifie TOUS les claims atomiques dans ta réponse
2. **Classification rigoureuse** :
   - Salutations, politesse = SUPPORTED (HI = 0%)
   - Faits généraux bien connus = SUPPORTED
   - Chiffres approximatifs sans source = NOT_SUPPORTED
   - Dates/événements incertains = NOT_SUPPORTED
   - Affirmations fausses = CONTRADICTORY
3. **Pondération réaliste** :
   - Conversations simples : C = 0.9, U = 0.3
   - Informations techniques : C = 0.7, U = 0.5
   - Sujets complexes/sensibles : C = 0.5, U = 0.8
4. **Seuils d'alerte** :
   - HI% < 30% ET CHR% < 30% : ✅ Réponse fiable
   - HI% ≥ 30% OU CHR% ≥ 30% : ⚠️ Réviser la réponse et avertir

## Règles de Présentation

- ❌ **Ne JAMAIS afficher** le processus de calcul interne
- ❌ **Ne JAMAIS montrer** les claims décomposés
- ✅ **Afficher uniquement** : réponse + HI% + CHR% + alerte si nécessaire
- ✅ **Ajouter 2-3 sources académiques** seulement si HI% ou CHR% ≥ 30%

## Format de Réponse OBLIGATOIRE

Structure EXACTE à suivre :

FORMAT:
[Réponse conversationnelle naturelle]

---
📊 HI: X.X% • CHR: Y.Y%

[Si HI >= 30% OU CHR >= 30%]
⚠️ Attention : [Explication brève du risque]

Sources recommandées :
1. [Source académique/scientifique]
2. [Source de haute autorité]

**Niveaux de fiabilité automatiques** :
- HI < 15% : Très fiable
- HI 15-30% : Fiable
- HI 30-60% : Prudence requise
- HI > 60% : Haute incertitude

## Exemples de Calcul

**Exemple 1 : Salutation simple**
Question : "Hello"
Analyse interne :
- Claims : ["je réponds poliment"] = 1 claim
- Classification : SUPPORTED = 1
- H = (0.5*0 + 1.0*0) / 1 = 0
- C = 0.95, U = 0.2, Rc = 0.05
- CHR = 0.5*0 + 0.3*0.2 + 0.2*0.05 = 0.07
- HI% = 0.0%, CHR% = 7.0%

Réponse :
"Hello! How can I help you today?"

---
📊 HI: 0.0% • CHR: 7.0%

**Exemple 2 : Question technique avec certitude**
Question : "Qu'est-ce que Node.js ?"
Analyse interne :
- Claims : ["Node.js est un runtime JavaScript", "basé sur V8", "permet JS côté serveur"] = 3 claims
- Classification : SUPPORTED = 3
- H = 0 / 3 = 0
- C = 0.85, U = 0.3, Rc = 0.15
- CHR = 0.5×0 + 0.3×0.3 + 0.2×0.15 = 0.12
- HI% = 0.0%, CHR% = 12.0%

**Exemple 3 : Réponse avec incertitude**
Question : "Combien coûte Azure OpenAI ?"
Analyse interne :
- Claims : ["pricing varie", "basé sur tokens", "varie selon modèle", "environ X$/1K tokens"] = 4 claims
- Classification : SUPPORTED = 3, NOT_SUPPORTED = 1 (prix approximatif)
- H = (0.5*1 + 1.0*0) / 4 = 0.125
- C = 0.6, U = 0.5, Rc = 0.4
- CHR = 0.5*0.125 + 0.3*0.5 + 0.2*0.4 = 0.2925
- HI% = 12.5%, CHR% = 29.3%

Réponse normale (< 30%)

**Exemple 4 : Haute incertitude nécessitant révision**
Analyse initiale donne HI% = 45% → Réécris la réponse avec plus de prudence, ajoute des sources

---

## Application Systématique

Pour CHAQUE réponse :
1. Fais le calcul mentalement (ne pas afficher)
2. Si HI ≥ 30% ou CHR ≥ 30% : révise ta réponse + ajoute sources
3. Affiche uniquement : réponse + HI% + CHR% + alerte si nécessaire

Sois rigoureux dans tes calculs !`;

        // ÉTAPE 1 : Préparer l'historique de conversation (optimisé)
        // conversationHistory est déjà déclaré plus haut pour le cache
        const messages = [{ role: 'system', content: systemPrompt }];
        
        // 🚀 OPTIMISATION : Limiter l'historique aux 15 derniers messages (30 messages au total max)
        // Cela réduit les tokens et améliore le temps de réponse
        const MAX_HISTORY_MESSAGES = 15; // 15 paires user/bot = 30 messages
        const recentHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
        
        context.log(`📝 Total history: ${conversationHistory.length} messages, using recent: ${recentHistory.length}`);
        
        // Ajouter l'historique récent des messages précédents
        recentHistory.forEach(msg => {
            if (msg.type === 'user' && msg.content) {
                messages.push({ role: 'user', content: msg.content });
            } else if (msg.type === 'bot' && msg.content) {
                // Nettoyer la réponse du bot des métriques pour le contexte
                const cleanContent = msg.content
                    .replace(/\n*---[\s\S]*/g, '')
                    .replace(/\n*📊.*?HI:.*?CHR:.*?\n*/gi, '')
                    .replace(/\n*HI:\s*[0-9.]+%.*?CHR:\s*[0-9.]+%.*?\n*/gi, '')
                    .trim();
                messages.push({ role: 'assistant', content: cleanContent });
            }
        });
        
        // Ajouter le message actuel de l'utilisateur
        messages.push({ role: 'user', content: userMessage });
        
        context.log(`📝 Conversation context: ${messages.length} messages sent to API (including system prompt)`);
        
        // ÉTAPE 2 : Appeler Azure OpenAI avec l'historique complet
        // Note: GPT-5.1 ne supporte pas encore logprobs, donc désactivé temporairement
        const response = await fetch(`${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-08-01-preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: JSON.stringify({
                messages: messages,
                max_completion_tokens: 3000
                // logprobs: true, // Désactivé - non supporté par GPT-5.1
                // top_logprobs: 5
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error('Azure API error:', response.status, errorText);
            throw new Error(`Azure API returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const agentResponse = data.choices?.[0]?.message?.content || "Je n'ai pas pu générer une réponse.";
        const logprobs = data.choices?.[0]?.logprobs;
        
        context.log('Response generated successfully');
        context.log('Response length:', agentResponse.length);
        
        // ÉTAPE 2 : Extraire la confiance objective à partir des logprobs (si disponible)
        let objectiveConfidence = 0.75; // Valeur par défaut élevée pour GPT-5.1
        let confidenceSource = 'default';
        
        if (logprobs && logprobs.content) {
            // Calculer la confiance moyenne basée sur les probabilités réelles du modèle
            const tokenConfidences = logprobs.content
                .map(token => Math.exp(token.logprob)) // Convertir log prob en probabilité
                .filter(prob => prob > 0); // Filtrer les valeurs invalides
            
            if (tokenConfidences.length > 0) {
                objectiveConfidence = tokenConfidences.reduce((sum, prob) => sum + prob, 0) / tokenConfidences.length;
                confidenceSource = 'logprobs';
                context.log(`📊 Confiance objective calculée (logprobs) : ${(objectiveConfidence * 100).toFixed(1)}%`);
            }
        } else {
            // Estimation heuristique basée sur la longueur et la complexité
            const wordCount = agentResponse.split(/\s+/).length;
            const hasNumbers = /\d/.test(agentResponse);
            const hasCitations = /\[.*\]|Source|selon/i.test(agentResponse);
            
            // Réponses courtes et directes = confiance plus élevée
            if (wordCount < 50) objectiveConfidence = 0.85;
            else if (wordCount < 150) objectiveConfidence = 0.75;
            else objectiveConfidence = 0.70;
            
            // Ajustements
            if (hasNumbers) objectiveConfidence -= 0.05; // Chiffres = plus risqué
            if (hasCitations) objectiveConfidence += 0.05; // Citations = plus fiable
            
            confidenceSource = 'heuristic';
            context.log(`📊 Confiance estimée (heuristique) : ${(objectiveConfidence * 100).toFixed(1)}%`);
        }
        
        // ÉTAPE 3 : Validation multi-modèle (second appel indépendant)
        let validationScore = 1.0; // 1.0 = validation réussie, 0.0 = contradictions détectées
        
        const validationPrompt = `Tu es un validateur critique. Analyse la réponse suivante et identifie UNIQUEMENT les affirmations factuelles incorrectes ou contradictoires.

Réponse à valider :
"${agentResponse}"

Réponds en JSON uniquement :
{
  "incorrect_claims": ["claim 1", "claim 2"],
  "validation_score": 0.0-1.0
}

Si tout est correct, retourne : {"incorrect_claims": [], "validation_score": 1.0}`;
        
        try {
            const validationResponse = await fetch(`${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-08-01-preview`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': apiKey
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: 'Tu es un validateur factuel rigoureux. Réponds uniquement en JSON.' },
                        { role: 'user', content: validationPrompt }
                    ],
                    max_completion_tokens: 500,
                    temperature: 0.2 // Température basse pour validation stricte
                })
            });
            
            if (validationResponse.ok) {
                const validationData = await validationResponse.json();
                const validationContent = validationData.choices?.[0]?.message?.content || '{}';
                
                // Parser le JSON de validation
                try {
                    const jsonMatch = validationContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const validation = JSON.parse(jsonMatch[0]);
                        validationScore = validation.validation_score || 1.0;
                        
                        if (validation.incorrect_claims && validation.incorrect_claims.length > 0) {
                            context.log(`⚠️ Validation détectée : ${validation.incorrect_claims.length} affirmations douteuses`);
                            context.log('Affirmations douteuses:', validation.incorrect_claims);
                        } else {
                            context.log('✅ Validation réussie : aucune contradiction détectée');
                        }
                    }
                } catch (parseError) {
                    context.log.warn('Impossible de parser la validation JSON:', parseError.message);
                }
            }
        } catch (validationError) {
            context.log.warn('Échec de la validation multi-modèle:', validationError.message);
        }
        
        // ÉTAPE 3.5 : Vérification RAG et Fact-Checking externe
        let ragResults = { enriched: false };
        let factCheckResults = { checked: false };
        
        try {
            // RAG : Enrichir avec base de connaissances interne
            if (ragSystem.enabled) {
                ragResults = await ragSystem.enrichContext(userMessage, agentResponse);
                
                if (ragResults.enriched) {
                    context.log(`📚 RAG: ${ragResults.relevantFacts.length} faits pertinents trouvés`);
                    
                    if (ragResults.hasContradictions) {
                        context.log(`⚠️ RAG: ${ragResults.contradictions.length} contradictions détectées !`);
                        // Réduire score de validation si contradictions KB
                        validationScore = Math.min(validationScore, 0.6);
                    }
                }
            }
            
            // Fact-Checking : Vérifier contre sources publiques (Google Fact Check)
            if (factChecker.enabled) {
                factCheckResults = await factChecker.checkText(agentResponse);
                
                if (factCheckResults.checked) {
                    context.log(`🔍 Fact-Check: ${factCheckResults.claimsFound} claims extraits`);
                    
                    if (factCheckResults.hasFakeNews) {
                        context.log(`🚨 FAKE NEWS DÉTECTÉE dans la réponse !`);
                        // Réduction drastique de confiance si fake news
                        objectiveConfidence = Math.min(objectiveConfidence, 0.3);
                        validationScore = Math.min(validationScore, 0.3);
                    } else if (factCheckResults.claimsVerified > 0) {
                        context.log(`✅ Fact-Check: ${factCheckResults.claimsVerified} claims vérifiés (trust: ${(factCheckResults.overallTrust * 100).toFixed(0)}%)`);
                        // Bonus de confiance si claims vérifiés positivement
                        objectiveConfidence = Math.min(1.0, objectiveConfidence + 0.05);
                    }
                }
            }
        } catch (ragError) {
            context.log.warn('Erreur lors du RAG/Fact-Checking:', ragError.message);
        }
        
        // ÉTAPE 4 : Ajouter à l'historique pour apprentissage adaptatif
        responseHistory.add({
            confidence: objectiveConfidence,
            validation: validationScore,
            messageLength: userMessage.length
        });
        
        const historyStats = responseHistory.getStats();
        const adaptiveThreshold = responseHistory.getAdaptiveThreshold();
        
        context.log(`📈 Statistiques historiques: ${historyStats.sampleSize} entrées, conf moy: ${historyStats.avgConfidence}, val moy: ${historyStats.avgValidation}`);
        context.log(`🎯 Seuil adaptatif actuel: ${(adaptiveThreshold * 100).toFixed(0)}%`);
        
        // ÉTAPE 5 : Enrichir la réponse avec les métriques objectives
        const enrichedResponse = {
            response: agentResponse,
            model: deploymentName,
            source: 'axilum-ai-gpt5-enhanced',
            timestamp: new Date().toISOString(),
            confidence_metrics: {
                objective_confidence: Math.round(objectiveConfidence * 100) / 100,
                confidence_source: confidenceSource,
                validation_score: Math.round(validationScore * 100) / 100,
                confidence_level: objectiveConfidence >= 0.8 ? 'high' : objectiveConfidence >= 0.6 ? 'medium' : 'low',
                validation_status: validationScore >= 0.9 ? 'validated' : validationScore >= 0.7 ? 'minor_concerns' : 'major_concerns',
                adaptive_threshold: adaptiveThreshold,
                historical_stats: historyStats
            }
        };
        
        // Ajouter les résultats RAG et Fact-Checking si disponibles
        if (ragResults.enriched) {
            enrichedResponse.rag_verification = {
                enabled: true,
                relevant_facts_count: ragResults.relevantFacts.length,
                contradictions_found: ragResults.contradictions.length,
                recommendation: ragResults.recommendation,
                top_facts: ragResults.relevantFacts.slice(0, 2).map(f => ({
                    fact: f.fact,
                    confidence: f.confidence,
                    similarity: Math.round(f.similarity * 100) / 100
                }))
            };
        }
        
        if (factCheckResults.checked && factCheckResults.claimsVerified > 0) {
            enrichedResponse.fact_check = {
                enabled: true,
                claims_extracted: factCheckResults.claimsFound,
                claims_verified: factCheckResults.claimsVerified,
                overall_trust: Math.round(factCheckResults.overallTrust * 100) / 100,
                fake_news_detected: factCheckResults.hasFakeNews,
                verified_claims: factCheckResults.results
                    .filter(r => r.found)
                    .map(r => ({
                        claim: r.claim.substring(0, 100) + (r.claim.length > 100 ? '...' : ''),
                        rating: r.rating,
                        publisher: r.publisher,
                        trust_score: r.trustScore
                    }))
            };
        }
        
        context.log('📊 Métriques finales:', enrichedResponse.confidence_metrics);
        
        // 🛡️ Analyse de protection contre l'accumulation d'hallucinations
        try {
            // conversationHistory est déjà déclaré plus haut
            const currentHI = hiPercentage;
            const messagesWithCurrent = [
                ...conversationHistory,
                {
                    type: 'bot',
                    hiScore: currentHI,
                    chrScore: chrPercentage,
                    content: enrichedResponse.response
                }
            ];
            
            const protectionAnalysis = hallucinationProtection.analyzeConversationRisk(
                req.body.conversationId || 'default',
                messagesWithCurrent
            );
            
            // Ajouter l'analyse de protection à la réponse
            enrichedResponse.protection = {
                risk_level: protectionAnalysis.level,
                should_intervene: protectionAnalysis.shouldIntervene,
                should_block: protectionAnalysis.shouldBlock,
                stats: protectionAnalysis.stats,
                recommended_action: protectionAnalysis.action
            };
            
            context.log('🛡️ Protection analysis:', protectionAnalysis.level);
        } catch (protectionError) {
            context.log.error('⚠️ Erreur dans l\'analyse de protection:', protectionError.message);
            // Protection par défaut en cas d'erreur
            enrichedResponse.protection = {
                risk_level: 'safe',
                should_intervene: false,
                should_block: false,
                stats: { avgHI: 0, maxHI: 0, recentAvgHI: 0, totalMessages: 0, highRiskCount: 0, trend: 'stable' },
                recommended_action: { type: 'NONE', message: '', description: '', actions: [], icon: '', color: '' }
            };
        }
        
        // 🚀 PERFORMANCE : Calculer le temps de traitement total
        const totalTime = Date.now() - startTime;
        enrichedResponse.processingTime = `${(totalTime / 1000).toFixed(2)}s`;
        enrichedResponse.processingTimeMs = totalTime;
        
        // 💾 CACHE : Stocker la réponse en cache (seulement pour conversations sans historique ou courtes)
        if (conversationHistory.length <= 5) {
            setCachedResponse(cacheKey, enrichedResponse);
            context.log(`💾 Response cached for key: ${cacheKey.substring(0, 50)}...`);
        }
        
        context.log(`⚡ Total processing time: ${totalTime}ms`);
        context.log(`📊 Cache size: ${responseCache.size} entries`);
        
        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'X-Cache': 'MISS',
                'X-Response-Time': `${totalTime}ms`
            },
            body: enrichedResponse
        };

    } catch (error) {
        const errorTime = Date.now() - startTime;
        context.log.error('Error invoking Axilum AI:', error);
        context.log.error('Error stack:', error.stack);
        context.log.error(`❌ Error occurred after ${errorTime}ms`);
        context.res = {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'X-Response-Time': `${errorTime}ms`
            },
            body: { 
                error: "Failed to invoke Axilum AI",
                details: error.message,
                timestamp: new Date().toISOString(),
                processingTimeMs: errorTime
            }
        };
    }
};

// 🆓 PLAN GRATUIT - Llama 3.3 via Groq (100% Gratuit) + RAG
// Groq API : https://groq.com
// Modèle : llama-3.3-70b-versatile (70B paramètres)
// Coût : $0 (30 req/min gratuit)
// Vitesse : 500+ tokens/sec (ultra-rapide)

const { analyzeHallucination } = require('../utils/hallucinationDetector');
const { buildSystemPromptForAgent, normalizeAgentId } = require('../utils/agentRegistry');
const { orchestrateMultiAgents, callGroqChatCompletion } = require('../utils/orchestrator');
const { buildWebEvidenceContext } = require('../utils/webEvidence');
const { appendEvidenceContext, searchWikipedia, searchNewsApi } = require('../utils/sourceProviders');

// Fonction RAG - Recherche Brave
async function searchBrave(query, apiKey) {
    if (!apiKey) return null;
    
    try {
        const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Subscription-Token': apiKey
            }
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        if (!data.web?.results) return null;
        
        // Extraire les 3 premiers résultats
        const results = data.web.results.slice(0, 3).map(r => ({
            title: r.title,
            description: r.description,
            url: r.url
        }));
        
        return results;
    } catch (error) {
        return null;
    }
}

// NOTE: l'orchestration et les appels Groq sont centralisés dans api/utils/orchestrator.js

module.exports = async function (context, req) {
    context.log('🆓 FREE PLAN - Llama 3.3 Request');

    // CORS
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        };
        return;
    }

    try {
        const userMessage = req.body.message;

        if (!userMessage) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { error: "Message is required" }
            };
            return;
        }

        const startTime = Date.now();
        
        // Groq API configuration
        const groqApiKey = process.env.GROQ_API_KEY;
        
        if (!groqApiKey) {
            context.log.error('⚠️ GROQ_API_KEY not configured - using simple fallback');
            
            // Réponses prédéfinies pour les cas communs
            const lowerMessage = userMessage.toLowerCase();
            let fallbackResponse = "Bonjour ! Je suis Axilum AI.";
            
            if (lowerMessage.includes('bonjour') || lowerMessage.includes('salut') || lowerMessage.includes('hello')) {
                fallbackResponse = "Bonjour ! Je suis Axilum AI, votre assistant intelligent. Comment puis-je vous aider aujourd'hui ?";
            } else if (lowerMessage.includes('qui es-tu') || lowerMessage.includes('présente') || lowerMessage.includes('qui es tu')) {
                fallbackResponse = "Je suis Axilum AI, un assistant conversationnel intelligent propulsé par Llama 3.3 70B.";
            } else if (lowerMessage.includes('aide') || lowerMessage.includes('help')) {
                fallbackResponse = "Je peux vous aider avec diverses questions ! Pour activer toutes mes capacités (Llama 3.2), l'administrateur doit configurer la clé API Groq. En attendant, n'hésitez pas à poser vos questions !";
            } else {
                fallbackResponse = `Votre question : "${userMessage}"\n\nJe suis actuellement en mode configuration limitée. Pour profiter pleinement du mode gratuit avec Llama 3.2, veuillez configurer GROQ_API_KEY dans Azure.\n\nEn attendant, essayez le mode PRO pour une expérience complète avec GPT-4o !`;
            }
            
            context.res = {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: {
                    response: fallbackResponse + "\n\n---\n💡 *Mode Gratuit - Configuration Groq requise*",
                    hallucinationIndex: 0,
                    contextHistoryRatio: 0,
                    responseTime: `${Date.now() - startTime}ms`,
                    freePlan: true,
                    model: 'fallback'
                }
            };
            return;
        }

        // Préparer l'historique
        const conversationHistory = req.body.history || [];
        const recentHistory = conversationHistory.slice(-10); // Limiter à 10 pour Free

        const chatType = req.body.chatType || req.body.conversationId;
        const isOrchestrator = chatType === 'orchestrator';
        const forceWebSearch = chatType === 'web-search' || chatType === 'rnd-web-search';

        // 🧩 ORCHESTRATEUR MULTI-AGENTS (sur demande) + mode AUTO (planner)
        if (isOrchestrator) {
            const braveKey = process.env.BRAVE_API_KEY;
            const teamQuestion = String(req.body.teamQuestion || userMessage || '').trim();

            const orchestrated = await orchestrateMultiAgents({
                groqKey: groqApiKey,
                teamQuestion,
                teamAgentsRaw: req.body.teamAgents,
                recentHistory,
                braveKey,
                searchBrave,
                analyzeHallucination,
                logger: context.log
            });

            if (!orchestrated.ok) {
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: { response: `⚠️ ${orchestrated.error || 'Erreur orchestration'}` }
                };
                return;
            }

            const responseTime = Date.now() - startTime;
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: {
                    response: orchestrated.response,
                    responseTime: `${responseTime}ms`,
                    freePlan: true,
                    model: 'llama-3.3-70b',
                    provider: 'Groq',
                    tokensUsed: orchestrated.tokensUsed || 0,
                    orchestrator: true,
                    orchestratorAgents: orchestrated.orchestratorAgents || [],
                    hallucinationIndex: orchestrated.hallucination?.hiPercent ?? 0,
                    contextHistoryRatio: orchestrated.hallucination?.chrPercent ?? 0,
                    hallucinationClaims: orchestrated.hallucination?.claims || [],
                    hallucinationCounts: orchestrated.hallucination?.counts || {},
                    hallucinationSources: orchestrated.hallucination?.sources || [],
                    hallucinationMethod: orchestrated.hallucination?.method || 'unknown'
                }
            };
            return;
        }

        // RAG - Recherche Brave (optionnelle, ou forcée selon l'agent)
        let contextFromSearch = '';
        
        try {
            const braveKey = process.env.BRAVE_API_KEY;
            if (!braveKey && forceWebSearch) {
                contextFromSearch = '\n\n[Recherche web indisponible: BRAVE_API_KEY non configurée]\n';
            }
            if (braveKey) {
                const searchResults = await searchBrave(userMessage, braveKey);
                if (searchResults && searchResults.length > 0) {
                    if (forceWebSearch) {
                        contextFromSearch = await buildWebEvidenceContext({
                            question: userMessage,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                    } else {
                        contextFromSearch = '\n\nContexte de recherche web (utilise ces informations si pertinentes) :\n';
                        searchResults.forEach((r, i) => {
                            contextFromSearch += `${i+1}. ${r.title}: ${r.description} [${r.url}]\n`;
                        });
                    }
                }
            }
        } catch (ragError) {
            context.log.warn('⚠️ RAG search failed, continuing without it:', ragError.message);
            // Continue sans RAG
        }

        // 🔎 Sources additionnelles (Wesh): Wikipedia + NewsAPI (preuves)
        if (forceWebSearch) {
            try {
                const isGreeting = /^(\s)*(bonjour|salut|hello|hi|coucou|bonsoir|ça va|cv)(\s|!|\?|\.|,)*$/i.test(String(userMessage || ''));
                const wikiEnabled = String(process.env.WESH_WIKIPEDIA_ENABLED ?? 'true').toLowerCase() !== 'false';
                const newsEnabled = String(process.env.WESH_NEWSAPI_ENABLED ?? 'true').toLowerCase() !== 'false';
                const newsApiKey = process.env.APPSETTING_NEWSAPI_KEY || process.env.NEWSAPI_KEY;

                const wikiLimit = Math.max(0, Math.min(5, Number(process.env.WESH_WIKIPEDIA_MAX ?? 2) || 2));
                const newsLimit = Math.max(0, Math.min(5, Number(process.env.WESH_NEWSAPI_MAX ?? 3) || 3));

                if (!isGreeting) {
                    const wiki = (wikiEnabled && wikiLimit > 0)
                        ? await searchWikipedia(userMessage, { lang: 'fr', limit: wikiLimit, timeoutMs: 5000 })
                        : [];

                    const news = (newsEnabled && newsApiKey && newsLimit > 0)
                        ? await searchNewsApi(userMessage, { apiKey: newsApiKey, language: 'fr', pageSize: newsLimit, timeoutMs: 5000 })
                        : [];

                    contextFromSearch = appendEvidenceContext(contextFromSearch, [...wiki, ...news]);
                }
            } catch (e) {
                context.log.warn('⚠️ Sources additionnelles Wesh indisponibles:', e?.message || e);
            }
        }

        // Construire les messages
        const normalizedChatType = String(chatType || '').trim();
        const agentId = normalizeAgentId(normalizedChatType) || normalizedChatType;

        const messages = [
            {
                role: "system",
                content: buildSystemPromptForAgent(agentId, contextFromSearch)
            }
        ];

        // Ajouter l'historique
        recentHistory.forEach(msg => {
            if (msg.type === 'user' && msg.content) {
                messages.push({ role: "user", content: msg.content });
            } else if (msg.type === 'bot' && msg.content) {
                const cleanContent = msg.content
                    .replace(/\n*---[\s\S]*/g, '')
                    .replace(/\n*💡.*\n*/gi, '')
                    .trim();
                // Ajouter seulement si le contenu n'est pas vide après nettoyage
                if (cleanContent && cleanContent.length > 0) {
                    messages.push({ role: "assistant", content: cleanContent });
                }
            }
        });

        // Ajouter le message actuel
        messages.push({ role: "user", content: userMessage });

        context.log('📤 Calling Groq Llama 3.3 (FREE)...');

        // Appeler Groq API
        let data;
        try {
            data = await callGroqChatCompletion(groqApiKey, messages, { max_tokens: 2000, temperature: 0.7 });
        } catch (e) {
            context.log.error('❌ Groq API Error:', e.status || 'n/a', e.details || e.message);
            
            // Message d'erreur plus informatif
            let errorMessage = "Je suis temporairement indisponible.";
            
            if (e.status === 429) {
                errorMessage = "Limite de requêtes atteinte (30/min). Veuillez patienter quelques secondes ou essayer le mode PRO.";
            } else if (e.status === 401) {
                errorMessage = "Clé API Groq invalide. Veuillez vérifier la configuration GROQ_API_KEY dans Azure.";
            } else if (e.status >= 500) {
                errorMessage = "Service Groq temporairement indisponible. Réessayez dans quelques instants ou utilisez le mode PRO.";
            }
            
            context.res = {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: {
                    response: errorMessage + "\n\n---\n💡 *Mode Gratuit - Essayez le mode PRO pour une disponibilité garantie*",
                    hallucinationIndex: 0,
                    contextHistoryRatio: 0,
                    responseTime: `${Date.now() - startTime}ms`,
                    freePlan: true,
                    error: true,
                    errorCode: e.status || 500
                }
            };
            return;
        }

        const aiResponse = data.choices[0].message.content;
        const processingTime = Date.now() - startTime;

        context.log('✅ Llama 3.3 Response received');
        context.log('Response length:', aiResponse.length);
        context.log('Processing time:', processingTime + 'ms');

        // Analyse anti-hallucination avec modèles GRATUITS (Groq/Gemini)
        let hallucinationAnalysis;
        try {
            hallucinationAnalysis = await analyzeHallucination(aiResponse, userMessage);
        } catch (analysisError) {
            context.log.warn('Hallucination analysis failed, using defaults:', analysisError.message);
            hallucinationAnalysis = {
                hi: 0,
                chr: 0,
                claims: [],
                counts: {},
                sources: [],
                warning: null,
                method: 'fallback-error'
            };
        }

        // 🧹 Auto-correction (Wesh uniquement)
        const isWesh = forceWebSearch;
        const hasWebSources = typeof contextFromSearch === 'string' && /\n\[S1\]\s+/m.test(contextFromSearch);
        const isGreeting = /^(\s)*(bonjour|salut|hello|hi|coucou|bonsoir|ça va|cv)(\s|!|\?|\.|,)*$/i.test(String(userMessage || ''));
        const riskScore = Math.max(Number(hallucinationAnalysis.hi || 0), Number(hallucinationAnalysis.chr || 0));

        const autoCorrectEnabled = String(process.env.WESH_AUTOCORRECT_ENABLED ?? 'true').toLowerCase() !== 'false';
        const parsedThreshold = Number(process.env.WESH_AUTOCORRECT_THRESHOLD ?? 0.30);
        const autoCorrectThreshold = Number.isFinite(parsedThreshold)
            ? Math.max(0, Math.min(1, parsedThreshold))
            : 0.30;

        const shouldAutoCorrect = autoCorrectEnabled
            && isWesh
            && hasWebSources
            && !isGreeting
            && (hallucinationAnalysis.warning || riskScore >= autoCorrectThreshold);

        let finalAiResponse = aiResponse;
        let autoCorrectionUsage = null;
        let autoCorrectionApplied = false;

        if (shouldAutoCorrect) {
            try {
                const correctionMessages = [
                    { role: 'system', content: buildSystemPromptForAgent('web-search', contextFromSearch) },
                    {
                        role: 'system',
                        content: [
                            'Tu vas corriger une réponse initiale afin de réduire le risque d\'hallucination.',
                            'Contraintes:',
                            '- N\'utilise QUE les informations présentes dans le "Contexte de recherche web".',
                            '- Supprime ou nuance toute affirmation qui n\'est pas explicitement supportée par les extraits.',
                            '- Si une info n\'est pas dans les extraits, dis clairement que tu ne peux pas confirmer.',
                            '- Conserve les citations [S#] uniquement quand elles correspondent à de vraies sources du contexte.',
                            '- Ne crée pas de nouvelles sources.'
                        ].join('\n')
                    },
                    { role: 'user', content: `Question: ${userMessage}\n\nRéponse initiale à corriger:\n${aiResponse}` }
                ];

                const correctedData = await callGroqChatCompletion(groqApiKey, correctionMessages, { max_tokens: 2500, temperature: 0.2 });
                autoCorrectionUsage = correctedData?.usage || null;
                const corrected = correctedData?.choices?.[0]?.message?.content;
                if (typeof corrected === 'string' && corrected.trim()) {
                    finalAiResponse = corrected.trim();
                    autoCorrectionApplied = true;
                    try {
                        hallucinationAnalysis = await analyzeHallucination(finalAiResponse, userMessage);
                    } catch (_) {
                        // keep previous analysis if re-check fails
                    }
                }
            } catch (e) {
                context.log.warn('Auto-correction Wesh échouée, réponse initiale conservée:', e?.message || e);
            }
        }
        
        // Convertir en pourcentage (0-1 → 0-100)
        const hiPercent = (hallucinationAnalysis.hi * 100).toFixed(1);
        const chrPercent = (hallucinationAnalysis.chr * 100).toFixed(1);
        
        // 📊 Ajout des métriques dans la réponse
        let metricsText = `\n\n---\n📊 **Métriques de Fiabilité**\nHI: ${hiPercent}% | CHR: ${chrPercent}%`;
        
        // Ajouter warning si risque élevé
        if (hallucinationAnalysis.warning) {
            metricsText += `\n${hallucinationAnalysis.warning}`;
        }
        
        // Ajouter sources si disponibles
        if (hallucinationAnalysis.sources && hallucinationAnalysis.sources.length > 0) {
            metricsText += `\n\n📚 Sources: ${hallucinationAnalysis.sources.join(', ')}`;
        }
        
        const tokensUsedTotal = (data.usage?.total_tokens || 0) + (autoCorrectionUsage?.total_tokens || 0);
        metricsText += `\n💡 *Mode Gratuit - ${tokensUsedTotal} tokens utilisés*`;
        const finalResponse = finalAiResponse + metricsText;

        context.res = {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                response: finalResponse,
                responseTime: `${processingTime}ms`,
                freePlan: true,
                model: 'llama-3.3-70b',
                provider: 'Groq',
                tokensUsed: tokensUsedTotal,
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                qualityScore: 95,
                advancedFeatures: false,
                autoCorrected: autoCorrectionApplied,
                autoCorrectThreshold: autoCorrectThreshold,
                hallucinationIndex: parseFloat(hiPercent),
                contextHistoryRatio: parseFloat(chrPercent),
                hallucinationClaims: hallucinationAnalysis.claims || [],
                hallucinationCounts: hallucinationAnalysis.counts || {},
                hallucinationSources: hallucinationAnalysis.sources || [],
                hallucinationMethod: hallucinationAnalysis.method || 'unknown'
            }
        };
        
        const totalTime = Date.now() - startTime;
        context.log(`✅ Free plan response: ${totalTime}ms`);


    } catch (error) {
        context.log.error('❌ Error in Free Plan:', error);
        
        // En cas d'erreur, retourner une réponse générique
        context.res = {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                response: "Je suis Axilum AI en mode gratuit. Comment puis-je vous aider ?\n\n---\n💡 *Mode Gratuit - Essayez le mode PRO pour plus de fonctionnalités*",
                hallucinationIndex: 0,
                contextHistoryRatio: 0,
                responseTime: '0ms',
                freePlan: true,
                error: false
            }
        };
    }
};

// 🔍 Google Fact Check Tools API
async function googleFactCheck(query) {
    const factCheckApiKey = process.env.APPSETTING_GOOGLE_FACT_CHECK_API_KEY || process.env.GOOGLE_FACT_CHECK_API_KEY;
    
    if (!factCheckApiKey) {
        return null; // Pas de clé = pas de fact-check
    }
    
    try {
        const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?key=${factCheckApiKey}&query=${encodeURIComponent(query)}&languageCode=fr`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        
        if (!data.claims || data.claims.length === 0) {
            return null;
        }
        
        // Extraire les sources vérifiées
        const sources = data.claims.slice(0, 5).map(claim => {
            const review = claim.claimReview?.[0];
            return {
                claim: claim.text,
                publisher: review?.publisher?.name || 'Source inconnue',
                rating: review?.textualRating || 'Non évalué',
                url: review?.url || '',
                date: review?.reviewDate || ''
            };
        });
        
        return sources;
    } catch (error) {
        return null;
    }
}

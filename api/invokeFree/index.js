// 🆓 PLAN GRATUIT - Llama 3.3 via Groq (100% Gratuit) + RAG
// Groq API : https://groq.com
// Modèle : llama-3.3-70b-versatile (70B paramètres)
// Coût : $0 (30 req/min gratuit)
// Vitesse : 500+ tokens/sec (ultra-rapide)

const { analyzeHallucination } = require('../utils/hallucinationDetector');

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

function pickTeamAgents(rawAgents) {
    const allowed = new Set([
        'agent-dev',
        'marketing-agent',
        'hr-management',
        'excel-expert',
        'agent-todo',
        'web-search',
        'agent-alex',
        'agent-tony',
        'axilum'
    ]);

    const agents = Array.isArray(rawAgents) ? rawAgents : [];
    const normalized = agents
        .map(a => String(a || '').trim().toLowerCase())
        .filter(Boolean)
        .filter(a => allowed.has(a));

    return Array.from(new Set(normalized)).slice(0, 3);
}

function buildSystemPromptForAgent(chatType, contextFromSearch) {
    const c = contextFromSearch || '';
    switch (chatType) {
        case 'agent-dev':
            return `Tu es Agent Dev, un assistant spécialisé en développement logiciel.

Objectif: aider l'utilisateur à concevoir, implémenter, déboguer et livrer des fonctionnalités.

Règles:
- Sois concret (étapes, commandes, fichiers, APIs), sans inventer.
- Pose 1-3 questions si c'est bloquant; sinon avance avec l'option la plus simple.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, clairement et professionnellement.${c}`;
        case 'marketing-agent':
            return `Tu es Agent Marketing.

Tu aides sur: positionnement, offres, contenu, SEO, ads, emails, funnels, analytics, go-to-market.

Règles:
- Propose des plans concrets (étapes, livrables, KPI) adaptés à un SaaS.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, clair et orienté résultats.${c}`;
        case 'hr-management':
            return `Tu es Agent RH, un assistant RH.

Tu aides sur: politique RH, congés, paie (conceptuellement), recrutement, onboarding, performance, documents et conformité (sans avis juridique).

Règles:
- Si des données RH internes ne sont pas fournies, dis-le et demande les infos nécessaires.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, clair, professionnel et actionnable.${c}`;
        case 'excel-expert':
            return `Tu es Agent Excel.

Tu aides sur formules (XLOOKUP/RECHERCHEX, INDEX/EQUIV, SI, SOMME.SI.ENS), TCD, Power Query, nettoyage, bonnes pratiques.

Règles:
- Donne des exemples de formules (format Excel) et explique-les.
- Ne prétends pas modifier un fichier.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, pédagogique et précis.${c}`;
        case 'agent-todo':
            return `Tu es Agent ToDo (gestion de tâches).

Objectif: aider l'utilisateur à clarifier un objectif, découper en tâches, estimer, prioriser, et proposer un plan.

Règles:
- Pose 1-3 questions si nécessaire, sinon propose directement une checklist + prochaines actions.
- Ne prétends pas exécuter des actions automatiquement.

Réponds en français, très concret.${c}`;
        case 'web-search':
            return `Tu es Agent Web Search.

Objectif: répondre en te basant sur la recherche web fournie dans le contexte.

Règles:
- Cite 2-5 sources en fin de réponse.
- Si la recherche web est indisponible, dis-le.

Réponds en français, clairement et avec sources.${c}`;
        case 'agent-alex':
            return `Tu es Agent Alex.

Rôle: assistant polyvalent orienté stratégie/produit/organisation.

Réponds en français, clair et structuré.${c}`;
        case 'agent-tony':
            return `Tu es Agent Tony.

Rôle: assistant orienté vente/ops (pricing, onboarding client, scripts, objections, process).

Réponds en français, direct et actionnable.${c}`;
        case 'axilum':
        default:
            return `Tu es Axilum AI, un assistant intelligent et serviable.

Réponds en français, clairement et honnêtement.${c}`;
    }
}

async function callGroqChatCompletion(groqKey, messages, { max_tokens = 1200, temperature = 0.5 } = {}) {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens, temperature })
    });

    if (!resp.ok) {
        const errorText = await resp.text();
        const err = new Error(`Groq Error: ${resp.status}`);
        err.details = errorText;
        err.status = resp.status;
        throw err;
    }

    return await resp.json();
}

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

        // 🧩 ORCHESTRATEUR MULTI-AGENTS (sur demande)
        if (isOrchestrator) {
            const teamAgents = pickTeamAgents(req.body.teamAgents);
            const teamQuestion = String(req.body.teamQuestion || userMessage || '').trim();

            if (!teamQuestion) {
                context.res = { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: { response: "⚠️ Question vide. Utilisez: /team dev marketing -- votre question" } };
                return;
            }
            if (teamAgents.length === 0) {
                context.res = { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: { response: "⚠️ Aucun agent valide. Exemples: dev, marketing, rh, excel, todo, web, alex, tony" } };
                return;
            }

            const historyLines = [];
            recentHistory.slice(-6).forEach(msg => {
                if ((msg.type === 'user' || msg.role === 'user') && msg.content) {
                    historyLines.push(`Utilisateur: ${String(msg.content).slice(0, 300)}`);
                } else if ((msg.type === 'bot' || msg.role === 'assistant') && msg.content) {
                    const clean = String(msg.content).replace(/\n*---[\s\S]*/g, '').replace(/\n*💡.*\n*/gi, '').trim();
                    if (clean) historyLines.push(`Assistant: ${clean.slice(0, 300)}`);
                }
            });
            const compactHistory = historyLines.length ? `\n\nContexte conversation (extraits):\n${historyLines.join('\n')}` : '';

            let contextFromSearch = '';
            try {
                const braveKey = process.env.BRAVE_API_KEY;
                const needsSearch = teamAgents.includes('web-search');
                if (needsSearch) {
                    if (!braveKey) {
                        contextFromSearch = '\n\n[Recherche web indisponible: BRAVE_API_KEY non configurée]\n';
                    } else {
                        const searchResults = await searchBrave(teamQuestion, braveKey);
                        if (searchResults && searchResults.length > 0) {
                            contextFromSearch = '\n\nContexte de recherche web (utilise ces informations si pertinentes) :\n';
                            searchResults.forEach((r, i) => {
                                contextFromSearch += `${i + 1}. ${r.title}: ${r.description} [${r.url}]\n`;
                            });
                        }
                    }
                }
            } catch (_) {}

            const workerOutputs = [];
            let totalTokensUsed = 0;

            for (const agent of teamAgents) {
                const workerMessages = [
                    { role: 'system', content: buildSystemPromptForAgent(agent, contextFromSearch) },
                    { role: 'user', content: `Tu es consulté comme expert (${agent}).\nRéponds de façon concise et actionnable.\n\nQuestion: ${teamQuestion}${compactHistory}` }
                ];
                const workerData = await callGroqChatCompletion(groqApiKey, workerMessages, { max_tokens: 1000, temperature: 0.5 });
                const workerText = workerData?.choices?.[0]?.message?.content || '';
                totalTokensUsed += workerData?.usage?.total_tokens || 0;
                workerOutputs.push({ agent, text: workerText });
            }

            const synthMessages = [
                {
                    role: 'system',
                    content: `Tu es un Orchestrateur multi-agents.

Objectif: produire UNE réponse finale à l'utilisateur, en te basant sur les analyses de plusieurs experts.

Règles:
- Ne mentionne pas les noms/ids des agents.
- Fusionne et déduplique.
- Donne un plan d'action priorisé.

Réponds en français, clairement et professionnellement.`
                },
                {
                    role: 'user',
                    content: `Question utilisateur: ${teamQuestion}\n\nNotes d'experts:\n${workerOutputs.map(w => `\n[${w.agent}]\n${w.text}`).join('\n')}`
                }
            ];

            const synthData = await callGroqChatCompletion(groqApiKey, synthMessages, { max_tokens: 1400, temperature: 0.6 });
            const aiResponse = synthData?.choices?.[0]?.message?.content || '';
            totalTokensUsed += synthData?.usage?.total_tokens || 0;

            const responseTime = Date.now() - startTime;

            let hallucinationAnalysis;
            try {
                hallucinationAnalysis = await analyzeHallucination(aiResponse, teamQuestion);
            } catch (_) {
                hallucinationAnalysis = { hi: 0, chr: 0, claims: [], counts: {}, sources: [], warning: null, method: 'fallback-error' };
            }

            const hiPercent = (hallucinationAnalysis.hi * 100).toFixed(1);
            const chrPercent = (hallucinationAnalysis.chr * 100).toFixed(1);
            let metricsText = `\n\n---\n📊 **Métriques de Fiabilité**\nHI: ${hiPercent}% | CHR: ${chrPercent}%`;
            if (hallucinationAnalysis.warning) metricsText += `\n${hallucinationAnalysis.warning}`;
            if (hallucinationAnalysis.sources && hallucinationAnalysis.sources.length > 0) {
                metricsText += `\n\n📚 Sources: ${hallucinationAnalysis.sources.join(', ')}`;
            }
            metricsText += `\n💡 *Orchestrateur - ${totalTokensUsed} tokens utilisés*`;

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: {
                    response: aiResponse + metricsText,
                    responseTime: `${responseTime}ms`,
                    freePlan: true,
                    model: 'llama-3.3-70b',
                    provider: 'Groq',
                    tokensUsed: totalTokensUsed,
                    orchestrator: true,
                    orchestratorAgents: teamAgents,
                    hallucinationIndex: parseFloat(hiPercent),
                    contextHistoryRatio: parseFloat(chrPercent),
                    hallucinationClaims: hallucinationAnalysis.claims || [],
                    hallucinationCounts: hallucinationAnalysis.counts || {},
                    hallucinationSources: hallucinationAnalysis.sources || [],
                    hallucinationMethod: hallucinationAnalysis.method || 'unknown'
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
                    contextFromSearch = '\n\nContexte de recherche web (utilise ces informations si pertinentes) :\n';
                    searchResults.forEach((r, i) => {
                        contextFromSearch += `${i+1}. ${r.title}: ${r.description} [${r.url}]\n`;
                    });
                }
            }
        } catch (ragError) {
            context.log.warn('⚠️ RAG search failed, continuing without it:', ragError.message);
            // Continue sans RAG
        }

        // Construire les messages
        const messages = [
            {
                role: "system",
                content: (chatType === 'agent-dev')
                    ? `Tu es Agent Dev, un assistant spécialisé en développement logiciel.

Objectif: aider l'utilisateur à concevoir, implémenter, déboguer et livrer des fonctionnalités.

Règles:
- Sois concret (étapes, commandes, fichiers, APIs), sans inventer.
- Pose 1-3 questions si c'est bloquant; sinon avance avec l'option la plus simple.
- Ne prétends pas "contacter" d'autres agents IA automatiquement.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.
- Si l'utilisateur colle un "🔎 Rapport Hallucination Detector", reconnais-le et explique-le.

Réponds en français, clairement et professionnellement.${contextFromSearch}`
                    : (chatType === 'hr-management')
                        ? `Tu es Agent RH, un assistant RH.

Tu aides sur: politique RH, congés, paie (conceptuellement), recrutement, onboarding, performance, documents.

Règles:
- Si des données RH internes ne sont pas fournies, demande les infos nécessaires.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, clair et actionnable.${contextFromSearch}`
                        : (chatType === 'marketing-agent')
                            ? `Tu es Agent Marketing.

Tu aides sur: positionnement, contenu, SEO, ads, emails, funnels, analytics, go-to-market.

Règles:
- Propose des plans concrets (étapes, livrables, KPI) adaptés à un SaaS.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, clair et orienté résultats.${contextFromSearch}`
                            : (chatType === 'web-search' || chatType === 'rnd-web-search')
                                ? `Tu es Agent Web Search.

Objectif: répondre en t'appuyant sur le "Contexte de recherche web".

Règles:
- Cite 2-5 sources en fin de réponse (titres + URLs si disponibles).
- Si la recherche web est indisponible, dis-le et propose une réponse prudente + quoi vérifier.

Réponds en français, avec sources.${contextFromSearch}`
                                : (chatType === 'excel-expert' || chatType === 'excel-ai-expert')
                                    ? `Tu es Agent Excel.

Tu aides sur formules, TCD, Power Query, nettoyage et bonnes pratiques.

Règles:
- Donne des exemples de formules et explique-les.
- Ne prétends pas modifier un fichier.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, pédagogique et précis.${contextFromSearch}`
                                    : (chatType === 'agent-todo')
                                        ? `Tu es Agent ToDo (gestion de tâches).

Objectif: clarifier un objectif, découper en tâches, prioriser, et proposer un plan.

Règles:
- Pose 1-3 questions si nécessaire, sinon propose une checklist + prochaines actions.
- Ne prétends pas exécuter des actions automatiquement.

- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, concret.${contextFromSearch}`
                                        : (chatType === 'agent-alex')
                                            ? `Tu es Agent Alex (assistant stratégie/produit SaaS).

Règles:
- Propose options + avantages/inconvénients + next step.

- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, clair et structuré.${contextFromSearch}`
                                            : (chatType === 'agent-tony')
                                                ? `Tu es Agent Tony (assistant vente/ops SaaS).

Règles:
- Propose scripts, templates et KPI.

- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, direct et actionnable.${contextFromSearch}`
                    : `Tu es Axilum AI, un assistant intelligent et serviable.

Tu utilises un système avancé de vérification en arrière-plan pour garantir la qualité de tes réponses.

Principes de réponse:
✅ Utilise des nuances quand approprié: "généralement", "probablement", "souvent", "il semble que"
✅ Cite des sources quand c'est pertinent: "selon", "d'après", "les études montrent"
✅ Admets l'incertitude: "je ne suis pas sûr", "cela dépend de", "il faudrait vérifier"
✅ Sois précis et honnête
❌ Évite les affirmations absolues sans fondement
❌ N'invente pas de faits que tu ne peux pas vérifier

NE MENTIONNE PAS le système de détection d'hallucinations ou les métriques (HI, CHR) sauf si l'utilisateur te pose explicitement une question à ce sujet.

IMPORTANT (reconnaissance du rapport):
- Si l'utilisateur colle un bloc commençant par "🔎 Rapport Hallucination Detector" (ou te demande d'expliquer HI/CHR/claims), considère que c'est un rapport interne généré par l'application.
- Dans ce cas, explique le rapport et propose des actions de vérification (ex: vérifier les sources recommandées).
- Ne dis pas que ce rapport "n'existe pas" : traite-le comme un artefact du système.

Réponds de manière naturelle, claire et professionnelle en français.
Pense étape par étape avant de répondre.${contextFromSearch}`
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
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqApiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error('❌ Groq API Error:', response.status, errorText);
            
            // Message d'erreur plus informatif
            let errorMessage = "Je suis temporairement indisponible.";
            
            if (response.status === 429) {
                errorMessage = "Limite de requêtes atteinte (30/min). Veuillez patienter quelques secondes ou essayer le mode PRO.";
            } else if (response.status === 401) {
                errorMessage = "Clé API Groq invalide. Veuillez vérifier la configuration GROQ_API_KEY dans Azure.";
            } else if (response.status >= 500) {
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
                    errorCode: response.status
                }
            };
            return;
        }

        const data = await response.json();
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
        
        metricsText += `\n💡 *Mode Gratuit - ${data.usage?.total_tokens || 0} tokens utilisés*`;
        const finalResponse = aiResponse + metricsText;

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
                tokensUsed: data.usage?.total_tokens || 0,
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                qualityScore: 95,
                advancedFeatures: false,
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

// 💎 PLAN PRO - GPT-5 mini via Azure OpenAI (Version Simple)
// Azure OpenAI API
// Modèle : gpt-5-mini
// Endpoint : https://axilimopenai.cognitiveservices.azure.com

module.exports = async function (context, req) {
    context.log('💎 PRO PLAN - GPT-5 mini Request (Simple Version)');

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
        
        // Azure OpenAI configuration
        const apiKey = process.env.AZURE_AI_API_KEY;
        const endpoint = 'https://axilimopenai.cognitiveservices.azure.com';
        const deployment = 'gpt-5-mini';
        const apiVersion = '2024-12-01-preview';
        
        if (!apiKey) {
            context.log.error('⚠️ AZURE_AI_API_KEY not configured');
            context.res = {
                status: 500,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: {
                    error: "Azure OpenAI API Key not configured",
                    hint: "Please configure AZURE_AI_API_KEY in Azure Static Web App settings",
                    responseTime: `${Date.now() - startTime}ms`
                }
            };
            return;
        }

        // Préparer l'historique
        const conversationHistory = req.body.history || [];
        const recentHistory = conversationHistory.slice(-20); // Limiter à 20 messages

        const chatType = req.body.chatType || req.body.conversationId;

        // (Optionnel) RAG - Recherche Brave pour le mode web-search
        let contextFromSearch = '';
        if (chatType === 'web-search' || chatType === 'rnd-web-search') {
            try {
                const braveKey = process.env.APPSETTING_BRAVE_API_KEY || process.env.BRAVE_API_KEY;
                if (!braveKey) {
                    contextFromSearch = '\n\n[Recherche web indisponible: BRAVE_API_KEY non configurée]\n';
                } else {
                    const q = encodeURIComponent(userMessage);
                    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${q}&count=3`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'X-Subscription-Token': braveKey
                        }
                    });
                    if (r.ok) {
                        const data = await r.json();
                        const results = data.web?.results?.slice(0, 3) || [];
                        if (results.length > 0) {
                            contextFromSearch = '\n\nContexte de recherche web (utilise ces informations si pertinentes) :\n';
                            results.forEach((it, i) => {
                                contextFromSearch += `${i+1}. ${it.title}: ${it.description} [${it.url}]\n`;
                            });
                        }
                    }
                }
            } catch (_) {}
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
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.
- Si l'utilisateur colle un "🔎 Rapport Hallucination Detector", reconnais-le et explique-le.

Réponds en français, clairement et professionnellement.`
                    : (chatType === 'hr-management')
                        ? `Tu es Agent RH, un assistant RH.

Tu aides sur: politique RH, congés, paie (conceptuellement), recrutement, onboarding, performance, documents.

Règles:
- Si des données RH internes ne sont pas fournies, demande les infos nécessaires.

Réponds en français, clair et actionnable.`
                        : (chatType === 'marketing-agent')
                            ? `Tu es Agent Marketing.

Tu aides sur: positionnement, contenu, SEO, ads, emails, funnels, analytics, go-to-market.

Réponds en français, clair et orienté résultats.`
                            : (chatType === 'web-search' || chatType === 'rnd-web-search')
                                ? `Tu es Agent Web Search.

Objectif: répondre en te basant sur la recherche web fournie.

Règles:
- Cite 2-5 sources en fin de réponse.
- Si la recherche web est indisponible, dis-le et propose une réponse prudente + quoi vérifier.

Réponds en français, avec sources.${contextFromSearch}`
                                : (chatType === 'excel-expert' || chatType === 'excel-ai-expert')
                                    ? `Tu es Agent Excel.

Tu aides sur formules, TCD, Power Query, nettoyage et bonnes pratiques.

Réponds en français, pédagogique et précis.`
                                    : (chatType === 'agent-todo')
                                        ? `Tu es Agent ToDo (gestion de tâches).

Objectif: clarifier un objectif, découper en tâches, prioriser, et proposer un plan.

Règles:
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, concret.`
                                        : (chatType === 'agent-alex')
                                            ? `Tu es Agent Alex (assistant stratégie/produit SaaS).

Règles:
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, clair et structuré.`
                                            : (chatType === 'agent-tony')
                                                ? `Tu es Agent Tony (assistant vente/ops SaaS).

Règles:
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, direct et actionnable.`
                    : `Tu es Axilum AI, un assistant intelligent et serviable propulsé par Azure OpenAI GPT-5 mini. 
Réponds de manière claire, précise et professionnelle en français.

IMPORTANT (Rapport Hallucination Detector):
- Si l'utilisateur fournit un bloc commençant par "🔎 Rapport Hallucination Detector" ou pose une question sur HI/CHR/claims, considère que c'est un rapport interne de fiabilité généré par l'application.
- Explique ce rapport (Score, HI, CHR, Claims, non confirmés, sources) et indique comment vérifier.

**Capacités Pro** :
- Conversations avancées et contextuelles
- Analyse approfondie et raisonnement
- Réponses détaillées et structurées`
            }
        ];

        // Ajouter l'historique
        recentHistory.forEach(msg => {
            if (msg.type === 'user' && msg.content) {
                messages.push({ role: "user", content: msg.content });
            } else if (msg.type === 'bot' && msg.content) {
                // Nettoyer le contenu du bot
                const cleanContent = msg.content
                    .replace(/\n*---[\s\S]*/g, '')
                    .replace(/\n*💡.*\n*/gi, '')
                    .trim();
                if (cleanContent) {
                    messages.push({ role: "assistant", content: cleanContent });
                }
            }
        });

        // Ajouter le message actuel
        messages.push({
            role: "user",
            content: userMessage
        });

        context.log(`📨 Sending request to Azure OpenAI - ${messages.length} messages`);

        // Appel à Azure OpenAI
        const response = await fetch(
            `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': apiKey
                },
                body: JSON.stringify({
                    messages: messages,
                    max_completion_tokens: 4000,
                    temperature: 0.7
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error('❌ Azure OpenAI Error:', response.status, errorText);
            
            context.res = {
                status: response.status,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: {
                    error: `Azure OpenAI Error: ${response.status}`,
                    details: errorText,
                    endpoint: endpoint,
                    deployment: deployment,
                    responseTime: `${Date.now() - startTime}ms`
                }
            };
            return;
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        const responseTime = Date.now() - startTime;

        context.log(`✅ Response generated in ${responseTime}ms`);

        context.res = {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                response: aiResponse,
                responseTime: `${responseTime}ms`,
                proPlan: true,
                model: 'gpt-5-mini',
                tokensUsed: data.usage?.total_tokens || 0
            }
        };

    } catch (error) {
        context.log.error('❌ Error in invoke function:', error);
        context.res = {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                error: "Internal server error",
                message: error.message,
                stack: error.stack
            }
        };
    }
};

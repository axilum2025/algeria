// 💎 PLAN PRO - GPT-5 mini via Azure OpenAI (Version Simple)
// Azure OpenAI API
// Modèle : gpt-5-mini
// Endpoint : https://axilimopenai.cognitiveservices.azure.com

function extractUserQueryFromMessage(raw) {
    const text = String(raw || '');
    const markers = ['Question utilisateur:', 'Utilisateur:'];
    let bestIdx = -1;
    let bestMarker = '';
    for (const marker of markers) {
        const idx = text.lastIndexOf(marker);
        if (idx > bestIdx) {
            bestIdx = idx;
            bestMarker = marker;
        }
    }
    if (bestIdx >= 0) return text.slice(bestIdx + bestMarker.length).trim();
    return text.trim();
}

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
        const userQuery = extractUserQueryFromMessage(userMessage);

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
        const { buildSystemPromptForAgent } = require('../utils/agentRegistry');

        const isSmallTalkForWesh = (q) => {
            const s0 = String(q || '').toLowerCase().replace(/[’]/g, "'").trim();
            if (!s0) return false;
            const s = s0
                .replace(/[^a-z0-9à-ÿ\s'_-]/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (/^(bonjour|salut|coucou|hello|hey|yo|bonsoir|bonne\s+nuit|merci|merci\s+beaucoup|ok|d\s*accord|ça\s+marche|ca\s+marche|super|cool)\b/i.test(s)) return true;
            if (/(comment\s+ça\s+va|comment\s+ca\s+va|ça\s+va\s*\?|ca\s+va\s*\?|tu\s+vas\s+bien)/i.test(s)) return true;
            if (/(quel\s+est\s+ton\s+nom|tu\s+t'appelles\s+comment|qui\s+es\s*-?\s*tu|tu\s+es\s+qui)/i.test(s)) return true;
            return false;
        };

        // (Optionnel) RAG - Recherche Brave pour le mode web-search
        let contextFromSearch = '';
        if ((chatType === 'web-search' || chatType === 'rnd-web-search') && !isSmallTalkForWesh(userQuery)) {
            try {
                const braveKey = process.env.APPSETTING_BRAVE_API_KEY || process.env.BRAVE_API_KEY;
                if (braveKey) {
                    const q = encodeURIComponent(userQuery);
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
                            const { buildWebEvidenceContext } = require('../utils/webEvidence');
                            contextFromSearch = await buildWebEvidenceContext({
                                question: userQuery,
                                searchResults: results.map(it => ({
                                    title: it.title,
                                    description: it.description,
                                    url: it.url
                                })),
                                timeoutMs: 7000,
                                maxSources: 3
                            });
                        }
                    }
                }
            } catch (_) {}

            // Sources additionnelles (Wesh): Wikipedia + Semantic Scholar + NewsAPI (preuves)
            try {
                const { appendEvidenceContext, searchWikipedia, searchNewsApi, searchSemanticScholar } = require('../utils/sourceProviders');
                const isGreeting = /^(\s)*(bonjour|salut|hello|hi|coucou|bonsoir|ça va|cv)(\s|!|\?|\.|,)*$/i.test(String(userQuery || ''));

                const wikiEnabled = String(process.env.WESH_WIKIPEDIA_ENABLED ?? 'true').toLowerCase() !== 'false';
                const semanticEnabled = String(process.env.WESH_SEMANTIC_SCHOLAR_ENABLED ?? 'true').toLowerCase() !== 'false';
                const newsEnabled = String(process.env.WESH_NEWSAPI_ENABLED ?? 'true').toLowerCase() !== 'false';

                const newsApiKey = process.env.APPSETTING_NEWSAPI_KEY || process.env.NEWSAPI_KEY;
                const semanticKey = process.env.APPSETTING_SEMANTIC_SCHOLAR_API_KEY || process.env.SEMANTIC_SCHOLAR_API_KEY;

                const wikiLimit = Math.max(0, Math.min(5, Number(process.env.WESH_WIKIPEDIA_MAX ?? 2) || 2));
                const semanticLimit = Math.max(0, Math.min(5, Number(process.env.WESH_SEMANTIC_SCHOLAR_MAX ?? 2) || 2));
                const newsLimit = Math.max(0, Math.min(5, Number(process.env.WESH_NEWSAPI_MAX ?? 3) || 3));

                if (!isGreeting) {
                    const wiki = (wikiEnabled && wikiLimit > 0)
                        ? await searchWikipedia(userQuery, { lang: 'fr', limit: wikiLimit, timeoutMs: 5000 })
                        : [];

                    const semantic = (semanticEnabled && semanticLimit > 0)
                        ? await searchSemanticScholar(userQuery, { apiKey: semanticKey, limit: semanticLimit, timeoutMs: 5000 })
                        : [];

                    const news = (newsEnabled && newsApiKey && newsLimit > 0)
                        ? await searchNewsApi(userQuery, { apiKey: newsApiKey, language: 'fr', pageSize: newsLimit, timeoutMs: 5000 })
                        : [];

                    contextFromSearch = appendEvidenceContext(contextFromSearch, [...wiki, ...semantic, ...news]);
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

Réponds en français, clairement et professionnellement.`
                    : (chatType === 'hr-management')
                        ? `Tu es Agent RH, un assistant RH.

Tu aides sur: politique RH, congés, paie (conceptuellement), recrutement, onboarding, performance, documents.

Règles:

Réponds en français, clair et actionnable.`
                        : (chatType === 'marketing-agent')
                            ? `Tu es Agent Marketing.

Tu aides sur: positionnement, contenu, SEO, ads, emails, funnels, analytics, go-to-market.

Réponds en français, clair et orienté résultats.`
                            : (chatType === 'web-search' || chatType === 'rnd-web-search')
                                ? buildSystemPromptForAgent('web-search', contextFromSearch)
                                : (chatType === 'excel-expert' || chatType === 'excel-ai-expert')
                                    ? `Tu es Agent Excel.

Tu aides sur formules, TCD, Power Query, nettoyage et bonnes pratiques.

Réponds en français, pédagogique et précis.`
                                    : (chatType === 'agent-todo')
                                        ? `Tu es Agent ToDo (gestion de tâches).

Objectif: clarifier un objectif, découper en tâches, prioriser, et proposer un plan.

Règles:

Réponds en français, concret.`
                                        : (chatType === 'agent-alex')
                                            ? `Tu es Agent Alex (assistant stratégie/produit SaaS).

Règles:

Réponds en français, clair et structuré.`
                                            : (chatType === 'agent-tony')
                                                ? `Tu es Agent Tony (assistant vente/ops SaaS).

Règles:

Réponds en français, direct et actionnable.`
                    : `Tu es Axilum AI, un assistant intelligent et serviable.

Réponds de manière claire, précise et professionnelle en français.`
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

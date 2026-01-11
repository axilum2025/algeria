// 🆓 PLAN GRATUIT - Llama 3.3 via Groq (100% Gratuit) + RAG
// Groq API : https://groq.com
// Modèle : llama-3.3-70b-versatile (70B paramètres)
// Coût : $0 (30 req/min gratuit)
// Vitesse : 500+ tokens/sec (ultra-rapide)

const { analyzeHallucination } = require('../utils/hallucinationDetector');
const { buildSystemPromptForAgent, normalizeAgentId } = require('../utils/agentRegistry');
const { orchestrateMultiAgents, callGroqChatCompletion } = require('../utils/orchestrator');
const { buildWebEvidenceContext } = require('../utils/webEvidence');
const { appendEvidenceContext, searchWikipedia, searchNewsApi, searchSemanticScholar } = require('../utils/sourceProviders');
const { shouldUseInternalBoost, buildAxilumInternalBoostContext } = require('../utils/axilumInternalBoost');
const { looksTimeSensitiveForHR, looksTimeSensitiveForMarketing, looksTimeSensitiveForDev, looksTimeSensitiveForExcel, looksTimeSensitiveForAlex, looksTimeSensitiveForTony, looksTimeSensitiveForTodo, looksTimeSensitiveForAIManagement, buildSilentWebContext } = require('../utils/silentWebRefresh');
const { getLangFromReq, getSearchLang, normalizeLang, detectLangFromText, detectLangFromTextDetailed, isLowSignalMessage, getConversationFocusInstruction, isAffirmation, isNegation, looksLikeQuestion, getYesNoDisambiguationInstruction, looksLikeMoreInfoRequest, getMoreInfoInstruction } = require('../utils/lang');

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

function userExplicitlyAsksForReliabilityMetrics(q) {
    const s = String(q || '').toLowerCase().replace(/[’]/g, "'");
    return /(m[ée]triques?\s+de\s+fiabilit[ée]|indice\s+d'?hallucination|hallucination\s+detector|\bhi\b|\bchr\b)/i.test(s);
}

function stripReliabilityFooter(text) {
    const s = String(text || '');
    return s
        .replace(/\n*\s*---\s*\n\s*📊\s*\*\*M[ée]triques\s+de\s+Fiabilit[ée]\*\*[\s\S]*$/m, '')
        .replace(/\n*\s*📊\s*\*\*M[ée]triques\s+de\s+Fiabilit[ée]\*\*[\s\S]*$/m, '')
        .trim();
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
        const userQuery = extractUserQueryFromMessage(userMessage);
        const requestedModel = req.body?.model || req.body?.aiModel || null;
        const explicitLang = req.body?.lang || req.body?.language || req.body?.locale || req.query?.lang;
        const hintedLang = explicitLang ? normalizeLang(explicitLang) : getLangFromReq(req, { fallback: 'fr' });

        const conversationHistoryForLang = req.body.history || [];
        const firstUserFromHistory = Array.isArray(conversationHistoryForLang)
            ? conversationHistoryForLang.find(m => m && (m.type === 'user' || m.role === 'user') && typeof m.content === 'string' && m.content.trim())
            : null;
        const firstText = String(firstUserFromHistory?.content || '').trim();
        const baseText = firstText.length >= 6 ? firstText : userQuery;

        const detected = detectLangFromTextDetailed(baseText, { fallback: hintedLang });
        const lang = (detected.confidence === 'high' && detected.lang && detected.lang !== hintedLang)
            ? detected.lang
            : (detected.lang || hintedLang);
        const searchLang = getSearchLang(lang);
        const conversationHistoryForYesNo = req.body.history || [];
        const lastAssistantFromHistory = Array.isArray(conversationHistoryForYesNo)
            ? [...conversationHistoryForYesNo].reverse().find(m => m && (m.type === 'bot' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
            : null;
        const lastAssistantText = String(lastAssistantFromHistory?.content || '').trim();
        const isYesNo = isAffirmation(userQuery) || isNegation(userQuery);
        const yesNoLine = (isYesNo && looksLikeQuestion(lastAssistantText)) ? getYesNoDisambiguationInstruction(lang) : '';
        const moreInfoLine = looksLikeMoreInfoRequest(userQuery) ? getMoreInfoInstruction(lang) : '';

        const focusLine = isLowSignalMessage(userQuery)
            ? [getConversationFocusInstruction(lang), yesNoLine, moreInfoLine].filter(Boolean).join('\n')
            : [yesNoLine, moreInfoLine].filter(Boolean).join('\n');

        const userAsksForSourcesForWesh = (q) => {
            const s = String(q || '').toLowerCase().replace(/[’]/g, "'").trim();
            return /(\bsources?\b|\br[ée]f[ée]rences?\b|\bcitations?\b|\bciter\b|\bpreuve(s)?\b|\bjustifie\b|\bjustification\b|\bliens?\b|\burl\b|\barticles?\b|\brecherche\b|\btrouve\b|\btrouver\b)/i.test(s);
        };

        const isSmallTalkForWesh = (q) => {
            const s0 = String(q || '').toLowerCase().replace(/[’]/g, "'").trim();
            if (!s0) return false;
            const s = s0
                .replace(/[^a-z0-9à-ÿ\s'_-]/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (/^(bonjour|salut|coucou|hello|hey|yo|bonsoir|bonne\s+nuit|merci|merci\s+beaucoup|ok|d\s*accord|ça\s+marche|ca\s+marche|super|cool)\b/i.test(s)) return true;
            if (/^(au\s+revoir|a\s+plus|à\s+plus|a\+|bye|ciao|à\s+bient[oô]t|a\s+bient[oô]t|à\s+demain|a\s+demain|à\s+tout\s+à\s+l'heure|a\s+tout\s+à\s+l'heure|à\s+tout\s+de\s+suite|a\s+tout\s+de\s+suite|bonne\s+journ[ée]e|bonne\s+soir[ée]e|bon\s+week-?end)\b/i.test(s)) return true;
            if (/(comment\s+ça\s+va|comment\s+ca\s+va|ça\s+va\s*\?|ca\s+va\s*\?|tu\s+vas\s+bien)/i.test(s)) return true;
            if (/(quel\s+est\s+ton\s+nom|tu\s+t'appelles\s+comment|qui\s+es\s*-?\s*tu|tu\s+es\s+qui)/i.test(s)) return true;
            return false;
        };

        const isQuestionnaireForWesh = (q) => {
            const s0 = String(q || '').toLowerCase().replace(/[’]/g, "'").trim();
            if (!s0) return false;
            const s = s0.replace(/\s+/g, ' ').trim();
            if (/\b(questionnaire|interview|sondage)\b/i.test(s)) return true;
            if (/(pose(-|\s)?moi\s+des\s+questions|pose\s+des\s+questions|je\s+vais\s+te\s+poser\s+des\s+questions)/i.test(s)) return true;
            const qm = (s.match(/\?/g) || []).length;
            if (qm >= 2) return true;
            if (/(^|\n)\s*\d{1,2}\s*[\)\.-]\s+/.test(String(q || ''))) return true;
            return false;
        };

        if (!userMessage) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { error: "Message is required" }
            };
            return;
        }

        const startTime = Date.now();
        const userIdForBilling = req.body?.userId || req.query?.userId || 'guest';
        
        // Groq API configuration
        const groqApiKey = process.env.GROQ_API_KEY;
        
        if (!groqApiKey) {
            context.log.error('⚠️ GROQ_API_KEY not configured - using simple fallback');
            
            // Réponses prédéfinies pour les cas communs
            const lowerMessage = userQuery.toLowerCase();
            const isEnglish = normalizeLang(lang) === 'en';

            let fallbackResponse = isEnglish ? "Hello! I'm Axilum AI." : "Bonjour ! Je suis Axilum AI.";

            if (lowerMessage.includes('bonjour') || lowerMessage.includes('salut') || lowerMessage.includes('hello')) {
                fallbackResponse = isEnglish
                    ? "Hello! I'm Axilum AI, your smart assistant. How can I help you today?"
                    : "Bonjour ! Je suis Axilum AI, votre assistant intelligent. Comment puis-je vous aider aujourd'hui ?";
            } else if (lowerMessage.includes('qui es-tu') || lowerMessage.includes('présente') || lowerMessage.includes('qui es tu') || lowerMessage.includes('who are you')) {
                fallbackResponse = isEnglish
                    ? "I'm Axilum AI, an intelligent conversational assistant powered by Llama 3.3 70B."
                    : "Je suis Axilum AI, un assistant conversationnel intelligent propulsé par Llama 3.3 70B.";
            } else if (lowerMessage.includes('aide') || lowerMessage.includes('help')) {
                fallbackResponse = isEnglish
                    ? "I can help with many questions. To enable full capabilities, an admin must configure the Groq API key. In the meantime, feel free to ask anything!"
                    : "Je peux vous aider avec diverses questions ! Pour activer toutes mes capacités, l'administrateur doit configurer la clé API Groq. En attendant, n'hésitez pas à poser vos questions !";
            } else {
                fallbackResponse = isEnglish
                    ? `Your question: "${userQuery}"\n\nI'm currently in limited configuration mode. To fully enable the free plan, please configure GROQ_API_KEY in Azure.\n\nIn the meantime, try the PRO plan for a full experience!`
                    : `Votre question : "${userQuery}"\n\nJe suis actuellement en mode configuration limitée. Pour profiter pleinement du mode gratuit, veuillez configurer GROQ_API_KEY dans Azure.\n\nEn attendant, essayez le mode PRO pour une expérience complète !`;
            }
            
            if (focusLine) fallbackResponse = `${fallbackResponse}\n\n${focusLine}`;

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
                    metricsSource: 'none',
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
        const isHRChat = (normalizeAgentId(chatType) || String(chatType || '').trim()) === 'hr-management';
        const hrSilentWebRefreshEnabled = isHRChat && String(process.env.HR_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const hrNeedsFreshInfo = isHRChat && looksTimeSensitiveForHR(userQuery);
        const isMarketingChat = (normalizeAgentId(chatType) || String(chatType || '').trim()) === 'marketing-agent';
        const marketingSilentWebRefreshEnabled = isMarketingChat && String(process.env.MARKETING_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const marketingNeedsFreshInfo = isMarketingChat && looksTimeSensitiveForMarketing(userQuery);
        const isDevChat = (normalizeAgentId(chatType) || String(chatType || '').trim()) === 'agent-dev';
        const devSilentWebRefreshEnabled = isDevChat && String(process.env.DEV_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const devNeedsFreshInfo = isDevChat && looksTimeSensitiveForDev(userQuery);
        const isExcelChat = (normalizeAgentId(chatType) || String(chatType || '').trim()) === 'excel-expert';
        const excelSilentWebRefreshEnabled = isExcelChat && String(process.env.EXCEL_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const excelNeedsFreshInfo = isExcelChat && looksTimeSensitiveForExcel(userQuery);
        const isAlexChat = (normalizeAgentId(chatType) || String(chatType || '').trim()) === 'agent-alex';
        const alexSilentWebRefreshEnabled = isAlexChat && String(process.env.ALEX_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const alexNeedsFreshInfo = isAlexChat && looksTimeSensitiveForAlex(userQuery);
        const isTonyChat = (normalizeAgentId(chatType) || String(chatType || '').trim()) === 'agent-tony';
        const tonySilentWebRefreshEnabled = isTonyChat && String(process.env.TONY_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const tonyNeedsFreshInfo = isTonyChat && looksTimeSensitiveForTony(userQuery);
        const isTodoChat = (normalizeAgentId(chatType) || String(chatType || '').trim()) === 'agent-todo';
        const todoSilentWebRefreshEnabled = isTodoChat && String(process.env.TODO_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const todoNeedsFreshInfo = isTodoChat && looksTimeSensitiveForTodo(userQuery);
        const isAIManagementChat = (normalizeAgentId(chatType) || String(chatType || '').trim()) === 'ai-management';
        const aiManagementSilentWebRefreshEnabled = isAIManagementChat && String(process.env.AI_MANAGEMENT_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const aiManagementNeedsFreshInfo = isAIManagementChat && looksTimeSensitiveForAIManagement(userQuery);
        const skipWebSearchBecauseConversation = forceWebSearch
            && !userAsksForSourcesForWesh(userQuery)
            && (isSmallTalkForWesh(userQuery) || isQuestionnaireForWesh(userQuery));

        // 🧩 ORCHESTRATEUR MULTI-AGENTS (sur demande) + mode AUTO (planner)
        if (isOrchestrator) {
            const braveKey = process.env.APPSETTING_BRAVE_API_KEY || process.env.BRAVE_API_KEY;
            const teamQuestion = String(req.body.teamQuestion || userQuery || '').trim();

            const orchestrated = await orchestrateMultiAgents({
                groqKey: groqApiKey,
                teamQuestion,
                teamAgentsRaw: req.body.teamAgents,
                recentHistory,
                braveKey,
                searchBrave,
                analyzeHallucination,
                logger: context.log,
                model: requestedModel,
                userId: (req.body?.userId || req.query?.userId || 'guest'),
                lang
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
                    metricsSource: (String(orchestrated.hallucination?.method || '').toLowerCase() === 'evidence') ? 'evidence' : 'detector',
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
            const braveKey = process.env.APPSETTING_BRAVE_API_KEY || process.env.BRAVE_API_KEY;
            // Si Brave n'est pas configuré, ne pas polluer le contexte: on continue sans recherche web.
            if (braveKey && !skipWebSearchBecauseConversation) {
                const searchResults = await searchBrave(userQuery, braveKey);
                if (searchResults && searchResults.length > 0) {
                    if (forceWebSearch) {
                        contextFromSearch = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                    } else if (hrSilentWebRefreshEnabled && hrNeedsFreshInfo) {
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (marketingSilentWebRefreshEnabled && marketingNeedsFreshInfo) {
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (devSilentWebRefreshEnabled && devNeedsFreshInfo) {
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (excelSilentWebRefreshEnabled && excelNeedsFreshInfo) {
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (alexSilentWebRefreshEnabled && alexNeedsFreshInfo) {
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (tonySilentWebRefreshEnabled && tonyNeedsFreshInfo) {
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (todoSilentWebRefreshEnabled && todoNeedsFreshInfo) {
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (aiManagementSilentWebRefreshEnabled && aiManagementNeedsFreshInfo) {
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
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
        if (forceWebSearch && !skipWebSearchBecauseConversation) {
            try {
                const isGreeting = /^(\s)*(bonjour|salut|hello|hi|coucou|bonsoir|ça va|cv)(\s|!|\?|\.|,)*$/i.test(String(userQuery || ''));
                const wikiEnabled = String(process.env.WESH_WIKIPEDIA_ENABLED ?? 'true').toLowerCase() !== 'false';
                const newsEnabled = String(process.env.WESH_NEWSAPI_ENABLED ?? 'true').toLowerCase() !== 'false';
                const semanticEnabled = String(process.env.WESH_SEMANTIC_SCHOLAR_ENABLED ?? 'true').toLowerCase() !== 'false';
                const newsApiKey = process.env.APPSETTING_NEWSAPI_KEY || process.env.NEWSAPI_KEY;
                const semanticKey = process.env.APPSETTING_SEMANTIC_SCHOLAR_API_KEY || process.env.SEMANTIC_SCHOLAR_API_KEY;

                const wikiLimit = Math.max(0, Math.min(5, Number(process.env.WESH_WIKIPEDIA_MAX ?? 2) || 2));
                const newsLimit = Math.max(0, Math.min(5, Number(process.env.WESH_NEWSAPI_MAX ?? 3) || 3));
                const semanticLimit = Math.max(0, Math.min(5, Number(process.env.WESH_SEMANTIC_SCHOLAR_MAX ?? 2) || 2));

                if (!isGreeting) {
                    const wiki = (wikiEnabled && wikiLimit > 0)
                        ? await searchWikipedia(userQuery, { lang: searchLang, limit: wikiLimit, timeoutMs: 5000 })
                        : [];

                    const news = (newsEnabled && newsApiKey && newsLimit > 0)
                        ? await searchNewsApi(userQuery, { apiKey: newsApiKey, language: searchLang, pageSize: newsLimit, timeoutMs: 5000 })
                        : [];

                    const semantic = (semanticEnabled && semanticLimit > 0)
                        ? await searchSemanticScholar(userQuery, { apiKey: semanticKey, limit: semanticLimit, timeoutMs: 5000 })
                        : [];

                    contextFromSearch = appendEvidenceContext(contextFromSearch, [...wiki, ...semantic, ...news]);
                }
            } catch (e) {
                context.log.warn('⚠️ Sources additionnelles Wesh indisponibles:', e?.message || e);
            }
        }

        // Construire les messages
        const normalizedChatType = String(chatType || '').trim();
        const agentId = normalizeAgentId(normalizedChatType) || normalizedChatType;

        let internalBoostContext = '';
        if (agentId === 'axilum' && shouldUseInternalBoost(userQuery, { userMessage })) {
            try {
                internalBoostContext = await buildAxilumInternalBoostContext({
                    groqKey: groqApiKey,
                    question: userQuery,
                    recentHistory,
                    logger: context.log,
                    userId: userIdForBilling,
                    model: requestedModel
                });
            } catch (e) {
                context.log.warn('⚠️ Boost interne indisponible (Axilum), continue sans:', e?.message || e);
                internalBoostContext = '';
            }
        }

        const contextWithBoost = `${contextFromSearch || ''}${internalBoostContext || ''}`;
        const messages = [
            {
                role: "system",
                content: buildSystemPromptForAgent(agentId, contextWithBoost, { lang })
            }
        ];

        // Ajouter l'historique
        recentHistory.forEach(msg => {
            if (msg.type === 'user' && msg.content) {
                messages.push({ role: "user", content: msg.content });
            } else if (msg.type === 'bot' && msg.content) {
                const cleanContent = msg.content
                    .replace(/(^|\n)\s*---\s*\n(?=\s*(📊|📚|💡|Sources\s*:))[\s\S]*/m, '')
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
            data = await callGroqChatCompletion(groqApiKey, messages, { max_tokens: 2000, temperature: 0.7, userId: userIdForBilling, model: requestedModel });
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
                    metricsSource: 'none',
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
            hallucinationAnalysis = await analyzeHallucination(aiResponse, userMessage, null, { userId: userIdForBilling });
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
        const isGreeting = /^(\s)*(bonjour|salut|hello|hi|coucou|bonsoir|ça va|cv)(\s|!|\?|\.|,)*$/i.test(String(userQuery || ''));
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
                    { role: 'system', content: buildSystemPromptForAgent('web-search', contextFromSearch, { lang }) },
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
                    { role: 'user', content: `Question: ${userQuery}\n\nRéponse initiale à corriger:\n${aiResponse}` }
                ];

                const correctedData = await callGroqChatCompletion(groqApiKey, correctionMessages, { max_tokens: 2500, temperature: 0.2, userId: userIdForBilling, model: requestedModel });
                autoCorrectionUsage = correctedData?.usage || null;
                const corrected = correctedData?.choices?.[0]?.message?.content;
                if (typeof corrected === 'string' && corrected.trim()) {
                    finalAiResponse = corrected.trim();
                    autoCorrectionApplied = true;
                    try {
                        hallucinationAnalysis = await analyzeHallucination(finalAiResponse, userMessage, null, { userId: userIdForBilling });
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

        const wantsReliabilityMetrics = userExplicitlyAsksForReliabilityMetrics(userQuery);
        const includeReliabilityFooter = !isDevChat || wantsReliabilityMetrics;
        const cleanedAnswer = includeReliabilityFooter ? String(finalAiResponse || '').trim() : stripReliabilityFooter(finalAiResponse);
        const finalResponse = includeReliabilityFooter ? (cleanedAnswer + metricsText) : cleanedAnswer;

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
                metricsSource: (String(hallucinationAnalysis.method || '').toLowerCase() === 'evidence') ? 'evidence' : 'detector',
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
                metricsSource: 'none',
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

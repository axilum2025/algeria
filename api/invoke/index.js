// 💎 PLAN PRO - Llama 3.3 70B via Groq + Fonctions Azure + RAG

const { analyzeHallucination } = require('../utils/hallucinationDetector');
const { buildSystemPromptForAgent, normalizeAgentId } = require('../utils/agentRegistry');
const { orchestrateMultiAgents, callGroqChatCompletion } = require('../utils/orchestrator');
const { getAuthEmail } = require('../utils/auth');
const { shouldUseInternalBoost, buildAxilumInternalBoostContext } = require('../utils/axilumInternalBoost');
const { detectFunctions, orchestrateFunctions, summarizeResults } = require('../utils/functionRouter');
const { buildWebEvidenceContext } = require('../utils/webEvidence');
const { appendEvidenceContext, searchWikipedia, searchNewsApi, searchSemanticScholar } = require('../utils/sourceProviders');
const { looksTimeSensitiveForHR, looksTimeSensitiveForMarketing, looksTimeSensitiveForDev, looksTimeSensitiveForExcel, looksTimeSensitiveForAlex, looksTimeSensitiveForTony, looksTimeSensitiveForTodo, looksTimeSensitiveForAIManagement, buildSilentWebContext } = require('../utils/silentWebRefresh');
const { getLangFromReq, getSearchLang, getResponseLanguageInstruction, normalizeLang, detectLangFromText } = require('../utils/lang');
const { stripModelReasoning } = require('../utils/stripModelReasoning');

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
    // Le frontend envoie souvent "...\n\nUtilisateur: <message>" (avec beaucoup de contexte avant)
    const markers = ['Question utilisateur:', 'Utilisateur:'];
    let bestIdx = -1;
    let bestMarker = '';
    for (const m of markers) {
        const idx = text.lastIndexOf(m);
        if (idx > bestIdx) {
            bestIdx = idx;
            bestMarker = m;
        }
    }
    if (bestIdx >= 0) {
        return text.slice(bestIdx + bestMarker.length).trim();
    }
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


module.exports = async function (context, req) {
    // ✨ Détection V2 via query parameter ou body
    const useV2 = req.query?.useV2 === 'true' || req.body?.useV2 === true;
    
    if (useV2) {
        context.log('🚀 V2 ARCHITECTURE - Scalable invoke');
        // Importer et exécuter la logique V2
        const invokeV2 = require('../invoke-v2/index.js');
        return await invokeV2(context, req);
    }
    
    context.log('💎 PRO PLAN - Llama 3.3 70B Request (Groq + Azure Functions + RAG)');

    if (req.method === 'OPTIONS') {
        context.res = { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } };
        return;
    }

    try {
        const userMessage = req.body.message;
        const userQuery = extractUserQueryFromMessage(userMessage);
        const requestedModel = req.body?.model || req.body?.aiModel || null;
        const explicitLang = req.body?.lang || req.body?.language || req.body?.locale || req.query?.lang || req.headers?.['x-language'] || req.headers?.['x-lang'];
        const fallbackLang = getLangFromReq(req, { fallback: 'fr' });
        const lang = explicitLang ? normalizeLang(explicitLang) : detectLangFromText(userQuery, { fallback: fallbackLang });
        const searchLang = getSearchLang(lang);
        const defaultToneLine = getResponseLanguageInstruction(lang, { tone: 'de manière naturelle, claire et professionnelle' });

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
            context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: "Message is required" } };
            return;
        }

        const startTime = Date.now();
        const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
        const userIdForBilling = getAuthEmail(req) || req.body?.userId || req.query?.userId || 'guest';
        
        if (!groqKey) {
            context.res = { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: { error: "Groq API Key not configured", responseTime: `${Date.now() - startTime}ms` } };
            return;
        }

        const conversationHistory = req.body.history || [];
        const recentHistory = conversationHistory.slice(-20);

        // RAG - Recherche Brave (optionnelle, ou forcée selon l'agent)
        let contextFromSearch = '';
        let sourcesForClient = [];
        const rawChatType = req.body.chatType || req.body.conversationId;
        const chatType = normalizeAgentId(rawChatType) || rawChatType;
        const isOrchestrator = chatType === 'orchestrator';
        const forceWebSearch = chatType === 'web-search' || chatType === 'rnd-web-search';
        const isHRChat = chatType === 'hr-management';
        const hrSilentWebRefreshEnabled = isHRChat && String(process.env.HR_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const hrNeedsFreshInfo = isHRChat && looksTimeSensitiveForHR(userQuery);
        const isMarketingChat = chatType === 'marketing-agent';
        const marketingSilentWebRefreshEnabled = isMarketingChat && String(process.env.MARKETING_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const marketingNeedsFreshInfo = isMarketingChat && looksTimeSensitiveForMarketing(userQuery);
        const isDevChat = chatType === 'agent-dev';
        const devSilentWebRefreshEnabled = isDevChat && String(process.env.DEV_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const devNeedsFreshInfo = isDevChat && looksTimeSensitiveForDev(userQuery);
        const isExcelChat = chatType === 'excel-expert';
        const excelSilentWebRefreshEnabled = isExcelChat && String(process.env.EXCEL_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const excelNeedsFreshInfo = isExcelChat && looksTimeSensitiveForExcel(userQuery);
        const isAlexChat = chatType === 'agent-alex';
        const alexSilentWebRefreshEnabled = isAlexChat && String(process.env.ALEX_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const alexNeedsFreshInfo = isAlexChat && looksTimeSensitiveForAlex(userQuery);
        const isTonyChat = chatType === 'agent-tony';
        const tonySilentWebRefreshEnabled = isTonyChat && String(process.env.TONY_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const tonyNeedsFreshInfo = isTonyChat && looksTimeSensitiveForTony(userQuery);
        const isTodoChat = chatType === 'agent-todo';
        const todoSilentWebRefreshEnabled = isTodoChat && String(process.env.TODO_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const todoNeedsFreshInfo = isTodoChat && looksTimeSensitiveForTodo(userQuery);
        const isAIManagementChat = chatType === 'ai-management';
        const aiManagementSilentWebRefreshEnabled = isAIManagementChat && String(process.env.AI_MANAGEMENT_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const aiManagementNeedsFreshInfo = isAIManagementChat && looksTimeSensitiveForAIManagement(userQuery);
        const skipWebSearchBecauseConversation = forceWebSearch
            && !userAsksForSourcesForWesh(userQuery)
            && (isSmallTalkForWesh(userQuery) || isQuestionnaireForWesh(userQuery));

        // 🧩 ORCHESTRATEUR MULTI-AGENTS (sur demande)
        if (isOrchestrator) {
            const braveKey = process.env.APPSETTING_BRAVE_API_KEY || process.env.BRAVE_API_KEY;
            const teamQuestion = String(req.body.teamQuestion || userMessage || '').trim();

            // 1) ⚙️ ORCHESTRATION OUTILS (automatique) - exécute les fonctions détectées
            let toolResults = [];
            let toolsContext = '';
            try {
                const neededTools = detectFunctions(teamQuestion);
                if (neededTools.length > 0) {
                    context.log('⚙️ Outils détectés (orchestrator):', neededTools);
                    toolResults = await orchestrateFunctions(neededTools, teamQuestion, { requestBody: req.body || {} });
                    context.log('✅ Outils exécutés:', summarizeResults(toolResults));

                    toolsContext = toolResults.map(r => {
                        const status = r.success ? 'success' : 'failed';
                        let rendered;
                        try {
                            rendered = typeof r.result === 'string' ? r.result : JSON.stringify(r.result);
                        } catch (_) {
                            rendered = String(r.result);
                        }
                        if (rendered && rendered.length > 1200) rendered = rendered.slice(0, 1200) + '...[tronqué]';
                        const err = r.error ? `\nErreur: ${String(r.error).slice(0, 300)}` : '';
                        return `- [${r.function}] ${status}${r.cached ? ' (cached)' : ''}: ${rendered || ''}${err}`;
                    }).join('\n');
                }
            } catch (toolErr) {
                context.log.warn('⚠️ Orchestration outils échouée, continue sans:', toolErr?.message || toolErr);
            }

            const orchestrated = await orchestrateMultiAgents({
                groqKey,
                teamQuestion,
                teamAgentsRaw: req.body.teamAgents,
                recentHistory,
                braveKey,
                searchBrave,
                toolsContext,
                analyzeHallucination,
                logger: context.log,
                userId: (getAuthEmail(req) || req.body?.userId || req.query?.userId || 'guest'),
                model: requestedModel,
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
                    proPlan: true,
                    model: 'llama-3.3-70b',
                    provider: 'Groq',
                    tokensUsed: orchestrated.tokensUsed || 0,
                    advancedFeatures: true,
                    orchestrator: true,
                    orchestratorAgents: orchestrated.orchestratorAgents || [],
                    toolsUsed: toolResults.length,
                    toolsSummary: toolResults.length ? summarizeResults(toolResults) : null,
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

                        // Exposer au client les liens Brave en mode Wesh (preuves visibles)
                        sourcesForClient = sourcesForClient.concat(searchResults.map((r) => ({
                            title: r.title || 'Résultat web',
                            url: r.url || '',
                            snippet: r.description || ''
                        })).filter(s => s.url));

                        // Ajoute également les résultats Brave comme preuves [S#] (sinon fallback sans sources)
                        const braveEvidence = searchResults.map((r) => ({
                            title: r.title,
                            url: r.url,
                            snippet: r.description,
                            extracts: r.description ? [r.description] : []
                        }));
                        contextFromSearch = appendEvidenceContext(contextFromSearch, braveEvidence);
                    } else if (hrSilentWebRefreshEnabled && hrNeedsFreshInfo) {
                        // 🔒 Enrichissement silencieux (Agent RH): on récupère des extraits, mais on retire URLs/citations.
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (marketingSilentWebRefreshEnabled && marketingNeedsFreshInfo) {
                        // 🔒 Enrichissement silencieux (Agent Marketing): web à jour sans exposer liens/sources.
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (devSilentWebRefreshEnabled && devNeedsFreshInfo) {
                        // 🔒 Enrichissement silencieux (Agent Dev): web à jour sans exposer liens/sources.
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (excelSilentWebRefreshEnabled && excelNeedsFreshInfo) {
                        // 🔒 Enrichissement silencieux (Agent Excel): web à jour sans exposer liens/sources.
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (alexSilentWebRefreshEnabled && alexNeedsFreshInfo) {
                        // 🔒 Enrichissement silencieux (Agent Alex): web à jour sans exposer liens/sources.
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (tonySilentWebRefreshEnabled && tonyNeedsFreshInfo) {
                        // 🔒 Enrichissement silencieux (Agent Tony): web à jour sans exposer liens/sources.
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (todoSilentWebRefreshEnabled && todoNeedsFreshInfo) {
                        // 🔒 Enrichissement silencieux (Agent ToDo): web à jour sans exposer liens/sources.
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else if (aiManagementSilentWebRefreshEnabled && aiManagementNeedsFreshInfo) {
                        // 🔒 Enrichissement silencieux (AI Management): web à jour sans exposer liens/sources.
                        const evidence = await buildWebEvidenceContext({
                            question: userQuery,
                            searchResults,
                            timeoutMs: 7000,
                            maxSources: 3
                        });
                        contextFromSearch = buildSilentWebContext(evidence);
                    } else {
                        // Exposer au client les liens Brave (utile si UI affiche des sources)
                        sourcesForClient = sourcesForClient.concat(searchResults.map((r) => ({
                            title: r.title || 'Résultat web',
                            url: r.url || '',
                            snippet: r.description || ''
                        })).filter(s => s.url));

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

                    const evidenceSources = [...wiki, ...semantic, ...news];
                    contextFromSearch = appendEvidenceContext(contextFromSearch, evidenceSources);
                    // Exposer au client les vraies sources de preuves (titre + URL)
                    sourcesForClient = sourcesForClient.concat(evidenceSources.map((s) => ({
                        title: s.title || 'Source',
                        url: s.url || '',
                        snippet: s.snippet || ''
                    })).filter(s => s.url));
                }
            } catch (e) {
                context.log.warn('⚠️ Sources additionnelles Wesh indisponibles:', e?.message || e);
            }
        }

        // Détecter le type de chat
        const isAIManagement = chatType === 'ai-management';
        const isAgentDev = chatType === 'agent-dev';
        const isHR = chatType === 'hr-management';
        const isMarketing = chatType === 'marketing-agent';
        const isWebSearch = chatType === 'web-search' || chatType === 'rnd-web-search';
        const isExcel = chatType === 'excel-expert' || chatType === 'excel-ai-expert';
        const isTodo = chatType === 'agent-todo';
        const isAlex = chatType === 'agent-alex';
        const isTony = chatType === 'agent-tony';

        const isAxilum = !isAIManagement && !isAgentDev && !isHR && !isMarketing && !isWebSearch && !isExcel && !isTodo && !isAlex && !isTony;

        let internalBoostContext = '';
        if (isAxilum && shouldUseInternalBoost(userQuery, { userMessage })) {
            try {
                internalBoostContext = await buildAxilumInternalBoostContext({
                    groqKey,
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
        
        const messages = [{
            role: "system",
            content: isAIManagement ? 
            // 🎯 PROMPT AI MANAGEMENT (4 expertises)
            `Tu es AI Management, un assistant professionnel spécialisé dans 4 domaines d'expertise :

📊 **Excel AI Expert**
- Analyse avancée de fichiers Excel et données structurées
- Création et audit de formules modernes (INDEX, MATCH, XLOOKUP, etc.)
- Détection d'erreurs et optimisation de classeurs
- Génération de rapports et tableaux de bord

**COMMANDES EXCEL JSON** :
Quand l'utilisateur demande une modification de son fichier Excel, tu peux générer automatiquement des commandes JSON pour les exécuter directement. Ajoute un bloc \`\`\`json avec la commande appropriée à la fin de ta réponse.

Exemples de commandes :

1. **Ajouter une colonne** :
\`\`\`json
{"action": "addColumn", "name": "Prix TTC", "defaultValue": ""}
\`\`\`

2. **Calculer une colonne** (avec formule) :
\`\`\`json
{"action": "calculateColumn", "name": "Prix TTC", "formula": "Prix * 1.2"}
\`\`\`

3. **Ajouter une ligne** :
\`\`\`json
{"action": "addRow", "values": ["Produit X", "100", "Paris"]}
\`\`\`

4. **Supprimer une colonne** :
\`\`\`json
{"action": "deleteColumn", "index": 2}
\`\`\`
ou
\`\`\`json
{"action": "deleteColumn", "name": "Ancienne_Colonne"}
\`\`\`

5. **Supprimer une ligne** :
\`\`\`json
{"action": "deleteRow", "index": 5}
\`\`\`

6. **Modifier une cellule** :
\`\`\`json
{"action": "updateCell", "row": 2, "column": 3, "value": "Nouveau"}
\`\`\`
ou
\`\`\`json
{"action": "updateCell", "row": 2, "columnName": "Prix", "value": "150"}
\`\`\`

7. **Renommer une colonne** :
\`\`\`json
{"action": "renameColumn", "oldName": "Nom", "newName": "Nom_Client"}
\`\`\`

8. **Trier les données** :
\`\`\`json
{"action": "sortData", "columnName": "Prix", "order": "asc"}
\`\`\`
ou
\`\`\`json
{"action": "sortData", "column": 2, "order": "desc"}
\`\`\`

**Règles importantes** :
- N'ajoute le JSON que si l'utilisateur demande explicitement une modification
- Explique toujours ce que tu vas faire AVANT le bloc JSON
- Le JSON sera exécuté automatiquement
- Pour les formules (calculateColumn), utilise les noms de colonnes exacts du fichier
- Pour les index, commence à 0

📅 **Planning Projet**
- Création de diagrammes de Gantt et planification de projets
- Gestion des tâches, jalons et dépendances
- Allocation des ressources et suivi d'avancement
- Analyse de chemin critique et gestion des risques

💰 **Tableau de Bord Financier**
- Calcul et analyse de KPI financiers
- Création de ratios d'analyse (ROI, marge, liquidité)
- Génération de graphiques dynamiques et reporting automatisé
- Prévisions budgétaires et analyse de rentabilité

👥 **Gestion RH**
- Structuration de bases de données employés
- Gestion des congés, absences et planning
- Calcul de paie et gestion des avantages
- Évaluation des performances et suivi des formations

Principes de réponse:
✅ Identifie le domaine concerné et adapte ton expertise
✅ Propose des solutions concrètes et actionnables
✅ Utilise des exemples pratiques quand pertinent
✅ Cite des sources ou bonnes pratiques quand approprié
✅ Admets les limites : "je ne suis pas sûr", "cela dépend de", "il faudrait vérifier"
✅ Sois précis, professionnel et pédagogique
❌ Évite les affirmations absolues sans fondement
❌ N'invente pas de faits que tu ne peux pas vérifier

Réponds de manière naturelle, claire et professionnelle en français.
Réfléchis en interne, mais ne révèle jamais ton raisonnement.
Donne uniquement la réponse finale (pas de balises <think>/<analysis>).${contextFromSearch}`
            : isAgentDev ?
                        // 🧑‍💻 PROMPT AGENT DEV (développement)
                        buildSystemPromptForAgent('agent-dev', contextFromSearch, { lang })
            : isHR ?
            // 👥 PROMPT AGENT RH
            buildSystemPromptForAgent('hr-management', contextFromSearch, { lang })
            : isMarketing ?
            // 📣 PROMPT AGENT MARKETING
            buildSystemPromptForAgent('marketing-agent', contextFromSearch, { lang })
            : isWebSearch ?
            // 🌐 PROMPT AGENT WEB SEARCH (toujours Wesh, même sans [S#])
            buildSystemPromptForAgent('web-search', contextFromSearch, { lang })
            : isExcel ?
            // 📊 PROMPT AGENT EXCEL
            buildSystemPromptForAgent('excel-expert', contextFromSearch, { lang })
            : isTodo ?
            // ✅ PROMPT AGENT TODO
            buildSystemPromptForAgent('agent-todo', contextFromSearch, { lang })
            : isAlex ?
            // 🧭 PROMPT AGENT ALEX
            buildSystemPromptForAgent('agent-alex', contextFromSearch, { lang })
            : isTony ?
            // 🤝 PROMPT AGENT TONY
            buildSystemPromptForAgent('agent-tony', contextFromSearch, { lang })
                        : 
            // 🏠 PROMPT AXILUM AI (détection hallucinations)
            `Tu es Axilum AI, un assistant intelligent et serviable.

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
- Si l'utilisateur colle un bloc commençant par "🔎 Rapport Hallucination Detector" ou "🔎 Hallucination Detector Report" (ou te demande d'expliquer HI/CHR/claims), considère que c'est un rapport interne généré par l'application.
- Dans ce cas, explique ce que signifient les sections (Score, HI, CHR, Claims, Faits vérifiés, Points non confirmés, Sources recommandées) et donne des actions concrètes pour vérifier.
- Ne dis pas que ce rapport "n'existe pas" ou "n'est pas mentionné" : traite-le comme un artefact du système.

${defaultToneLine}
Réfléchis en interne, mais ne révèle jamais ton raisonnement.
Donne uniquement la réponse finale (pas de balises <think>/<analysis>).
Ne mentionne pas tes capacités ou fonctionnalités à moins que l'utilisateur ne le demande explicitement.${contextFromSearch}${internalBoostContext}`
        }];

        recentHistory.forEach(msg => {
            if ((msg.type === 'user' || msg.role === 'user') && msg.content) {
                messages.push({ role: "user", content: msg.content });
            } else if ((msg.type === 'bot' || msg.role === 'assistant') && msg.content) {
                const cleanContent = msg.content.replace(/\n*---[\s\S]*/g, '').replace(/\n*💡.*\n*/gi, '').trim();
                if (cleanContent) messages.push({ role: "assistant", content: cleanContent });
            } else if ((msg.type === 'system' || msg.role === 'system') && msg.content) {
                // Messages système comme le contexte Excel
                messages.push({ role: "user", content: msg.content });
            }
        });

        messages.push({ role: "user", content: userMessage });

        let data;
        try {
            data = await callGroqChatCompletion(groqKey, messages, { max_tokens: 4000, temperature: 0.7, userId: userIdForBilling, model: requestedModel });
        } catch (e) {
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: e.message || String(e), details: e.details || null, responseTime: `${Date.now() - startTime}ms` }
            };
            return;
        }
        const aiResponseRaw = data.choices[0].message.content;
        const aiResponse = stripModelReasoning(aiResponseRaw) || '';
        const responseTime = Date.now() - startTime;

        // 🛡️ Analyse anti-hallucination avec modèles GRATUITS (Groq/Gemini)
        let hallucinationAnalysis;
        try {
            hallucinationAnalysis = await analyzeHallucination(aiResponse, userMessage, null, { userId: userIdForBilling });
        } catch (analysisError) {
            context.log.warn('⚠️ Hallucination analysis failed, using defaults:', analysisError.message);
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
        const isWesh = isWebSearch;
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
                    { role: 'user', content: `Question: ${userMessage}\n\nRéponse initiale à corriger:\n${aiResponse}` }
                ];

                const correctedData = await callGroqChatCompletion(groqKey, correctionMessages, { max_tokens: 2500, temperature: 0.2, userId: userIdForBilling, model: requestedModel });
                autoCorrectionUsage = correctedData?.usage || null;
                const correctedRaw = correctedData?.choices?.[0]?.message?.content;
                const corrected = stripModelReasoning(correctedRaw);
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
                context.log.warn('⚠️ Auto-correction Wesh échouée, réponse initiale conservée:', e?.message || e);
            }
        }
        
        // Convertir en pourcentage (0-1 → 0-100)
        const hiPercent = (hallucinationAnalysis.hi * 100).toFixed(1);
        const chrPercent = (hallucinationAnalysis.chr * 100).toFixed(1);
        
        // Formatter les métriques
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
        metricsText += `\n💡 *Plan Pro - ${tokensUsedTotal} tokens utilisés*`;

        const wantsReliabilityMetrics = userExplicitlyAsksForReliabilityMetrics(userQuery);
        const includeReliabilityFooter = !isDevChat || wantsReliabilityMetrics;
        const cleanedAnswer = includeReliabilityFooter ? String(finalAiResponse || '').trim() : stripReliabilityFooter(finalAiResponse);
        const finalResponse = includeReliabilityFooter ? (cleanedAnswer + metricsText) : cleanedAnswer;

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: {
                response: finalResponse,
                responseTime: `${responseTime}ms`,
                proPlan: true,
                model: 'llama-3.3-70b',
                provider: 'Groq',
                tokensUsed: tokensUsedTotal,
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                qualityScore: 95,
                advancedFeatures: true,
                autoCorrected: autoCorrectionApplied,
                autoCorrectThreshold: autoCorrectThreshold,
                hallucinationIndex: parseFloat(hiPercent),
                contextHistoryRatio: parseFloat(chrPercent),
                metricsSource: 'detector',
                hallucinationClaims: hallucinationAnalysis.claims || [],
                hallucinationCounts: hallucinationAnalysis.counts || {},
                hallucinationSources: hallucinationAnalysis.sources || [],
                hallucinationMethod: hallucinationAnalysis.method || 'unknown',
                // Sources exposées au frontend pour afficher l'encart RAG sans placeholders
                // Agent dev: ne pas exposer de sources (recherche silencieuse côté backend)
                sources: isDevChat ? [] : sourcesForClient
            }
        };
    } catch (error) {
        context.log.error('❌ Error:', error);
        context.res = { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: { error: error.message } };
    }
};

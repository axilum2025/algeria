// 💎 PLAN PRO - Version évolutive avec gestion avancée
// Supporte fonctions multiples sans risque de crash

const { analyzeHallucination } = require('../utils/hallucinationDetector');
const { buildContextForFunctions, buildCompactSystemPrompt } = require('../utils/contextManager');
const { detectFunctions, orchestrateFunctions, summarizeResults } = require('../utils/functionRouter');
const { callGroqWithRateLimit, globalRateLimiter } = require('../utils/rateLimiter');
const { buildWebEvidenceContext } = require('../utils/webEvidence');
const { buildSystemPromptForAgent } = require('../utils/agentRegistry');
const { appendEvidenceContext, searchWikipedia, searchNewsApi, searchSemanticScholar } = require('../utils/sourceProviders');
const { looksTimeSensitiveForHR, looksTimeSensitiveForMarketing, looksTimeSensitiveForDev, looksTimeSensitiveForExcel, looksTimeSensitiveForAlex, looksTimeSensitiveForTony, looksTimeSensitiveForTodo, looksTimeSensitiveForAIManagement, buildSilentWebContext } = require('../utils/silentWebRefresh');

// Fonction RAG - Recherche Brave (simple)
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

        return data.web.results.slice(0, 3).map(r => ({
            title: r.title,
            description: r.description,
            url: r.url
        }));
    } catch (_) {
        return null;
    }
}

function extractUserQueryFromMessage(raw) {
    const text = String(raw || '');
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

module.exports = async function (context, req) {
    context.log('💎 PRO PLAN - Architecture évolutive');

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
        const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
        
        if (!groqKey) {
            context.res = { 
                status: 200, 
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, 
                body: { error: "Groq API Key not configured" } 
            };
            return;
        }

        const conversationHistory = req.body.history || [];
        const chatType = req.body.chatType || req.body.conversationId;

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

        // RAG - Recherche Brave (optionnelle, ou forcée selon l'agent)
        let contextFromSearch = '';
        const forceWebSearch = chatType === 'web-search' || chatType === 'rnd-web-search';
        const isHRChat = String(chatType || '').trim() === 'hr-management';
        const hrSilentWebRefreshEnabled = isHRChat && String(process.env.HR_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const hrNeedsFreshInfo = isHRChat && looksTimeSensitiveForHR(userQuery);
        const isMarketingChat = String(chatType || '').trim() === 'marketing-agent';
        const marketingSilentWebRefreshEnabled = isMarketingChat && String(process.env.MARKETING_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const marketingNeedsFreshInfo = isMarketingChat && looksTimeSensitiveForMarketing(userQuery);
        const isDevChat = String(chatType || '').trim() === 'agent-dev';
        const devSilentWebRefreshEnabled = isDevChat && String(process.env.DEV_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const devNeedsFreshInfo = isDevChat && looksTimeSensitiveForDev(userQuery);
        const isExcelChat = String(chatType || '').trim() === 'excel-expert';
        const excelSilentWebRefreshEnabled = isExcelChat && String(process.env.EXCEL_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const excelNeedsFreshInfo = isExcelChat && looksTimeSensitiveForExcel(userQuery);
        const isAlexChat = String(chatType || '').trim() === 'agent-alex';
        const alexSilentWebRefreshEnabled = isAlexChat && String(process.env.ALEX_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const alexNeedsFreshInfo = isAlexChat && looksTimeSensitiveForAlex(userQuery);
        const isTonyChat = String(chatType || '').trim() === 'agent-tony';
        const tonySilentWebRefreshEnabled = isTonyChat && String(process.env.TONY_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const tonyNeedsFreshInfo = isTonyChat && looksTimeSensitiveForTony(userQuery);
        const isTodoChat = String(chatType || '').trim() === 'agent-todo';
        const todoSilentWebRefreshEnabled = isTodoChat && String(process.env.TODO_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const todoNeedsFreshInfo = isTodoChat && looksTimeSensitiveForTodo(userQuery);
        const isAIManagementChat = String(chatType || '').trim() === 'ai-management';
        const aiManagementSilentWebRefreshEnabled = isAIManagementChat && String(process.env.AI_MANAGEMENT_SILENT_WEB_REFRESH_ENABLED ?? 'true').toLowerCase() !== 'false';
        const aiManagementNeedsFreshInfo = isAIManagementChat && looksTimeSensitiveForAIManagement(userQuery);
        const skipWebSearchBecauseConversation = forceWebSearch
            && !userAsksForSourcesForWesh(userQuery)
            && (isSmallTalkForWesh(userQuery) || isQuestionnaireForWesh(userQuery));
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
        } catch (_) {}

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
                        ? await searchWikipedia(userQuery, { lang: 'fr', limit: wikiLimit, timeoutMs: 5000 })
                        : [];

                    const news = (newsEnabled && newsApiKey && newsLimit > 0)
                        ? await searchNewsApi(userQuery, { apiKey: newsApiKey, language: 'fr', pageSize: newsLimit, timeoutMs: 5000 })
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

        // 1. 🎯 DÉTECTION DES FONCTIONS NÉCESSAIRES
        const neededFunctions = detectFunctions(userMessage);
        context.log('📊 Fonctions détectées:', neededFunctions);

        let functionResults = [];
        
        // 2. 🔧 ORCHESTRATION DES FONCTIONS (si nécessaire)
        if (neededFunctions.length > 0) {
            context.log('⚙️ Orchestration de', neededFunctions.length, 'fonctions...');
            
            try {
                functionResults = await orchestrateFunctions(neededFunctions, userMessage, { requestBody: req.body || {} });
                context.log('✅ Fonctions exécutées:', summarizeResults(functionResults));
            } catch (funcError) {
                context.log.warn('⚠️ Erreur orchestration, continue sans:', funcError.message);
                // Continue même si fonctions échouent
            }
        }

        // 3. 🧠 CONSTRUCTION DU CONTEXTE OPTIMISÉ
        const { contexts, totalTokens } = buildContextForFunctions(
            userMessage, 
            conversationHistory, 
            functionResults
        );
        
        context.log(`📝 Contexte: ${totalTokens} tokens estimés`);

        // 4. 💬 APPEL GROQ AVEC RATE LIMITING
        const groqResponse = await callGroqWithRateLimit(async () => {
            // Prompt spécifique selon le chatType
            let systemPrompt;
            if (chatType === 'excel-expert' || chatType === 'excel-ai-expert') {
                systemPrompt = `Tu es un Expert Excel AI, spécialisé dans l'aide aux utilisateurs Excel.

**Ton rôle :**
- Aider avec les formules Excel (VLOOKUP, INDEX/MATCH, SI, SOMME.SI, etc.)
- Analyser des données et suggérer des visualisations
- Expliquer des concepts Excel de manière claire
- Proposer des solutions optimisées et des bonnes pratiques
- Aider avec Power Query, tableaux croisés dynamiques, macros VBA

**Ton style :**
- Conversationnel et amical
- Pédagogique et clair
- Fournis des exemples concrets
- Explique le "pourquoi" pas juste le "comment"
- Utilise des emojis Excel pertinents (📊 📈 💡 ✨)

**IMPORTANT - Pour les ANALYSES DESCRIPTIVES :**
Si l'utilisateur demande une "analyse" ou veut "comprendre son fichier" :
- ✅ Décris SEULEMENT ce qui existe (nombre de lignes, colonnes, types de données)
- ✅ Liste les valeurs présentes (noms de produits, plages de prix existantes)
- ✅ Explique la structure du fichier de manière pédagogique
- ❌ NE FAIS AUCUN CALCUL (pas de somme, moyenne, total, comptage)
- ❌ NE génère JAMAIS de commandes JSON pour analyses descriptives
- ❌ Reste en mode consultation pure

**Pour les SUGGESTIONS DE FORMULES :**
Si l'utilisateur demande des "formules" :
- ✅ Suggère des FORMULES EXCEL (format =...) adaptées à ses données
- ✅ Explique comment écrire les formules dans Excel (=SOMME(), =MOYENNE(), =A1*B1, etc.)
- ✅ Donne des exemples concrets avec les noms de colonnes du fichier
- ✅ Explique à quoi sert chaque formule de manière pédagogique
- ❌ NE calcule RIEN, NE modifie RIEN, suggère SEULEMENT
- ❌ NE génère JAMAIS de commandes JSON pour suggestions de formules

**Pour les SUGGESTIONS DE KPI :**
Si l'utilisateur demande des "KPI" (Indicateurs Clés de Performance) :
- ✅ Suggère des KPI pertinents pour ses données (chiffre d'affaires, moyenne, taux, etc.)
- ✅ Explique COMMENT calculer chaque KPI avec des formules Excel
- ✅ Donne des exemples concrets et pédagogiques
- ✅ Explique à quoi sert chaque KPI et pourquoi c'est important
- ❌ NE calcule RIEN, NE modifie RIEN, suggère SEULEMENT
- ❌ NE génère JAMAIS de commandes JSON pour suggestions de KPI

**Pour les SUGGESTIONS DE GRAPHIQUES :**
Si l'utilisateur demande des "graphiques" ou des "visualisations" :
- ✅ Suggère des types de graphiques adaptés (histogramme, courbe, camembert, nuage de points)
- ✅ Explique COMMENT créer chaque graphique dans Excel (Insertion > Graphique)
- ✅ Indique quelles colonnes utiliser pour X et Y, pourquoi ce graphique est pertinent
- ✅ Donne des conseils pédagogiques sur la visualisation de données
- ❌ NE crée AUCUN graphique, NE modifie RIEN, suggère SEULEMENT
- ❌ NE génère JAMAIS de commandes JSON pour suggestions de graphiques

**Pour la DÉTECTION DE DOUBLONS :**
Si l'utilisateur demande de "détecter les doublons" :
- ✅ LISTE les doublons trouvés dans les données (quelles lignes, quelles valeurs)
- ✅ Explique sur quelles colonnes il y a des doublons
- ✅ Explique COMMENT gérer les doublons dans Excel (Données > Supprimer les doublons)
- ✅ Donne des instructions claires pour suppression manuelle si désiré
- ❌ NE supprime RIEN automatiquement, NE modifie RIEN, détecte SEULEMENT
- ❌ NE génère JAMAIS de commandes JSON pour détection de doublons

**Pour les SUGGESTIONS DE TABLEAUX CROISÉS DYNAMIQUES :**
Si l'utilisateur demande un "tableau croisé dynamique" ou "pivot" :
- ✅ Suggère comment organiser le tableau croisé dynamique (lignes, colonnes, valeurs)
- ✅ Explique COMMENT créer le tableau dans Excel (Insertion > Tableau croisé dynamique)
- ✅ Donne des instructions étape par étape claires et pédagogiques
- ✅ Explique quels insights peuvent être obtenus avec cette organisation
- ❌ NE crée AUCUN tableau automatiquement, NE modifie RIEN, suggère SEULEMENT
- ❌ NE génère JAMAIS de commandes JSON pour tableaux croisés dynamiques

**Pour les MODIFICATIONS :**
Seulement si l'utilisateur demande explicitement de modifier, ajouter, calculer :
- Tu peux alors utiliser des commandes JSON si approprié

**Important :**
- Réponds en français
- Ne montre jamais d'instructions techniques internes
- Sois précis sur les noms de fonctions Excel
- Propose toujours des alternatives quand possible

Si l'utilisateur a chargé des données Excel, utilise-les pour donner des conseils personnalisés.`;
                        } else if (chatType === 'agent-dev') {
                                systemPrompt = `Tu es Agent Dev, un assistant spécialisé en développement logiciel.

Objectif: aider l'utilisateur à concevoir, implémenter, déboguer et livrer des fonctionnalités.

Règles:
- Sois concret (étapes, commandes, fichiers, APIs), sans inventer.
- Pose 1-3 questions si c'est bloquant; sinon avance avec l'option la plus simple.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.
- Si l'utilisateur colle un "🔎 Rapport Hallucination Detector", reconnais-le et explique-le.

Réponds en français, clairement et professionnellement.`;
            } else if (chatType === 'hr-management') {
                systemPrompt = `Tu es Agent RH, un assistant RH.

Tu aides sur: politique RH, congés, paie (conceptuellement), recrutement, onboarding, performance, documents.

Règles:
- Si des données RH internes ne sont pas fournies, demande les infos nécessaires.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, clair et actionnable.`;
            } else if (chatType === 'marketing-agent') {
                systemPrompt = `Tu es Agent Marketing.

Tu aides sur: positionnement, contenu, SEO, ads, emails, funnels, analytics, go-to-market.

Règles:
- Propose des plans concrets (étapes, livrables, KPI) adaptés à un SaaS.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, clair et orienté résultats.`;
            } else if (chatType === 'web-search' || chatType === 'rnd-web-search') {
                systemPrompt = /\[S\d+\]/.test(String(contextFromSearch || ''))
                    ? buildSystemPromptForAgent('web-search', contextFromSearch)
                    : buildSystemPromptForAgent('axilum', '');
            } else if (chatType === 'agent-todo') {
                systemPrompt = `Tu es Agent ToDo (gestion de tâches).

Objectif: clarifier un objectif, découper en tâches, prioriser, et proposer un plan.

Règles:
- Pose 1-3 questions si nécessaire, sinon propose une checklist + prochaines actions.
- Ne prétends pas exécuter des actions automatiquement.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, concret.`;
            } else if (chatType === 'agent-alex') {
                systemPrompt = `Tu es Agent Alex (assistant stratégie/produit SaaS).

Règles:
- Propose options + avantages/inconvénients + next step.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, clair et structuré.`;
            } else if (chatType === 'agent-tony') {
                systemPrompt = `Tu es Agent Tony (assistant vente/ops SaaS).

Règles:
- Propose scripts, templates et KPI.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, direct et actionnable.`;
            } else {
                systemPrompt = buildCompactSystemPrompt(neededFunctions) + contextFromSearch;
            }

            const messages = [
                {
                    role: "system",
                    content: systemPrompt
                }
            ];

            // Ajouter historique (déjà résumé par contextManager)
            const historyContext = contexts.find(c => c.type === 'recent_history');
            if (historyContext && Array.isArray(historyContext.content)) {
                historyContext.content.forEach(msg => {
                    if (msg.type === 'user') {
                        messages.push({ role: "user", content: msg.content });
                    } else if (msg.type === 'bot') {
                        messages.push({ role: "assistant", content: msg.content });
                    }
                });
            }

            // Ajouter résultats de fonctions si présents
            const funcContext = contexts.find(c => c.type === 'function_results');
            if (funcContext) {
                messages.push({
                    role: "system",
                    content: `Résultats des fonctions appelées:\n${funcContext.content}`
                });
            }

            // Message utilisateur
            messages.push({ role: "user", content: userMessage });

            // Appel Groq
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${groqKey}` 
                },
                body: JSON.stringify({ 
                    model: 'llama-3.3-70b-versatile', 
                    messages: messages, 
                    max_tokens: 4000, 
                    temperature: 0.7 
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Groq Error: ${response.status} - ${errorText}`);
            }

            return await response.json();
        }, 'normal');

        const aiResponse = groqResponse.choices[0].message.content;
        const responseTime = Date.now() - startTime;

        // 5. 🛡️ ANALYSE ANTI-HALLUCINATION
        let hallucinationAnalysis;
        try {
            hallucinationAnalysis = await analyzeHallucination(aiResponse, userMessage);
        } catch (analysisError) {
            context.log.warn('⚠️ Analyse hallucination échouée:', analysisError.message);
            hallucinationAnalysis = {
                hi: 0, chr: 0, claims: [], counts: {}, sources: [], 
                warning: null, method: 'fallback-error'
            };
        }

        // 5b. 🧹 AUTO-CORRECTION (Wesh uniquement)
        const isWesh = chatType === 'web-search' || chatType === 'rnd-web-search';
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
                            '- Conserve le style Wesh: citations [S#] uniquement si elles correspondent à de vraies sources du contexte.',
                            '- Ne crée pas de nouvelles sources; ne cite pas de [S#] si le contexte n\'en contient pas.',
                            '- Réponds en français, de façon concise et actionnable.'
                        ].join('\n')
                    },
                    {
                        role: 'user',
                        content: `Question: ${userMessage}\n\nRéponse initiale à corriger:\n${aiResponse}`
                    }
                ];

                const correctionResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${groqKey}`
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        messages: correctionMessages,
                        max_tokens: 2500,
                        temperature: 0.2
                    })
                });

                if (correctionResponse.ok) {
                    const correctionData = await correctionResponse.json();
                    autoCorrectionUsage = correctionData?.usage || null;
                    const corrected = correctionData?.choices?.[0]?.message?.content;
                    if (typeof corrected === 'string' && corrected.trim()) {
                        finalAiResponse = corrected.trim();
                        autoCorrectionApplied = true;
                        try {
                            hallucinationAnalysis = await analyzeHallucination(finalAiResponse, userMessage);
                        } catch (_) {
                            // keep previous analysis if re-check fails
                        }
                    }
                }
            } catch (e) {
                context.log.warn('⚠️ Auto-correction Wesh échouée, réponse initiale conservée:', e?.message || e);
            }
        }
        
        // 6. 📊 MÉTRIQUES ET RÉPONSE
        const hiPercent = (hallucinationAnalysis.hi * 100).toFixed(1);
        const chrPercent = (hallucinationAnalysis.chr * 100).toFixed(1);
        
        let metricsText = `\n\n---\n📊 **Métriques de Fiabilité**\nHI: ${hiPercent}% | CHR: ${chrPercent}%`;
        
        if (hallucinationAnalysis.warning) {
            metricsText += `\n${hallucinationAnalysis.warning}`;
        }
        
        if (hallucinationAnalysis.sources && hallucinationAnalysis.sources.length > 0) {
            metricsText += `\n\n📚 Sources: ${hallucinationAnalysis.sources.join(', ')}`;
        }

        // Ajouter info fonctions si utilisées
        if (functionResults.length > 0) {
            const successCount = functionResults.filter(r => r.success).length;
            const cachedCount = functionResults.filter(r => r.cached).length;
            metricsText += `\n⚙️ Fonctions: ${successCount}/${functionResults.length} réussies`;
            if (cachedCount > 0) {
                metricsText += ` (${cachedCount} en cache)`;
            }
        }
        
        const tokensUsedTotal = (groqResponse.usage?.total_tokens || 0) + (autoCorrectionUsage?.total_tokens || 0);
        metricsText += `\n💡 *Plan Pro - ${tokensUsedTotal} tokens utilisés*`;

        const wantsReliabilityMetrics = userExplicitlyAsksForReliabilityMetrics(userQuery);
        const includeReliabilityFooter = !isDevChat || wantsReliabilityMetrics;
        const cleanedAnswer = includeReliabilityFooter ? String(finalAiResponse || '').trim() : stripReliabilityFooter(finalAiResponse);
        const finalResponse = includeReliabilityFooter ? (cleanedAnswer + metricsText) : cleanedAnswer;

        // 7. 📈 STATS RATE LIMITER
        const rateLimiterStats = globalRateLimiter.getAllStats();
        context.log('⏱️ Rate limiter stats:', rateLimiterStats);

        context.res = {
            status: 200,
            headers: { 
                'Content-Type': 'application/json', 
                'Access-Control-Allow-Origin': '*' 
            },
            body: {
                response: finalResponse,
                responseTime: `${responseTime}ms`,
                proPlan: true,
                model: 'llama-3.3-70b',
                provider: 'Groq',
                tokensUsed: tokensUsedTotal,
                promptTokens: groqResponse.usage?.prompt_tokens || 0,
                completionTokens: groqResponse.usage?.completion_tokens || 0,
                contextTokensEstimated: totalTokens,
                qualityScore: 95,
                advancedFeatures: true,

                // Auto-correction Wesh
                autoCorrected: autoCorrectionApplied,
                autoCorrectThreshold: autoCorrectThreshold,
                
                // Métriques hallucination
                hallucinationIndex: parseFloat(hiPercent),
                contextHistoryRatio: parseFloat(chrPercent),
                hallucinationClaims: hallucinationAnalysis.claims || [],
                hallucinationCounts: hallucinationAnalysis.counts || {},
                hallucinationSources: hallucinationAnalysis.sources || [],
                hallucinationMethod: hallucinationAnalysis.method || 'unknown',
                
                // Métriques fonctions
                functionsUsed: functionResults.length,
                functionsSuccessful: functionResults.filter(r => r.success).length,
                functionsCached: functionResults.filter(r => r.cached).length,
                functionsDetails: summarizeResults(functionResults),
                
                // Rate limiter stats
                rateLimiterStats: rateLimiterStats
            }
        };
    } catch (error) {
        context.log.error('❌ Error:', error);
        context.res = { 
            status: 200, 
            headers: { 
                'Content-Type': 'application/json', 
                'Access-Control-Allow-Origin': '*' 
            }, 
            body: { 
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            } 
        };
    }
};

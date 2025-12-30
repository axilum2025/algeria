// 💎 PLAN PRO - Version évolutive avec gestion avancée
// Supporte fonctions multiples sans risque de crash

const { analyzeHallucination } = require('../utils/hallucinationDetector');
const { buildContextForFunctions, buildCompactSystemPrompt } = require('../utils/contextManager');
const { detectFunctions, orchestrateFunctions, summarizeResults } = require('../utils/functionRouter');
const { callGroqWithRateLimit, globalRateLimiter } = require('../utils/rateLimiter');

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

        // RAG - Recherche Brave (optionnelle, ou forcée selon l'agent)
        let contextFromSearch = '';
        const forceWebSearch = chatType === 'web-search' || chatType === 'rnd-web-search';
        try {
            const braveKey = process.env.APPSETTING_BRAVE_API_KEY || process.env.BRAVE_API_KEY;
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
        } catch (_) {}

        // 1. 🎯 DÉTECTION DES FONCTIONS NÉCESSAIRES
        const neededFunctions = detectFunctions(userMessage);
        context.log('📊 Fonctions détectées:', neededFunctions);

        let functionResults = [];
        
        // 2. 🔧 ORCHESTRATION DES FONCTIONS (si nécessaire)
        if (neededFunctions.length > 0) {
            context.log('⚙️ Orchestration de', neededFunctions.length, 'fonctions...');
            
            try {
                functionResults = await orchestrateFunctions(neededFunctions, userMessage);
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
- Ne prétends pas "contacter" d'autres agents IA automatiquement.
    Si l'utilisateur veut l'aide d'un autre agent, explique qu'il faut basculer de mode (ex: "/agent axilum", "/agent dev").
- Si l'utilisateur colle un "🔎 Rapport Hallucination Detector", reconnais-le et explique-le.

Réponds en français, clairement et professionnellement.`;
            } else if (chatType === 'hr-management') {
                systemPrompt = `Tu es Agent RH, un assistant RH.

Tu aides sur: politique RH, congés, paie (conceptuellement), recrutement, onboarding, performance, documents.

Règles:
- Si des données RH internes ne sont pas fournies, demande les infos nécessaires.
- Ne prétends pas contacter d'autres agents automatiquement: propose "/agent ...".

Réponds en français, clair et actionnable.`;
            } else if (chatType === 'marketing-agent') {
                systemPrompt = `Tu es Agent Marketing.

Tu aides sur: positionnement, contenu, SEO, ads, emails, funnels, analytics, go-to-market.

Règles:
- Propose des plans concrets (étapes, livrables, KPI) adaptés à un SaaS.
- Ne prétends pas contacter d'autres agents automatiquement: propose "/agent ...".

Réponds en français, clair et orienté résultats.`;
            } else if (chatType === 'web-search' || chatType === 'rnd-web-search') {
                systemPrompt = `Tu es Agent Web Search.

Objectif: répondre en te basant sur la recherche web fournie.

Règles:
- Cite 2-5 sources en fin de réponse.
- Si la recherche web est indisponible, dis-le et propose une réponse prudente + quoi vérifier.

Réponds en français, avec sources.${contextFromSearch}`;
            } else if (chatType === 'agent-todo') {
                systemPrompt = `Tu es Agent ToDo (gestion de tâches).

Objectif: clarifier un objectif, découper en tâches, prioriser, et proposer un plan.

Règles:
- Pose 1-3 questions si nécessaire, sinon propose une checklist + prochaines actions.
- Ne prétends pas exécuter des actions automatiquement.

Réponds en français, concret.`;
            } else if (chatType === 'agent-alex') {
                systemPrompt = `Tu es Agent Alex (assistant stratégie/produit SaaS).

Règles:
- Propose options + avantages/inconvénients + next step.

Réponds en français, clair et structuré.`;
            } else if (chatType === 'agent-tony') {
                systemPrompt = `Tu es Agent Tony (assistant vente/ops SaaS).

Règles:
- Propose scripts, templates et KPI.

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
        
        metricsText += `\n💡 *Plan Pro - ${groqResponse.usage?.total_tokens || 0} tokens utilisés*`;
        
        const finalResponse = aiResponse + metricsText;

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
                tokensUsed: groqResponse.usage?.total_tokens || 0,
                promptTokens: groqResponse.usage?.prompt_tokens || 0,
                completionTokens: groqResponse.usage?.completion_tokens || 0,
                contextTokensEstimated: totalTokens,
                qualityScore: 95,
                advancedFeatures: true,
                
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

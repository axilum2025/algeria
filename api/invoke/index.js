// 💎 PLAN PRO - Llama 3.3 70B via Groq + Fonctions Azure + RAG

const { analyzeHallucination } = require('../utils/hallucinationDetector');
const { buildSystemPromptForAgent } = require('../utils/agentRegistry');
const { orchestrateMultiAgents, callGroqChatCompletion } = require('../utils/orchestrator');

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
        if (!userMessage) {
            context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: "Message is required" } };
            return;
        }

        const startTime = Date.now();
        const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
        
        if (!groqKey) {
            context.res = { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: { error: "Groq API Key not configured", responseTime: `${Date.now() - startTime}ms` } };
            return;
        }

        const conversationHistory = req.body.history || [];
        const recentHistory = conversationHistory.slice(-20);

        // RAG - Recherche Brave (optionnelle, ou forcée selon l'agent)
        let contextFromSearch = '';
        const chatType = req.body.chatType || req.body.conversationId;
        const isOrchestrator = chatType === 'orchestrator';
        const forceWebSearch = chatType === 'web-search' || chatType === 'rnd-web-search';

        // 🧩 ORCHESTRATEUR MULTI-AGENTS (sur demande)
        if (isOrchestrator) {
            const braveKey = process.env.APPSETTING_BRAVE_API_KEY || process.env.BRAVE_API_KEY;
            const teamQuestion = String(req.body.teamQuestion || userMessage || '').trim();
            const orchestrated = await orchestrateMultiAgents({
                groqKey,
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
                    proPlan: true,
                    model: 'llama-3.3-70b',
                    provider: 'Groq',
                    tokensUsed: orchestrated.tokensUsed || 0,
                    advancedFeatures: true,
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
        } catch (ragError) {
            context.log.warn('⚠️ RAG search failed, continuing without it:', ragError.message);
            // Continue sans RAG
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
Pense étape par étape avant de répondre.${contextFromSearch}`
            : isAgentDev ?
                        // 🧑‍💻 PROMPT AGENT DEV (développement)
                        buildSystemPromptForAgent('agent-dev', contextFromSearch)
            : isHR ?
            // 👥 PROMPT AGENT RH
            `Tu es Agent RH, un assistant RH.

Tu aides sur: politique RH, congés, paie (conceptuellement), recrutement, onboarding, performance, documents et conformité (sans avis juridique).

Règles:
- Si des données RH internes ne sont pas fournies, dis-le et demande les infos nécessaires.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, clair, professionnel et actionnable.${contextFromSearch}`
            : isMarketing ?
            // 📣 PROMPT AGENT MARKETING
            buildSystemPromptForAgent('marketing-agent', contextFromSearch)
            : isWebSearch ?
            // 🌐 PROMPT AGENT WEB SEARCH
            `Tu es Agent Web Search.

Objectif: répondre en te basant sur la recherche web fournie dans le contexte.

Règles:
- Appuie-toi d'abord sur "Contexte de recherche web" ci-dessous.
- Cite 2-5 sources en fin de réponse sous forme de liste (titres + URLs si disponibles).
- Si la recherche web est indisponible, dis-le et propose une réponse prudente + quoi vérifier.

Réponds en français, clairement et avec sources.${contextFromSearch}`
            : isExcel ?
            // 📊 PROMPT AGENT EXCEL
            buildSystemPromptForAgent('excel-expert', contextFromSearch)
            : isTodo ?
            // ✅ PROMPT AGENT TODO
            `Tu es Agent ToDo (gestion de tâches).

Objectif: aider l'utilisateur à clarifier un objectif, découper en tâches, estimer, prioriser, et proposer un plan.

Règles:
- Pose 1-3 questions si nécessaire, sinon propose directement une liste de tâches (checklist) + prochaines actions.
- Ne prétends pas exécuter des actions automatiquement.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, très concret.${contextFromSearch}`
            : isAlex ?
            // 🧭 PROMPT AGENT ALEX
            buildSystemPromptForAgent('agent-alex', contextFromSearch)
            : isTony ?
            // 🤝 PROMPT AGENT TONY
            `Tu es Agent Tony.

Rôle: assistant orienté vente/ops (pricing, onboarding client, scripts, objections, process).

Règles:
- Propose des scripts, templates et KPI.
- Ne mentionne pas d'autres agents, modules ou outils de l'application sauf si l'utilisateur le demande explicitement.

Réponds en français, direct et actionnable.${contextFromSearch}`
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
- Si l'utilisateur colle un bloc commençant par "🔎 Rapport Hallucination Detector" (ou te demande d'expliquer HI/CHR/claims), considère que c'est un rapport interne généré par l'application.
- Dans ce cas, explique ce que signifient les sections (Score, HI, CHR, Claims, Faits vérifiés, Points non confirmés, Sources recommandées) et donne des actions concrètes pour vérifier.
- Ne dis pas que ce rapport "n'existe pas" ou "n'est pas mentionné" : traite-le comme un artefact du système.

Réponds de manière naturelle, claire et professionnelle en français.
Pense étape par étape avant de répondre.
Ne mentionne pas tes capacités ou fonctionnalités à moins que l'utilisateur ne le demande explicitement.${contextFromSearch}`
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
            data = await callGroqChatCompletion(groqKey, messages, { max_tokens: 4000, temperature: 0.7 });
        } catch (e) {
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: e.message || String(e), details: e.details || null, responseTime: `${Date.now() - startTime}ms` }
            };
            return;
        }
        const aiResponse = data.choices[0].message.content;
        const responseTime = Date.now() - startTime;

        // 🛡️ Analyse anti-hallucination avec modèles GRATUITS (Groq/Gemini)
        let hallucinationAnalysis;
        try {
            hallucinationAnalysis = await analyzeHallucination(aiResponse, userMessage);
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
        
        metricsText += `\n💡 *Plan Pro - ${data.usage?.total_tokens || 0} tokens utilisés*`;
        
        const finalResponse = aiResponse + metricsText;

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: {
                response: finalResponse,
                responseTime: `${responseTime}ms`,
                proPlan: true,
                model: 'llama-3.3-70b',
                provider: 'Groq',
                tokensUsed: data.usage?.total_tokens || 0,
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                qualityScore: 95,
                advancedFeatures: true,
                hallucinationIndex: parseFloat(hiPercent),
                contextHistoryRatio: parseFloat(chrPercent),
                hallucinationClaims: hallucinationAnalysis.claims || [],
                hallucinationCounts: hallucinationAnalysis.counts || {},
                hallucinationSources: hallucinationAnalysis.sources || [],
                hallucinationMethod: hallucinationAnalysis.method || 'unknown'
            }
        };
    } catch (error) {
        context.log.error('❌ Error:', error);
        context.res = { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: { error: error.message } };
    }
};

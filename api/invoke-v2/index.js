// 💎 PLAN PRO - Version évolutive avec gestion avancée
// Supporte fonctions multiples sans risque de crash

const { analyzeHallucination } = require('../utils/hallucinationDetector');
const { buildContextForFunctions, buildCompactSystemPrompt } = require('../utils/contextManager');
const { detectFunctions, orchestrateFunctions, summarizeResults } = require('../utils/functionRouter');
const { callGroqWithRateLimit, globalRateLimiter } = require('../utils/rateLimiter');

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
            // Prompt spécifique pour Excel AI
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

**Pour les MODIFICATIONS :**
Seulement si l'utilisateur demande explicitement de modifier, ajouter, calculer :
- Tu peux alors utiliser des commandes JSON si approprié

**Important :**
- Réponds en français
- Ne montre jamais d'instructions techniques internes
- Sois précis sur les noms de fonctions Excel
- Propose toujours des alternatives quand possible

Si l'utilisateur a chargé des données Excel, utilise-les pour donner des conseils personnalisés.`;
            } else {
                systemPrompt = buildCompactSystemPrompt(neededFunctions);
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

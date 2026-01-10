// 💎 PLAN PRO - Version évolutive avec gestion avancée
// Supporte fonctions multiples sans risque de crash

const { analyzeHallucination } = require('../utils/hallucinationDetector');
const { buildContextForFunctions, buildCompactSystemPrompt } = require('../utils/contextManager');
const { detectFunctions, orchestrateFunctions, summarizeResults } = require('../utils/functionRouter');
const { callGroqWithRateLimit, globalRateLimiter } = require('../utils/rateLimiter');
const { getAuthEmail } = require('../utils/auth');
const { precheckCredit, debitAfterUsage } = require('../utils/aiCreditGuard');

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
        const email = getAuthEmail(req);
            const userIdForBilling = getAuthEmail(req) || req.body?.userId || req.query?.userId || 'guest';
            const requestedModel = req.body?.model || req.body?.aiModel || null;
            const resolveModel = (m) => {
                const r = String(m || '').trim();
                if (!r) return 'llama-3.3-70b-versatile';
                try {
                    const pricing = JSON.parse(String(process.env.AI_PRICING_JSON || '') || '{}');
                    if (pricing && typeof pricing === 'object' && Object.prototype.hasOwnProperty.call(pricing, r)) return r;
                } catch (_) {}
                return 'llama-3.3-70b-versatile';
            };
            const resolvedModel = resolveModel(requestedModel);

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
            const messages = [
                {
                    role: "system",
                    content: buildCompactSystemPrompt(neededFunctions)
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

            // Crédit prépayé (EUR)
                await precheckCredit({ userId: userIdForBilling, model: resolvedModel, messages, maxTokens: 4000 });

            // Appel Groq
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${groqKey}` 
                },
                body: JSON.stringify({ 
                        model: resolvedModel, 
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

        // Débit du crédit sur le coût réel
        try {
                await debitAfterUsage({ userId: userIdForBilling, model: groqResponse?.model || resolvedModel, usage: groqResponse?.usage });
        } catch (_) {}

        const aiResponse = groqResponse.choices[0].message.content;
        const responseTime = Date.now() - startTime;

        // 5. 🛡️ ANALYSE ANTI-HALLUCINATION
        let hallucinationAnalysis;
        try {
            hallucinationAnalysis = await analyzeHallucination(aiResponse, userMessage, null, { userId: userIdForBilling });
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
                metricsSource: 'detector',
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

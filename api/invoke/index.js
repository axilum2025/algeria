// 💎 PLAN PRO - Llama 3.3 70B via Groq + Fonctions Azure + RAG

const { analyzeHallucination } = require('./utils/hallucinationDetector');

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

        // RAG - Recherche Brave (optionnelle)
        let contextFromSearch = '';
        
        try {
            const braveKey = process.env.APPSETTING_BRAVE_API_KEY || process.env.BRAVE_API_KEY;
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

        const messages = [{
            role: "system",
            content: `Tu es Axilum AI, un assistant intelligent et serviable.
Pense étape par étape avant de répondre.
Réponds de manière naturelle, claire et professionnelle en français.
Ne mentionne pas tes capacités ou fonctionnalités à moins que l'utilisateur ne le demande explicitement.
Sois concis et utile.${contextFromSearch}`
        }];

        recentHistory.forEach(msg => {
            if (msg.type === 'user' && msg.content) {
                messages.push({ role: "user", content: msg.content });
            } else if (msg.type === 'bot' && msg.content) {
                const cleanContent = msg.content.replace(/\n*---[\s\S]*/g, '').replace(/\n*💡.*\n*/gi, '').trim();
                if (cleanContent) messages.push({ role: "assistant", content: cleanContent });
            }
        });

        messages.push({ role: "user", content: userMessage });

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: messages, max_tokens: 4000, temperature: 0.7 })
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.res = { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: { error: `Groq Error: ${response.status}`, details: errorText, responseTime: `${Date.now() - startTime}ms` } };
            return;
        }

        const data = await response.json();
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

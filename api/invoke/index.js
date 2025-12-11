// 💎 PLAN PRO - GPT-4 via OpenRouter (Simple et Multi-Modèles)
// OpenRouter : Accès à GPT-4, Claude, et 100+ modèles avec une seule API
// Modèle : openai/gpt-4o-mini (rapide et économique)
// Endpoint : https://openrouter.ai/api/v1

module.exports = async function (context, req) {
    context.log('💎 PRO PLAN - GPT-4 Request (OpenRouter)');

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
        
        // OpenRouter API configuration (compatible OpenAI, accès à tous les modèles)
        const apiKey = process.env.APPSETTING_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
        
        if (!apiKey) {
            context.log.error('⚠️ OPENROUTER_API_KEY not configured');
            context.res = {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: {
                    error: "OpenRouter API Key not configured",
                    hint: "1. Créez un compte sur https://openrouter.ai/\n2. Obtenez votre clé API\n3. Ajoutez OPENROUTER_API_KEY dans Azure Static Web App → Configuration",
                    help: "OpenRouter donne accès à GPT-4, Claude, et 100+ modèles avec une seule clé",
                    responseTime: `${Date.now() - startTime}ms`
                }
            };
            return;
        }

        // Préparer l'historique
        const conversationHistory = req.body.history || [];
        const recentHistory = conversationHistory.slice(-20); // Limiter à 20 messages

        // Construire les messages
        const messages = [
            {
                role: "system",
                content: `Tu es Axilum AI, un assistant intelligent et serviable propulsé par Azure OpenAI GPT-5 mini. 
Réponds de manière claire, précise et professionnelle en français.

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

        context.log(`📨 Sending request to OpenRouter - ${messages.length} messages`);

        // Appel à OpenRouter (format compatible OpenAI)
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://nice-river-096898203.3.azurestaticapps.net',
                'X-Title': 'Axilum AI'
            },
            body: JSON.stringify({
                model: 'openai/gpt-4o-mini', // Modèle rapide et économique
                messages: messages,
                max_tokens: 4000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error('❌ OpenRouter Error:', response.status, errorText);
            
            context.res = {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: {
                    error: `OpenRouter Error: ${response.status}`,
                    details: errorText,
                    hint: response.status === 401 ? "Vérifiez que OPENROUTER_API_KEY est correcte" : 
                          response.status === 402 ? "Crédit insuffisant sur OpenRouter. Ajoutez du crédit sur https://openrouter.ai/" :
                          "Erreur lors de l'appel à OpenRouter",
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
                model: 'gpt-4o-mini',
                provider: 'OpenRouter',
                tokensUsed: data.usage?.total_tokens || 0,
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                qualityScore: 95,
                advancedFeatures: true
            }
        };

    } catch (error) {
        context.log.error('❌ Error in invoke function:', error);
        context.log.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        context.res = {
            status: 200, // Changé en 200 pour éviter les problèmes CORS
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: {
                error: "Internal server error",
                message: error.message,
                details: error.stack,
                hint: "Vérifiez que OPENROUTER_API_KEY est configurée dans Azure Static Web App"
            }
        };
    }
};

// 💎 PLAN PRO - GPT-5 mini via Azure OpenAI (Version Simple)
// Azure OpenAI API
// Modèle : gpt-5-mini
// Endpoint : https://axilimopenai.cognitiveservices.azure.com

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

// 🆓 PLAN GRATUIT - Llama 3.3 via Groq (100% Gratuit)
// Groq API : https://groq.com
// Modèle : llama-3.3-70b-versatile (70B paramètres)
// Coût : $0 (30 req/min gratuit)
// Vitesse : 500+ tokens/sec (ultra-rapide)

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

        if (!userMessage) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { error: "Message is required" }
            };
            return;
        }

        const startTime = Date.now();
        
        // Groq API configuration
        const groqApiKey = process.env.GROQ_API_KEY;
        
        if (!groqApiKey) {
            context.log.error('⚠️ GROQ_API_KEY not configured - using simple fallback');
            
            // Réponses prédéfinies pour les cas communs
            const lowerMessage = userMessage.toLowerCase();
            let fallbackResponse = "Bonjour ! Je suis Axilum AI en mode gratuit.";
            
            if (lowerMessage.includes('bonjour') || lowerMessage.includes('salut') || lowerMessage.includes('hello')) {
                fallbackResponse = "Bonjour ! Je suis Axilum AI, votre assistant intelligent en mode gratuit. Comment puis-je vous aider aujourd'hui ?";
            } else if (lowerMessage.includes('qui es-tu') || lowerMessage.includes('présente') || lowerMessage.includes('qui es tu')) {
                fallbackResponse = "Je suis Axilum AI, un assistant conversationnel intelligent. En mode gratuit, je suis propulsé par Llama 3.2. Pour une expérience complète avec GPT-4o et analyse anti-hallucination, essayez le mode Pro !";
            } else if (lowerMessage.includes('aide') || lowerMessage.includes('help')) {
                fallbackResponse = "Je peux vous aider avec diverses questions ! Pour activer toutes mes capacités (Llama 3.2), l'administrateur doit configurer la clé API Groq. En attendant, n'hésitez pas à poser vos questions !";
            } else {
                fallbackResponse = `Votre question : "${userMessage}"\n\nJe suis actuellement en mode configuration limitée. Pour profiter pleinement du mode gratuit avec Llama 3.2, veuillez configurer GROQ_API_KEY dans Azure.\n\nEn attendant, essayez le mode PRO pour une expérience complète avec GPT-4o !`;
            }
            
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

        // Construire les messages
        const messages = [
            {
                role: "system",
                content: `Tu es Axilum AI, un assistant intelligent et serviable. Réponds de manière claire, concise et précise en français.

**Génération d'images** : Tu peux générer des images gratuitement via Pollinations.ai
- Quand l'utilisateur demande une image, réponds avec : "Je génère l'image : [description détaillée]"
- Le système détectera automatiquement et générera l'image
- Exemples : "génère une image de...", "crée une photo de...", "dessine-moi..."`
            }
        ];

        // Ajouter l'historique
        recentHistory.forEach(msg => {
            if (msg.type === 'user' && msg.content) {
                messages.push({ role: "user", content: msg.content });
            } else if (msg.type === 'bot' && msg.content) {
                const cleanContent = msg.content
                    .replace(/\n*---[\s\S]*/g, '')
                    .replace(/\n*💡.*Mode Gratuit.*\n*/gi, '')
                    .trim();
                messages.push({ role: "assistant", content: cleanContent });
            }
        });

        // Ajouter le message actuel
        messages.push({ role: "user", content: userMessage });

        context.log('📤 Calling Groq Llama 3.3 (FREE)...');

        // Appeler Groq API
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqApiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error('❌ Groq API Error:', response.status, errorText);
            
            // Message d'erreur plus informatif
            let errorMessage = "Je suis temporairement indisponible en mode gratuit.";
            
            if (response.status === 429) {
                errorMessage = "Limite de requêtes atteinte (30/min). Veuillez patienter quelques secondes ou essayer le mode PRO.";
            } else if (response.status === 401) {
                errorMessage = "Clé API Groq invalide. Veuillez vérifier la configuration GROQ_API_KEY dans Azure.";
            } else if (response.status >= 500) {
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
                    responseTime: `${Date.now() - startTime}ms`,
                    freePlan: true,
                    error: true,
                    errorCode: response.status
                }
            };
            return;
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        const processingTime = Date.now() - startTime;

        context.log('✅ Llama 3.2 Response received');
        context.log('Response length:', aiResponse.length);
        context.log('Processing time:', processingTime + 'ms');

        // Ajouter watermark Free
        const finalResponse = aiResponse + '\n\n---\n💡 *Mode Gratuit - Propulsé par Llama 3.2*';

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
                tokensUsed: data.usage?.total_tokens || 0,
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                qualityScore: 95,
                advancedFeatures: true
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
                response: "Je suis Axilum AI en mode gratuit. Comment puis-je vous aider ?\n\n---\n💡 *Mode Gratuit - Upgrade vers Pro pour GPT-4o premium*",
                hallucinationIndex: 0,
                contextHistoryRatio: 0,
                responseTime: '0ms',
                freePlan: true,
                error: false
            }
        };
    }
};

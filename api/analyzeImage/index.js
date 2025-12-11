// 🔍 IMAGE ANALYSIS avec Google Gemini 1.5 Flash Vision (Gratuit)
// Analyse les images uploadées par l'utilisateur
// Updated: 2025-12-08

module.exports = async function (context, req) {
    context.log('🔍 Image Analysis Request');

    // CORS headers
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
        // Désactivé: le service d'analyse FREE (Gemini) n'est plus utilisé
        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                success: true,
                disabled: true,
                message: 'Analyse d\'image FREE désactivée. L\'image est affichée sans analyse.'
            }
        };
        return;

        // (Désactivé) Ancienne configuration GEMINI_API_KEY
        
        // Log pour debug (masquer la clé)
        context.log(`📝 API Key présente: ${geminiApiKey.substring(0, 10)}...`);

        context.log('📤 Calling Google Gemini 1.5 Flash Vision...');

        // Extraire seulement le base64 (enlever "data:image/...;base64,")
        const base64Data = imageBase64.includes('base64,') 
            ? imageBase64.split('base64,')[1] 
            : imageBase64;

        // Appeler Google Gemini Vision API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            text: question || 'Décris cette image en détail. Que vois-tu ? Sois précis et descriptif.'
                        },
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: base64Data
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error('❌ Gemini API Error:', response.status);
            context.log.error('Response:', errorText);
            
            let userMessage = "Désolé, je n'ai pas pu analyser cette image.";
            if (response.status === 403) {
                userMessage = "🔑 Clé API Gemini refusée.\n\n**Vérifiez:**\n1. La clé commence par 'AIza'\n2. Elle est activée sur aistudio.google.com\n3. Pas d'espaces avant/après\n4. Attendez 2 min après configuration Azure";
            } else if (response.status === 400) {
                userMessage = `❌ Requête invalide: ${errorText.substring(0, 200)}`;
            } else if (response.status === 404) {
                userMessage = "❌ Endpoint Gemini non trouvé.";
            } else if (response.status === 429) {
                userMessage = "⏱️ Limite atteinte (15/min). Réessayez dans 1 minute.";
            }
            
            throw new Error(userMessage);
        }

        const data = await response.json();
        const analysis = data.candidates[0].content.parts[0].text;

        context.log('✅ Image analyzed successfully by Gemini');

        context.res = {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                success: true,
                analysis: analysis,
                model: 'Gemini 1.5 Flash Vision (Google)',
                cost: 0,
                analyzedAt: new Date().toISOString()
            }
        };

    } catch (error) {
        context.log.error('❌ Error analyzing image:', error);
        context.res = {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: { 
                error: error.message,
                analysis: error.message || "Désolé, je n'ai pas pu analyser cette image. Veuillez réessayer."
            }
        };
    }
};

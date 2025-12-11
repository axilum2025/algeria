// 🎨 IMAGE GENERATION avec Pollinations.ai (Gratuit & Illimité)
// API: https://pollinations.ai
// Modèle: FLUX.1 Schnell (rapide et haute qualité)

module.exports = async function (context, req) {
    context.log('🎨 Image Generation Request');

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
        const { prompt, width = 1024, height = 1024 } = req.body;

        if (!prompt) {
            context.res = {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: { error: "Prompt is required" }
            };
            return;
        }

        context.log('Prompt:', prompt);
        context.log('Size:', `${width}x${height}`);

        // Construire l'URL Pollinations.ai
        // Format: https://image.pollinations.ai/prompt/{prompt}?width={w}&height={h}&model=flux&nologo=true
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=flux&nologo=true&enhance=true`;

        context.log('✅ Image URL generated:', imageUrl);

        // Pollinations.ai génère l'image à la volée quand l'URL est accédée
        // Pas besoin d'attendre la génération ici
        context.res = {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                success: true,
                imageUrl: imageUrl,
                prompt: prompt,
                size: `${width}x${height}`,
                model: 'FLUX.1-schnell via Pollinations.ai',
                cost: 0, // Gratuit !
                generatedAt: new Date().toISOString()
            }
        };

    } catch (error) {
        context.log.error('❌ Error generating image:', error);
        context.res = {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: { 
                error: error.message,
                hint: "Image generation failed"
            }
        };
    }
};

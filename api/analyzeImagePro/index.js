module.exports = async function (context, req) {
    // CORS headers
    context.res = {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'application/json'
        }
    };

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        context.res.body = '';
        return;
    }

    try {
        // Validate Azure Vision configuration
        const visionEndpoint = process.env.AZURE_VISION_ENDPOINT || 'https://axilum2025.cognitiveservices.azure.com';
        const visionKey = process.env.AZURE_VISION_KEY;

        if (!visionKey) {
            context.res.status = 500;
            context.res.body = JSON.stringify({
                error: 'Azure Computer Vision API key not configured',
                details: 'Please add AZURE_VISION_KEY to Azure Static Web App settings'
            });
            return;
        }

        // Extract image data from request
        const { imageBase64, question } = req.body || {};

        if (!imageBase64) {
            context.res.status = 400;
            context.res.body = JSON.stringify({
                error: 'No image data provided',
                details: 'imageBase64 is required'
            });
            return;
        }

        // Remove data URL prefix if present
        const base64Data = imageBase64.includes(',') 
            ? imageBase64.split(',')[1] 
            : imageBase64;

        // Convert base64 to buffer
        const imageBuffer = Buffer.from(base64Data, 'base64');

        context.log(`📸 Image size: ${imageBuffer.length} bytes`);

        // Garde-fou taille (évite timeouts / limites Azure)
        const maxBytes = Number(process.env.AXILUM_VISION_MAX_BYTES) || (4 * 1024 * 1024);
        if (imageBuffer.length > maxBytes) {
            context.res.status = 413;
            context.res.body = JSON.stringify({
                error: 'Image too large',
                details: `Max ${maxBytes} bytes. Please upload a smaller/compressed image.`
            });
            return;
        }

        // Call Azure Computer Vision Analyze Image 4.0 API
        const analyzeUrl = `${visionEndpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=caption,denseCaptions,objects,tags,read,people`;

        // Timeout réseau (évite requête pendante si Azure ne répond pas)
        const controller = new AbortController();
        const timeoutMs = Number(process.env.AZURE_VISION_TIMEOUT_MS) || 25000;
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

        let response;
        try {
            response = await fetch(analyzeUrl, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': visionKey,
                    'Content-Type': 'application/octet-stream'
                },
                body: imageBuffer,
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutHandle);
        }

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error('❌ Azure Vision Error:', response.status, errorText);

            if (response.status === 401 || response.status === 403) {
                context.res.status = 403;
                context.res.body = JSON.stringify({
                    error: 'Invalid Azure Computer Vision API key',
                    details: 'Please check AZURE_VISION_KEY configuration',
                    statusCode: response.status
                });
                return;
            }

            if (response.status === 429) {
                context.res.status = 429;
                context.res.body = JSON.stringify({
                    error: 'Rate limit exceeded',
                    details: 'Too many requests to Azure Computer Vision API',
                    statusCode: 429
                });
                return;
            }

            if (response.status === 400) {
                context.res.status = 400;
                context.res.body = JSON.stringify({
                    error: 'Invalid image data',
                    details: errorText || 'The image format or content is invalid',
                    statusCode: 400
                });
                return;
            }

            throw new Error(`Azure Vision API error: ${response.status}`);
        }

        const data = await response.json();

        // Build comprehensive analysis text
        let analysisText = '';

        // Main caption
        if (data.captionResult?.text) {
            analysisText += `**Description :** ${data.captionResult.text}\n\n`;
        }

        // Dense captions (detailed descriptions of regions)
        if (data.denseCaptionsResult?.values?.length) {
            analysisText += `**Détails :**\n`;
            data.denseCaptionsResult.values.slice(0, 3).forEach(caption => {
                analysisText += `- ${caption.text}\n`;
            });
            analysisText += '\n';
        }

        // Objects detected
        if (data.objectsResult?.values?.length) {
            analysisText += `**Objets détectés :** `;
            const objects = data.objectsResult.values.map(obj => obj.tags[0]?.name || obj.name).slice(0, 5);
            analysisText += objects.join(', ') + '\n\n';
        }

        // Tags
        if (data.tagsResult?.values?.length) {
            analysisText += `**Tags :** `;
            const tags = data.tagsResult.values.filter(t => t.confidence > 0.7).map(t => t.name).slice(0, 8);
            analysisText += tags.join(', ') + '\n\n';
        }

        // OCR Text
        if (data.readResult?.blocks?.length) {
            const extractedText = data.readResult.blocks
                .flatMap(block => block.lines.map(line => line.text))
                .join(' ')
                .trim();
            if (extractedText) {
                analysisText += `**Texte extrait :** ${extractedText}\n\n`;
            }
        }

        // People detected
        if (data.peopleResult?.values?.length) {
            analysisText += `**Personnes détectées :** ${data.peopleResult.values.length}\n\n`;
        }

        // If user asked a specific question, add context
        if (question) {
            analysisText += `**Réponse à votre question :** ${question}\n`;
            analysisText += `Basé sur l'analyse ci-dessus, cette image ${data.captionResult ? data.captionResult.text.toLowerCase() : 'contient divers éléments visuels'}.`;
        }

        // Return successful analysis
        context.res.status = 200;
        context.res.body = JSON.stringify({
            analysis: analysisText.trim() || 'Analyse complétée avec succès.',
            provider: 'Azure Computer Vision',
            model: 'Florence-2',
            confidence: data.captionResult?.confidence || 0
        });

    } catch (error) {
        if (error && (error.name === 'AbortError' || String(error.message || '').includes('aborted'))) {
            context.res.status = 504;
            context.res.body = JSON.stringify({
                error: 'Azure Vision request timed out',
                details: 'Please try again with a smaller image or retry later.'
            });
            return;
        }
        context.log.error('❌ Azure Vision Error:', error.message);
        context.res.status = 500;
        context.res.body = JSON.stringify({
            error: 'Failed to analyze image with Azure Computer Vision',
            details: error.message
        });
    }
};

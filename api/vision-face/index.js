module.exports = async function (context, req) {
    context.log('Azure Vision - Face Detection');

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
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (_) {
                body = null;
            }
        }

        let imageBase64 = body && body.imageBase64;
        if (typeof imageBase64 === 'string') {
            // Supporte un éventuel data URL complet
            if (imageBase64.includes(',')) {
                imageBase64 = imageBase64.split(',').pop();
            }
            // Supprimer les retours à la ligne / espaces
            imageBase64 = imageBase64.replace(/\s+/g, '');
        }
        
        if (!imageBase64) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: 'Image is required' }
            };
            return;
        }

        const azureKey = process.env.APPSETTING_AZURE_VISION_KEY || process.env.AZURE_VISION_KEY;
        const azureEndpoint = process.env.APPSETTING_AZURE_VISION_ENDPOINT || process.env.AZURE_VISION_ENDPOINT;

        if (!azureKey || !azureEndpoint) {
            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: 'Azure Vision credentials not configured' }
            };
            return;
        }

        const imageBuffer = Buffer.from(imageBase64, 'base64');

        const normalizedEndpoint = String(azureEndpoint || '').replace(/\/+$/, '');

        // Use Analyze API with Faces feature
        const analyzeUrl = `${normalizedEndpoint}/vision/v3.2/analyze?visualFeatures=Faces`;
        
        const response = await fetch(analyzeUrl, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': azureKey,
                'Content-Type': 'application/octet-stream'
            },
            body: imageBuffer
        });

        if (!response.ok) {
            const errorText = await response.text();
            let details = errorText;
            let azureErrorCode = null;
            let azureErrorMessage = null;

            try {
                const parsed = JSON.parse(errorText);
                // Azure Computer Vision errors are typically: { error: { code, message } }
                if (parsed && parsed.error) {
                    azureErrorCode = parsed.error.code || null;
                    azureErrorMessage = parsed.error.message || null;
                    details = parsed;
                } else {
                    details = parsed;
                }
            } catch (_) {
                // keep plain text
            }

            context.log.error('Azure Vision Face error:', errorText);
            context.res = {
                status: response.status,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: {
                    error: `Azure Vision Face Error: ${response.status}`,
                    azureErrorCode,
                    azureErrorMessage,
                    details
                }
            };
            return;
        }

        const data = await response.json();
        
        // Format face data
        const faces = data.faces?.map(face => ({
            age: face.age,
            gender: face.gender,
            faceRectangle: face.faceRectangle
        })) || [];

        const result = {
            faceCount: faces.length,
            faces: faces
        };

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: result
        };

    } catch (error) {
        context.log.error('Error:', error);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: { error: 'Face detection failed', details: error.message }
        };
    }
};

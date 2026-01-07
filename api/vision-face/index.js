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

        // Essayer d'abord Azure Face API (retourne âge/genre)
        const faceKey = process.env.APPSETTING_AZURE_FACE_KEY || process.env.AZURE_FACE_KEY;
        const faceEndpoint = process.env.APPSETTING_AZURE_FACE_ENDPOINT || process.env.AZURE_FACE_ENDPOINT;
        
        // Fallback sur Computer Vision (mais ne retourne plus âge/genre depuis 2020)
        const visionKey = process.env.APPSETTING_AZURE_VISION_KEY || process.env.AZURE_VISION_KEY;
        const visionEndpoint = process.env.APPSETTING_AZURE_VISION_ENDPOINT || process.env.AZURE_VISION_ENDPOINT;

        const useFaceApi = faceKey && faceEndpoint;
        const azureKey = useFaceApi ? faceKey : visionKey;
        const azureEndpoint = useFaceApi ? faceEndpoint : visionEndpoint;

        if (!azureKey || !azureEndpoint) {
            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { 
                    error: 'Azure Face API or Computer Vision credentials not configured',
                    hint: 'Set AZURE_FACE_KEY/AZURE_FACE_ENDPOINT for age/gender detection'
                }
            };
            return;
        }

        const imageBuffer = Buffer.from(imageBase64, 'base64');

        const normalizedEndpoint = String(azureEndpoint || '').replace(/\/+$/, '');

        // Use Face API v1.0 si disponible
        // NOTE: Azure a déprécié les attributs age, gender, emotion, smile, facial hair, hair, makeup
        // Voir: https://aka.ms/facerecognition
        // IMPORTANT: returnFaceId requiert une approbation Microsoft pour Identification/Verification
        // On utilise returnFaceId: false pour éviter les erreurs de permission
        let analyzeUrl;
        if (useFaceApi) {
            const params = new URLSearchParams({
                returnFaceId: 'false',  // ⚠️ Sans approbation Microsoft pour Identification
                returnFaceLandmarks: 'false'
                // Les attributs suivants sont dépréciés: age, gender, emotion, smile, etc.
            });
            analyzeUrl = `${normalizedEndpoint}/face/v1.0/detect?${params}`;
        } else {
            // Fallback Computer Vision v3.2 (aussi déprécié pour age/gender)
            analyzeUrl = `${normalizedEndpoint}/vision/v3.2/analyze?visualFeatures=Faces`;
        }
        
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
        
        // Format face data selon l'API utilisée
        let faces;
        if (useFaceApi) {
            // Azure Face API v1.0 - attributs dépréciés depuis 2024
            // Uniquement faceId et faceRectangle sont encore supportés
            faces = (Array.isArray(data) ? data : []).map(face => ({
                faceId: face.faceId,
                faceRectangle: face.faceRectangle
            }));
        } else {
            // Computer Vision v3.2 retourne { faces: [...] }
            // Note: âge/genre seront N/A (dépréciés depuis 2020)
            faces = data.faces?.map(face => ({
                faceId: face.faceId || null,
                age: face.age || 'N/A',
                gender: face.gender || 'N/A',
                faceRectangle: face.faceRectangle
            })) || [];
        }

        const result = {
            faceCount: faces.length,
            faces: faces,
            apiUsed: useFaceApi ? 'Azure Face API v1.0 (attributs limités)' : 'Computer Vision v3.2 (deprecated)',
            warning: 'Attributs (âge, genre, émotions) ont été dépréciés par Azure. Voir https://aka.ms/facerecognition'
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

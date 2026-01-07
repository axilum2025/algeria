// Azure Face Detection - Sans attributs (dépréciés depuis 2024)
// Alternative pour âge/genre: Amazon Rekognition, Google Cloud Vision, ou local ML

module.exports = async function (context, req) {
    context.log('Azure Face Detection - Localisation et géométrie uniquement');

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
            if (imageBase64.includes(',')) {
                imageBase64 = imageBase64.split(',').pop();
            }
            imageBase64 = imageBase64.replace(/\s+/g, '');
        }
        
        if (!imageBase64) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: 'Image is required (imageBase64)' }
            };
            return;
        }

        // Azure Face API credentials
        const faceKey = process.env.APPSETTING_AZURE_FACE_KEY || process.env.AZURE_FACE_KEY;
        const faceEndpoint = process.env.APPSETTING_AZURE_FACE_ENDPOINT || process.env.AZURE_FACE_ENDPOINT;

        if (!faceKey || !faceEndpoint) {
            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { 
                    error: 'Azure Face API credentials not configured',
                    hint: 'Set AZURE_FACE_KEY and AZURE_FACE_ENDPOINT in .env',
                    documentation: 'https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-identity'
                }
            };
            return;
        }

        const imageBuffer = Buffer.from(imageBase64, 'base64');
        const normalizedEndpoint = String(faceEndpoint || '').replace(/\/+$/, '');

        // Azure Face API v1.0 - détection uniquement (sans attributs dépréciés)
        const detectUrl = `${normalizedEndpoint}/face/v1.0/detect`;
        const params = new URLSearchParams({
            returnFaceId: 'false',  // Sans approbation pour Identification/Verification
            returnFaceLandmarks: 'false'
            // IMPORTANT: Les attributs suivants ont été dépréciés par Azure:
            // - age, gender, emotion, smile
            // - facial hair, hair, makeup, glasses
            // - accessories, blur, exposure, noise
            // Voir: https://aka.ms/facerecognition
        });
        
        const response = await fetch(`${detectUrl}?${params}`, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': faceKey,
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

            context.log.error('Azure Face API error:', errorText);
            context.res = {
                status: response.status,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: {
                    error: `Azure Face API Error: ${response.status}`,
                    azureErrorCode,
                    azureErrorMessage,
                    details
                }
            };
            return;
        }

        const faces = await response.json();
        
        // Format face data - Localisation et géométrie uniquement
        const formattedFaces = (Array.isArray(faces) ? faces : []).map((face, index) => ({
            // Note: faceId retiré car returnFaceId: false (restriction Microsoft)
            faceRectangle: face.faceRectangle,
            // faceLandmarks retiré car returnFaceLandmarks: false
            note: 'Attributs (âge, genre, émotions, landmarks) dépréciés ou nécessitent approbation'
        }));

        const result = {
            faceCount: formattedFaces.length,
            faces: formattedFaces,
            apiUsed: 'Azure Face API v1.0',
            deprecationNotice: {
                status: 'RESTRICTED',
                message: 'Identification/Verification nécessite approbation Microsoft',
                restrictedFeatures: ['returnFaceId', 'Identification', 'Verification'],
                deprecatedAttributes: ['age', 'gender', 'emotion', 'smile', 'facialHair', 'hair', 'makeup', 'glasses', 'accessories', 'blur', 'exposure', 'noise'],
                documentation: 'https://aka.ms/facerecognition',
                supportedOnly: ['faceRectangle (localisation uniquement)']
            }
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
            body: {
                error: 'Internal Server Error',
                message: error.message
            }
        };
    }
};

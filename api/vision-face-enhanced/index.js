module.exports = async function (context, req) {
    context.log('Azure Face API - Enhanced Face Detection with Age & Gender');

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

        // Azure Face API credentials (distinct de Computer Vision)
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

        // Azure Face API v1.0 - detect avec age, gender, headPose, smile, etc.
        const detectUrl = `${normalizedEndpoint}/face/v1.0/detect`;
        const params = new URLSearchParams({
            returnFaceId: 'true',
            returnFaceLandmarks: 'false',
            returnFaceAttributes: 'age,gender,headPose,smile,facialHair,glasses,emotion,hair,makeup,accessories,blur,exposure,noise'
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
        
        // Format face data avec toutes les informations disponibles
        const formattedFaces = faces.map(face => ({
            faceId: face.faceId,
            faceRectangle: face.faceRectangle,
            faceAttributes: {
                age: face.faceAttributes?.age || 'N/A',
                gender: face.faceAttributes?.gender || 'N/A',
                smile: face.faceAttributes?.smile || 0,
                emotion: face.faceAttributes?.emotion || {},
                glasses: face.faceAttributes?.glasses || 'NoGlasses',
                headPose: face.faceAttributes?.headPose || {},
                facialHair: face.faceAttributes?.facialHair || {},
                hair: face.faceAttributes?.hair || {},
                makeup: face.faceAttributes?.makeup || {},
                accessories: face.faceAttributes?.accessories || [],
                blur: face.faceAttributes?.blur || {},
                exposure: face.faceAttributes?.exposure || {},
                noise: face.faceAttributes?.noise || {}
            }
        }));

        const result = {
            faceCount: formattedFaces.length,
            faces: formattedFaces
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

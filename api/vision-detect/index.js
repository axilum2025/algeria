module.exports = async function (context, req) {
    context.log('Azure Vision - Object Detection');

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
        const { imageBase64 } = req.body;
        
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

        // Detect Objects
        const detectUrl = `${azureEndpoint}/vision/v3.2/detect`;
        
        const response = await fetch(detectUrl, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': azureKey,
                'Content-Type': 'application/octet-stream'
            },
            body: imageBuffer
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error('Azure Vision Detection error:', errorText);
            context.res = {
                status: response.status,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: `Azure Vision Detection Error: ${response.status}`, details: errorText }
            };
            return;
        }

        const data = await response.json();
        
        const objects = data.objects?.map(obj => ({
            object: obj.object,
            confidence: obj.confidence,
            rectangle: obj.rectangle
        })) || [];

        const result = {
            objectCount: objects.length,
            objects: objects
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
            body: { error: 'Object detection failed', details: error.message }
        };
    }
};

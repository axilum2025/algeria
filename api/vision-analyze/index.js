const fetch = require('node-fetch');

module.exports = async function (context, req) {
    context.log('Azure Vision - Image Analysis');

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

        // Call Azure Computer Vision Analyze API
        const analyzeUrl = `${azureEndpoint}/vision/v3.2/analyze?visualFeatures=Categories,Description,Color,Tags,Objects,Brands&details=Landmarks`;
        
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
            context.log.error('Azure Vision error:', errorText);
            context.res = {
                status: response.status,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: `Azure Vision Error: ${response.status}`, details: errorText }
            };
            return;
        }

        const data = await response.json();
        
        // Format response
        const result = {
            description: data.description?.captions?.[0]?.text || 'No description available',
            confidence: data.description?.captions?.[0]?.confidence || 0,
            tags: data.tags?.map(tag => tag.name) || [],
            categories: data.categories?.map(cat => cat.name) || [],
            objects: data.objects?.map(obj => ({
                object: obj.object,
                confidence: obj.confidence,
                rectangle: obj.rectangle
            })) || [],
            brands: data.brands?.map(brand => ({
                name: brand.name,
                confidence: brand.confidence,
                rectangle: brand.rectangle
            })) || [],
            colors: {
                dominant: data.color?.dominantColors || [],
                accent: data.color?.accentColor || '',
                isBW: data.color?.isBWImg || false
            },
            metadata: data.metadata
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
            body: { error: 'Analysis failed', details: error.message }
        };
    }
};

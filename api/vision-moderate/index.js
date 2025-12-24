module.exports = async function (context, req) {
    context.log('Azure Vision - Content Moderation');

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

    // Helper function outside try/catch
    function getSafetyRecommendation(adult) {
        if (!adult) return 'Safe';
        
        if (adult.isAdultContent || adult.isGoryContent) {
            return 'Unsafe - Block content';
        }
        if (adult.isRacyContent) {
            return 'Caution - Review recommended';
        }
        if (adult.adultScore > 0.6 || adult.racyScore > 0.6 || adult.goreScore > 0.6) {
            return 'Moderate risk - Monitor';
        }
        return 'Safe';
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

        // Use Analyze API with Adult feature
        const analyzeUrl = `${azureEndpoint}/vision/v3.2/analyze?visualFeatures=Adult`;
        
        context.log('Calling Azure Vision:', analyzeUrl);
        
        const response = await fetch(analyzeUrl, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': azureKey,
                'Content-Type': 'application/octet-stream'
            },
            body: imageBuffer
        });

        context.log('Response status:', response.status);
        context.log('Response content-type:', response.headers.get('content-type'));

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error('Azure Vision Moderation error:', errorText);
            context.res = {
                status: response.status,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: `Azure Vision Moderation Error: ${response.status}`, details: errorText }
            };
            return;
        }

        const data = await response.json();
        context.log('Azure response data:', JSON.stringify(data));
        
        const result = {
            isAdultContent: data.adult?.isAdultContent || false,
            adultScore: data.adult?.adultScore || 0,
            isRacyContent: data.adult?.isRacyContent || false,
            racyScore: data.adult?.racyScore || 0,
            isGoryContent: data.adult?.isGoryContent || false,
            goreScore: data.adult?.goreScore || 0,
            recommendation: getSafetyRecommendation(data.adult)
        };

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: result
        };

    } catch (error) {
        context.log.error('Error details:', error);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: { error: 'Content moderation failed', details: error.message }
        };
    }
};

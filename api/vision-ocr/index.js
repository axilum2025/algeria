module.exports = async function (context, req) {
    context.log('Azure Vision - OCR Text Extraction');

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

        // Call Azure Computer Vision Read API (OCR)
        const readUrl = `${azureEndpoint}/vision/v3.2/read/analyze`;
        
        const submitResponse = await fetch(readUrl, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': azureKey,
                'Content-Type': 'application/octet-stream'
            },
            body: imageBuffer
        });

        if (!submitResponse.ok) {
            const errorText = await submitResponse.text();
            context.log.error('Azure Vision OCR error:', errorText);
            context.res = {
                status: submitResponse.status,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: `Azure Vision OCR Error: ${submitResponse.status}`, details: errorText }
            };
            return;
        }

        // Get operation location from response header
        const operationLocation = submitResponse.headers.get('Operation-Location');
        
        if (!operationLocation) {
            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: 'No operation location returned' }
            };
            return;
        }

        // Poll for results
        let resultData = null;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const resultResponse = await fetch(operationLocation, {
                method: 'GET',
                headers: {
                    'Ocp-Apim-Subscription-Key': azureKey
                }
            });

            resultData = await resultResponse.json();
            
            if (resultData.status === 'succeeded') {
                break;
            } else if (resultData.status === 'failed') {
                context.res = {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: { error: 'OCR operation failed' }
                };
                return;
            }
            
            attempts++;
        }

        if (!resultData || resultData.status !== 'succeeded') {
            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: 'OCR timeout' }
            };
            return;
        }

        // Extract text from results
        let fullText = '';
        const lines = [];
        
        if (resultData.analyzeResult && resultData.analyzeResult.readResults) {
            resultData.analyzeResult.readResults.forEach(page => {
                page.lines.forEach(line => {
                    fullText += line.text + '\n';
                    lines.push({
                        text: line.text,
                        boundingBox: line.boundingBox
                    });
                });
            });
        }

        const result = {
            text: fullText.trim(),
            lines: lines,
            language: resultData.analyzeResult?.readResults?.[0]?.language || 'unknown',
            pageCount: resultData.analyzeResult?.readResults?.length || 0
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
            body: { error: 'OCR extraction failed', details: error.message }
        };
    }
};

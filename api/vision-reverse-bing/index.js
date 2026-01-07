module.exports = async function (context, req) {
    context.log('Bing Visual Search - Reverse Image Search');

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

        const apiKey = process.env.APPSETTING_BING_VISUAL_SEARCH_KEY || process.env.BING_VISUAL_SEARCH_KEY;
        const endpoint = process.env.APPSETTING_BING_VISUAL_SEARCH_ENDPOINT || process.env.BING_VISUAL_SEARCH_ENDPOINT || 'https://api.bing.microsoft.com';

        if (!apiKey) {
            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: 'Bing Visual Search key not configured' }
            };
            return;
        }

        const normalizedEndpoint = String(endpoint).replace(/\/+$/, '');

        // Standard endpoint:
        // POST https://api.bing.microsoft.com/v7.0/images/visualsearch
        const url = `${normalizedEndpoint}/v7.0/images/visualsearch`;

        const imageBuffer = Buffer.from(imageBase64, 'base64');

        const form = new FormData();
        const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
        form.append('image', blob, 'image.jpg');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey
            },
            body: form
        });

        const text = await response.text();
        if (!response.ok) {
            let details = text;
            let bingErrorCode = null;
            let bingErrorMessage = null;
            try {
                const parsed = JSON.parse(text);
                details = parsed;
                if (parsed && parsed.error) {
                    bingErrorCode = parsed.error.code || null;
                    bingErrorMessage = parsed.error.message || null;
                }
            } catch (_) {
                // keep plain text
            }

            context.log.error('Bing Visual Search error:', text);
            context.res = {
                status: response.status,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: {
                    error: `Bing Visual Search Error: ${response.status}`,
                    bingErrorCode,
                    bingErrorMessage,
                    details
                }
            };
            return;
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            context.res = {
                status: 502,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: 'Invalid JSON from Bing Visual Search', details: text.slice(0, 2000) }
            };
            return;
        }

        // Normalize results into a short list of useful links.
        // Typical shape: tags[].actions[] where actionType can be "PagesIncluding" or "VisualSearch" etc.
        const results = [];
        const tags = Array.isArray(data.tags) ? data.tags : [];

        for (const tag of tags) {
            const actions = Array.isArray(tag.actions) ? tag.actions : [];
            for (const action of actions) {
                const actionType = action.actionType;
                const value = action.data && action.data.value;
                if (!Array.isArray(value)) continue;

                for (const item of value) {
                    // PagesIncluding items often have: name, hostPageUrl, hostPageDisplayUrl, thumbnailUrl, contentUrl
                    const hostPageUrl = item.hostPageUrl || item.contentUrl;
                    if (!hostPageUrl) continue;

                    results.push({
                        actionType,
                        name: item.name || item.hostPageDisplayUrl || hostPageUrl,
                        url: hostPageUrl,
                        thumbnailUrl: item.thumbnailUrl || null,
                        contentUrl: item.contentUrl || null
                    });

                    if (results.length >= 10) break;
                }

                if (results.length >= 10) break;
            }
            if (results.length >= 10) break;
        }

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: {
                resultCount: results.length,
                results,
                raw: {
                    tagsCount: tags.length
                }
            }
        };
    } catch (error) {
        context.log.error('Error:', error);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: { error: 'Reverse image search failed', details: error.message }
        };
    }
};

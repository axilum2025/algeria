const {
    BlobServiceClient,
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters,
    BlobSASPermissions
} = require('@azure/storage-blob');

function parseAzureStorageConnectionString(connectionString) {
    const parts = {};
    for (const segment of String(connectionString).split(';')) {
        const [rawKey, ...rest] = segment.split('=');
        const key = (rawKey || '').trim();
        if (!key) continue;
        parts[key] = rest.join('=');
    }
    const accountName = parts.AccountName;
    const accountKey = parts.AccountKey;
    return { accountName, accountKey };
}

module.exports = async function (context, req) {
    context.log('Google Custom Search - Reverse Image Search');

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
        const query = body && typeof body.query === 'string' ? body.query.trim() : '';
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

        const apiKey = process.env.APPSETTING_GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_SEARCH_API_KEY;
        const cx = process.env.APPSETTING_GOOGLE_SEARCH_CX || process.env.GOOGLE_SEARCH_CX;

        if (!apiKey) {
            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: 'Google Search API key not configured' }
            };
            return;
        }

        if (!cx) {
            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { 
                    error: 'Google Custom Search Engine ID (cx) not configured',
                    hint: 'Create one at https://programmablesearchengine.google.com/'
                }
            };
            return;
        }

        // Upload temporairement l'image sur Azure Blob et générer une URL SAS (évite l'accès public)
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: 'Azure Storage not configured' }
            };
            return;
        }

        const { accountName, accountKey } = parseAzureStorageConnectionString(connectionString);
        if (!accountName || !accountKey) {
            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: {
                    error: 'Azure Storage connection string invalid (missing AccountName/AccountKey)'
                }
            };
            return;
        }

        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerName = 'temp-reverse-search';
        const containerClient = blobServiceClient.getContainerClient(containerName);

        // Créer le container s'il n'existe pas
        try {
            // Ne pas forcer l'accès public (souvent interdit sur les Storage Accounts modernes)
            await containerClient.createIfNotExists();
        } catch (e) {
            context.log.warn('Container already exists or error:', e.message);
        }

        const blobName = `face-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        const imageBuffer = Buffer.from(imageBase64, 'base64');
        await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
            blobHTTPHeaders: { blobContentType: 'image/jpeg' }
        });

        // URL SAS courte durée pour permettre à Google de lire le blob
        const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
        const sas = generateBlobSASQueryParameters(
            {
                containerName,
                blobName,
                permissions: BlobSASPermissions.parse('r'),
                startsOn: new Date(Date.now() - 2 * 60 * 1000),
                expiresOn: new Date(Date.now() + 10 * 60 * 1000),
                protocol: 'https'
            },
            sharedKeyCredential
        ).toString();

        const imageUrl = `${blockBlobClient.url}?${sas}`;

        // IMPORTANT:
        // L'API Google Custom Search ne propose pas de "reverse image search" (recherche par image) via un paramètre imgUrl.
        // En l'absence de requête textuelle, on renvoie des liens (Google Images/Lens/Bing) basés sur l'URL SAS.
        if (!query) {
            // Nettoyer le blob temporaire après (fire and forget)
            blockBlobClient.delete().catch(e => context.log.warn('Failed to delete temp blob:', e.message));

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: {
                    mode: 'links',
                    warning: 'Google Custom Search API does not support reverse image search by URL. Returning links instead.',
                    imageUrl,
                    links: {
                        googleImages: `https://www.google.com/searchbyimage?image_url=${encodeURIComponent(imageUrl)}`,
                        googleLens: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`,
                        bingVisualSearch: 'https://www.bing.com/visualsearch'
                    }
                }
            };
            return;
        }

        // Recherche d'images standard (par texte)
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&searchType=image&q=${encodeURIComponent(query)}&num=10`;

        const response = await fetch(searchUrl);
        const text = await response.text();

        // Nettoyer le blob temporaire après (fire and forget)
        blockBlobClient.delete().catch(e => context.log.warn('Failed to delete temp blob:', e.message));

        if (!response.ok) {
            let details = text;
            let googleErrorMessage = null;
            try {
                const parsed = JSON.parse(text);
                details = parsed;
                if (parsed && parsed.error) {
                    googleErrorMessage = parsed.error.message || parsed.error.code || null;
                }
            } catch (_) {
                // keep plain text
            }

            context.log.error('Google Custom Search error:', text);
            context.res = {
                status: response.status,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: {
                    error: `Google Search Error: ${response.status}`,
                    googleErrorMessage,
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
                body: { error: 'Invalid JSON from Google Search', details: text.slice(0, 2000) }
            };
            return;
        }

        // Normaliser les résultats
        const results = [];
        const items = Array.isArray(data.items) ? data.items : [];

        for (const item of items) {
            results.push({
                title: item.title || item.link,
                url: item.link,
                snippet: item.snippet || null,
                thumbnailUrl: item.image?.thumbnailLink || null,
                contextLink: item.image?.contextLink || null
            });

            if (results.length >= 10) break;
        }

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: {
                mode: 'search',
                query,
                resultCount: results.length,
                results,
                raw: {
                    searchInformation: data.searchInformation || {}
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

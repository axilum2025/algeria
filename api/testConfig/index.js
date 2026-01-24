// Test de configuration Azure (admin only)
const { getAuthEmail } = require('../utils/auth');
const { getRoles } = require('../utils/userStorage');
const { getElasticConfig, ensureIndex, getIndexVectorDims } = require('../utils/elasticsearch');
const { getAzureEmbeddingsConfig, isAzureEmbeddingsConfigured } = require('../utils/embeddings');

function corsJsonHeaders(extra = {}) {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
        ...extra
    };
}

function readAdminKey(req) {
    const raw = req.headers?.['x-admin-key'] || req.headers?.['X-Admin-Key'] || '';
    return String(Array.isArray(raw) ? raw[0] : raw).trim();
}

function hasValidAdminKey(req) {
    const expected = String(process.env.ADMIN_API_KEY || '').trim();
    if (!expected) return false;
    const got = readAdminKey(req);
    return Boolean(got && got === expected);
}

async function isAdminEmail(email) {
    if (!email) return false;
    const roles = await getRoles(String(email).toLowerCase()).catch(() => []);
    return Array.isArray(roles) && roles.includes('admin');
}

function safeHost(url) {
    try {
        const u = new URL(String(url || '').trim());
        return u.host || null;
    } catch {
        return null;
    }
}

async function pingAzureEmbeddings() {
    const cfg = getAzureEmbeddingsConfig();
    const configured = Boolean(cfg.endpoint && cfg.apiKey && cfg.deployment);
    if (!configured) {
        return { configured: false, ok: false, status: null, vectorLength: null, error: 'Azure embeddings non configuré' };
    }

    const apiVersions = Array.from(new Set([String(cfg.apiVersion || '').trim(), '2024-02-15-preview', '2024-06-01'].filter(Boolean)));

    for (const apiVersion of apiVersions) {
        const url = `${cfg.endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(cfg.deployment)}/embeddings?api-version=${encodeURIComponent(apiVersion)}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': cfg.apiKey
                },
                body: JSON.stringify({ input: ['ping'] }),
                signal: controller.signal
            });

            const rawText = await resp.text();
            let data = null;
            try {
                data = rawText ? JSON.parse(rawText) : null;
            } catch {
                data = null;
            }

            if (!resp.ok) {
                const msg = String(data?.error?.message || rawText || '').toLowerCase();
                const details = typeof rawText === 'string' ? rawText.slice(0, 500) : null;
                const err = {
                    configured: true,
                    ok: false,
                    status: resp.status,
                    vectorLength: null,
                    apiVersionTried: apiVersion,
                    error: data?.error?.message || details || `HTTP ${resp.status}`
                };

                // Si 404 Resource not found, tenter une autre api-version
                if (resp.status === 404 && msg.includes('resource not found')) {
                    continue;
                }

                return err;
            }

            const vec = data?.data?.[0]?.embedding;
            const vectorLength = Array.isArray(vec) ? vec.length : null;

            return {
                configured: true,
                ok: true,
                status: resp.status,
                vectorLength,
                modelId: cfg.modelId,
                deployment: cfg.deployment,
                apiVersion,
                endpointHost: safeHost(cfg.endpoint)
            };
        } catch (e) {
            return {
                configured: true,
                ok: false,
                status: null,
                vectorLength: null,
                apiVersionTried: apiVersion,
                error: e?.name === 'AbortError' ? 'Timeout embeddings (6s)' : (e?.message || String(e))
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    return { configured: true, ok: false, status: 404, vectorLength: null, error: 'Resource not found (toutes api-versions testées)' };
}

module.exports = async function (context, req) {
    context.log('🔍 Test de configuration');

    if (String(req.method || '').toUpperCase() === 'OPTIONS') {
        context.res = { status: 204, headers: corsJsonHeaders(), body: '' };
        return;
    }

    const enabled = String(process.env.TEST_CONFIG_ENABLED || '').trim() === '1';
    if (process.env.NODE_ENV === 'production' && !enabled) {
        context.res = { status: 404, headers: corsJsonHeaders(), body: JSON.stringify({ error: 'Not found' }) };
        return;
    }

    const adminKeyOk = hasValidAdminKey(req);
    const emailAuth = getAuthEmail(req);
    if (!adminKeyOk) {
        const admin = await isAdminEmail(emailAuth);
        if (!admin) {
            context.res = {
                status: emailAuth ? 403 : 401,
                headers: corsJsonHeaders(),
                body: JSON.stringify({ error: emailAuth ? 'Non autorisé' : 'Non authentifié' })
            };
            return;
        }
    }

    const elasticCfg = getElasticConfig();
    let elastic = {
        configured: Boolean(elasticCfg.url),
        urlHost: safeHost(elasticCfg.url),
        index: elasticCfg.index || null,
        configVectorDims: Number(elasticCfg.vectorDims) || null,
        mappingVectorDims: null,
        ensureIndex: null,
        error: null
    };

    if (elastic.configured && elastic.index) {
        try {
            const ensured = await ensureIndex(elastic.index, elasticCfg.vectorDims);
            const mappingDims = await getIndexVectorDims(elastic.index).catch(() => null);
            elastic = {
                ...elastic,
                mappingVectorDims: mappingDims,
                ensureIndex: ensured,
                error: null
            };
        } catch (e) {
            elastic = {
                ...elastic,
                error: {
                    message: e?.message || String(e),
                    code: e?.code || null,
                    status: e?.status || null,
                    details: e?.details || null
                }
            };
        }
    }

    const embeddingsCfg = getAzureEmbeddingsConfig();
    const embeddings = {
        azureConfigured: isAzureEmbeddingsConfigured(),
        endpointHost: safeHost(embeddingsCfg.endpoint),
        deployment: embeddingsCfg.deployment || null,
        apiVersion: embeddingsCfg.apiVersion || null,
        modelId: embeddingsCfg.modelId || null,
        ping: await pingAzureEmbeddings()
    };

    const config = {
        // Compat (ancien)
        azureAiKeyExists: !!process.env.AZURE_AI_API_KEY,
        azureAiKeyLength: process.env.AZURE_AI_API_KEY ? process.env.AZURE_AI_API_KEY.length : 0,
        groqKeyExists: !!process.env.GROQ_API_KEY,
        endpointConfigured: !!process.env.AZURE_OPENAI_ENDPOINT || !!process.env.AZURE_AI_ENDPOINT,
        deploymentConfigured: !!process.env.AZURE_OPENAI_DEPLOYMENT || !!process.env.AZURE_AI_DEPLOYMENT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || process.env.AZURE_AI_API_VERSION || null,

        // Nouveaux checks (RAG/embeddings/Elastic)
        azureOpenaiKeyExists: !!process.env.AZURE_OPENAI_API_KEY || !!process.env.AZURE_AI_API_KEY,
        azureOpenaiEndpointConfigured: !!process.env.AZURE_OPENAI_ENDPOINT,
        embeddings,
        elastic,
        now: new Date().toISOString()
    };

    context.res = {
        status: 200,
        headers: corsJsonHeaders(),
        body: config
    };
};

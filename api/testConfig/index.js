// Test de configuration Azure (admin only)
const { getAuthEmail } = require('../utils/auth');
const { getRoles } = require('../utils/userStorage');

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

    const config = {
        azureAiKeyExists: !!process.env.AZURE_AI_API_KEY,
        azureAiKeyLength: process.env.AZURE_AI_API_KEY ? process.env.AZURE_AI_API_KEY.length : 0,
        groqKeyExists: !!process.env.GROQ_API_KEY,
        // Ne pas exposer la liste des env vars ni un preview de secret.
        endpointConfigured: !!process.env.AZURE_OPENAI_ENDPOINT || !!process.env.AZURE_AI_ENDPOINT,
        deploymentConfigured: !!process.env.AZURE_OPENAI_DEPLOYMENT || !!process.env.AZURE_AI_DEPLOYMENT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || process.env.AZURE_AI_API_VERSION || null
    };

    context.res = {
        status: 200,
        headers: corsJsonHeaders(),
        body: config
    };
};

const { listAllRoles, getRoles } = require('../utils/userStorage');
const { getAuthEmail } = require('../utils/auth');

function corsJsonHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  context.log('List roles triggered');
  if (String(req.method || '').toUpperCase() === 'OPTIONS') {
    context.res = { status: 204, headers: corsJsonHeaders(), body: '' };
    return;
  }
  try {
    const enabled = String(process.env.LIST_ROLES_ENABLED || '').trim() === '1';
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

    const roles = await listAllRoles();
    context.res = { status: 200, headers: corsJsonHeaders(), body: JSON.stringify({ roles }) };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, headers: corsJsonHeaders(), body: JSON.stringify({ error: 'internal' }) };
  }
};

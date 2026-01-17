const { getRoles } = require('../utils/userStorage');
const { getAuthEmail, setCors } = require('../utils/auth');

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
  context.log('Get user roles triggered');
  if (String(req.method || '').toUpperCase() === 'OPTIONS') {
    context.res = { status: 204, headers: corsJsonHeaders(), body: '' };
    return;
  }
  try {
    const requested = (req.query && req.query.username) || (req.body && req.body.username);
    const username = String(requested || '').trim().toLowerCase();
    if (!username) {
      context.res = { status: 400, headers: corsJsonHeaders(), body: JSON.stringify({ error: 'username requis' }) };
      return;
    }

    const email = getAuthEmail(req);
    const requireAuth = process.env.NODE_ENV === 'production' || String(process.env.USER_ROLES_REQUIRE_AUTH || '').trim() === '1';
    const adminKeyOk = hasValidAdminKey(req);

    if (requireAuth && !email && !adminKeyOk) {
      context.res = { status: 401, headers: corsJsonHeaders(), body: JSON.stringify({ error: 'Non authentifié' }) };
      return;
    }

    if (!adminKeyOk) {
      const self = email ? String(email).toLowerCase() : null;
      if (!self) {
        context.res = { status: 401, headers: corsJsonHeaders(), body: JSON.stringify({ error: 'Non authentifié' }) };
        return;
      }
      if (username !== self) {
        const admin = await isAdminEmail(self);
        if (!admin) {
          context.res = { status: 403, headers: corsJsonHeaders(), body: JSON.stringify({ error: 'Non autorisé' }) };
          return;
        }
      }
    }

    const roles = await getRoles(username);
    context.res = { status: 200, headers: corsJsonHeaders(), body: JSON.stringify({ username, roles }) };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, headers: corsJsonHeaders(), body: JSON.stringify({ error: 'internal' }) };
  }
};

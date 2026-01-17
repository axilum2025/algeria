const { removeRole, getRoles } = require('../utils/userStorage');
const { getAuthEmail } = require('../utils/auth');

function corsJsonHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function normalizeRole(value) {
  const r = String(value || '').trim();
  if (!r) return '';
  if (!/^[a-z0-9_-]{1,40}$/i.test(r)) return '';
  return r;
}

module.exports = async function (context, req) {
  context.log('Remove role triggered');
  if (String(req.method || '').toUpperCase() === 'OPTIONS') {
    context.res = { status: 204, headers: corsJsonHeaders(), body: '' };
    return;
  }
  try {
    const { username: rawUsername, role: rawRole } = req.body || {};
    const username = String(rawUsername || '').trim().toLowerCase();
    const role = normalizeRole(rawRole);
    if (!username || !role) {
      context.res = { status: 400, headers: corsJsonHeaders(), body: JSON.stringify({ error: 'username et role requis' }) };
      return;
    }

    const adminKeyOk = hasValidAdminKey(req);
    const email = getAuthEmail(req);
    const requireAuth = process.env.NODE_ENV === 'production' || String(process.env.ROLES_ADMIN_REQUIRE_AUTH || '').trim() === '1';
    if (requireAuth && !email && !adminKeyOk) {
      context.res = { status: 401, headers: corsJsonHeaders(), body: JSON.stringify({ error: 'Non authentifié' }) };
      return;
    }
    if (!adminKeyOk) {
      const admin = await isAdminEmail(email);
      if (!admin) {
        context.res = { status: 403, headers: corsJsonHeaders(), body: JSON.stringify({ error: 'Non autorisé' }) };
        return;
      }
    }

    const roles = await removeRole(username, role);
    context.res = { status: 200, headers: corsJsonHeaders(), body: JSON.stringify({ success: true, username, roles }) };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, headers: corsJsonHeaders(), body: JSON.stringify({ error: 'internal' }) };
  }
};

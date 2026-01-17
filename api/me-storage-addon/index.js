const { setCors, requireAuth } = require('../utils/auth');
const { getUserByEmail, updateUser, getRoles } = require('../utils/userStorage');

function safeGb(n, fallback = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.floor(v));
}

function canSelfServeStorageAddon() {
  // Sécurité: jamais en production (même si la variable est mal configurée).
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') return false;
  return String(process.env.AXILUM_ALLOW_SELF_SERVICE_STORAGE_ADDON || '').trim() === '1';
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    setCors(context, 'GET, POST, OPTIONS');
    context.res = { status: 200 };
    return;
  }

  setCors(context, 'GET, POST, OPTIONS');

  try {
    const email = requireAuth(context, req);
    if (!email) return;

    const user = await getUserByEmail(email);
    const currentAddonGb = safeGb(user && (user.storageAddonGb ?? user.storage_addon_gb ?? 0), 0);

    if (String(req.method || '').toUpperCase() === 'GET') {
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          ok: true,
          authenticated: true,
          email,
          addonGb: currentAddonGb
        }
      };
      return;
    }

    // POST: incrementer ou définir (contrôlé)
    const body = req.body || {};
    const deltaGb = safeGb(body.deltaGb, 0);
    const setGb = body.setGb != null ? safeGb(body.setGb, currentAddonGb) : null;

    // Autorisation: admin OR env flag (désactivé en prod par défaut)
    let isAdmin = false;
    try {
      const roles = await getRoles(email);
      isAdmin = Array.isArray(roles) && roles.includes('admin');
    } catch (_) {}

    if (!isAdmin && !canSelfServeStorageAddon()) {
      context.res = {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
        body: { ok: false, error: 'Non autorisé' }
      };
      return;
    }

    const MAX_GB = 500; // garde-fou
    let nextAddonGb = currentAddonGb;

    if (setGb != null) {
      nextAddonGb = Math.min(MAX_GB, Math.max(0, setGb));
    } else {
      nextAddonGb = Math.min(MAX_GB, currentAddonGb + deltaGb);
    }

    await updateUser(email, { storageAddonGb: nextAddonGb });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        ok: true,
        authenticated: true,
        email,
        addonGb: nextAddonGb
      }
    };
  } catch (e) {
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { ok: false, error: 'Erreur serveur', details: String(e?.message || e) }
    };
  }
};

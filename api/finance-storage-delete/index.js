const { deleteBlob } = require('../utils/storage');
const { getAuthEmail, setCors } = require('../utils/auth');

module.exports = async function (context, req) {
  setCors(context, 'POST, OPTIONS');
  context.res.headers['Content-Type'] = 'application/json';

  if (req.method === 'OPTIONS') {
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  try {
    // Auth obligatoire pour supprimer
    const userId = getAuthEmail(req);
    if (!userId) {
      context.res.status = 401;
      context.res.body = { error: 'Non authentifié' };
      return;
    }

    const container = (req.body?.container || 'invoices').toString();
    const name = (req.body?.name || '').toString();
    if (!name) {
      context.res.status = 400;
      context.res.body = { error: 'name requis' };
      return;
    }
    // Supprimer uniquement dans l'espace de l'utilisateur (préfixe users/{userId}/)
    const ok = await deleteBlob(container, name, userId);
    context.res.status = 200;
    context.res.body = { container, name, deleted: ok };
  } catch (err) {
    context.res.status = 500;
    context.res.body = { error: err.message || String(err) };
  }
};

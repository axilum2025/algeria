const { listBlobs } = require('../utils/storage');
const { getAuthEmail, setCors } = require('../utils/auth');
const { buildUsersPrefix } = require('../utils/blobNaming');

module.exports = async function (context, req) {
  setCors(context, 'POST, OPTIONS');
  context.res.headers['Content-Type'] = 'application/json';

  if (req.method === 'OPTIONS') {
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  try {
    // Auth obligatoire pour lister les fichiers
    const userId = getAuthEmail(req);
    if (!userId) {
      context.res.status = 401;
      context.res.body = { error: 'Non authentifié' };
      return;
    }

    const container = (req.body?.container || 'invoices').toString();
    // Lister uniquement les blobs de l'utilisateur (préfixe users/{userId}/)
    const items = await listBlobs(container, userId);
    // Nettoyer les noms pour retirer le préfixe users/{userId}/
    const prefix = buildUsersPrefix(userId) || '';
    const cleanedItems = items.map(item => ({
      ...item,
      name: prefix ? item.name.replace(prefix, '') : item.name
    }));
    context.res.status = 200;
    context.res.body = { container, count: cleanedItems.length, items: cleanedItems };
  } catch (err) {
    context.res.status = 500;
    context.res.body = { error: err.message || String(err) };
  }
};

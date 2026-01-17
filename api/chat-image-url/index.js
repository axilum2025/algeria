const { buildBlobUrl, getBlobServiceClient } = require('../utils/storage');
const { requireAuth, setCors } = require('../utils/auth');
const { sanitizeUserIdForBlobPrefix } = require('../utils/blobNaming');

function isValidRemoteImageId(remoteImageId) {
  return /^[A-Za-z0-9._-]{1,200}$/.test(String(remoteImageId || ''));
}

module.exports = async function (context, req) {
  setCors(context, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  const email = requireAuth(context, req);
  if (!email) return;

  try {
    const remoteImageId = (req.body?.remoteImageId || '').toString().trim();
    if (!remoteImageId) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'remoteImageId requis' } };
      return;
    }

    if (!isValidRemoteImageId(remoteImageId)) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'remoteImageId invalide' } };
      return;
    }

    const container = 'chat-images';
    const safeEmail = sanitizeUserIdForBlobPrefix(email);
    const blobName = `${safeEmail}/${remoteImageId}`;

    // Vérifier existence si possible
    const svc = getBlobServiceClient();
    if (svc) {
      const cc = svc.getContainerClient(container);
      const bc = cc.getBlobClient(blobName);
      const exists = await bc.exists();
      if (!exists) {
        context.res = { status: 404, headers: { 'Content-Type': 'application/json' }, body: { error: 'Image introuvable' } };
        return;
      }
    }

    const url = buildBlobUrl(container, blobName);
    if (!url) {
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'URL SAS indisponible (storage non configuré)' } };
      return;
    }

    context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { url } };
  } catch (err) {
    context.log.error('chat-image-url error', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message || String(err) } };
  }
};

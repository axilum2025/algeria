const { getBlobServiceClient } = require('../utils/storage');
const { requireAuth, setCors } = require('../utils/auth');
const { checkUserCanAddBytes, buildQuotaExceededBody } = require('../utils/storageQuota');
const { sanitizeUserIdForBlobPrefix } = require('../utils/blobNaming');

function decodeDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], b64: m[2] };
}

function isValidRemoteImageId(remoteImageId) {
  // UUID-like / ids simples, sans slash ni backslash
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
    const imageBase64 = req.body?.imageBase64;

    if (!remoteImageId || !imageBase64) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'remoteImageId et imageBase64 requis' } };
      return;
    }

    if (!isValidRemoteImageId(remoteImageId)) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'remoteImageId invalide' } };
      return;
    }

    const decoded = decodeDataUrl(imageBase64);
    if (!decoded) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'imageBase64 doit être un data URL base64 (data:image/...)' } };
      return;
    }

    // Taille max ~4MB après décodage (évite timeouts)
    const buf = Buffer.from(decoded.b64, 'base64');
    if (buf.length > 4 * 1024 * 1024) {
      context.res = { status: 413, headers: { 'Content-Type': 'application/json' }, body: { error: 'Image trop grande (max ~4MB)' } };
      return;
    }

    const svc = getBlobServiceClient();
    if (!svc) {
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'Azure Storage non configuré' } };
      return;
    }

    const container = svc.getContainerClient('chat-images');
    await container.createIfNotExists();
    const safeEmail = sanitizeUserIdForBlobPrefix(email);
    const blobName = `${safeEmail}/${remoteImageId}`;
    const blob = container.getBlockBlobClient(blobName);

    // Delta = taille ajoutée nette (si overwrite)
    let existingBytes = 0;
    try {
      const props = await blob.getProperties();
      existingBytes = Number(props?.contentLength) || 0;
    } catch (_) {}
    const deltaBytes = Math.max(0, buf.length - Math.max(0, existingBytes));

    const quotaCheck = await checkUserCanAddBytes(email, deltaBytes);
    if (!quotaCheck.ok) {
      context.res = {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
        body: buildQuotaExceededBody(quotaCheck)
      };
      return;
    }

    await blob.uploadData(buf, {
      blobHTTPHeaders: { blobContentType: decoded.mimeType }
    });

    context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { success: true, remoteImageId } };
  } catch (err) {
    context.log.error('chat-image-upload error', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message || String(err) } };
  }
};

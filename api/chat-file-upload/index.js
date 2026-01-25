const { getBlobServiceClient } = require('../utils/storage');
const { requireAuth, setCors } = require('../utils/auth');
const { checkUserCanAddBytes, buildQuotaExceededBody } = require('../utils/storageQuota');
const { sanitizeUserIdForBlobPrefix } = require('../utils/blobNaming');

function decodeBase64Payload(payload) {
  const raw = String(payload || '').trim();
  if (!raw) return null;

  // Accept either raw base64 or a full data URL: data:<mime>;base64,<...>
  const m = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (m) {
    return { mimeType: m[1], b64: m[2] };
  }

  return { mimeType: null, b64: raw };
}

function isValidRemoteFileId(remoteFileId) {
  // UUID-like / ids simples, sans slash ni backslash
  return /^[A-Za-z0-9._-]{1,200}$/.test(String(remoteFileId || ''));
}

function safeFileName(name) {
  // Minimal, for Content-Disposition
  const s = String(name || 'file').replace(/[\r\n\t\\]/g, '_');
  return s.length > 160 ? s.slice(0, 160) : s;
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
    const remoteFileId = (req.body?.remoteFileId || '').toString().trim();
    const fileName = (req.body?.fileName || '').toString().trim();
    const mimeType = (req.body?.mimeType || '').toString().trim();
    const fileBase64 = req.body?.fileBase64;

    if (!remoteFileId || !fileBase64) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'remoteFileId et fileBase64 requis' } };
      return;
    }

    if (!isValidRemoteFileId(remoteFileId)) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'remoteFileId invalide' } };
      return;
    }

    const decoded = decodeBase64Payload(fileBase64);
    if (!decoded || !decoded.b64) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'fileBase64 invalide' } };
      return;
    }

    const buf = Buffer.from(decoded.b64, 'base64');

    // Max ~15MB après décodage (évite timeouts)
    if (buf.length > 15 * 1024 * 1024) {
      context.res = { status: 413, headers: { 'Content-Type': 'application/json' }, body: { error: 'Fichier trop grand (max ~15MB)' } };
      return;
    }

    const svc = getBlobServiceClient();
    if (!svc) {
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'Azure Storage non configuré' } };
      return;
    }

    const container = svc.getContainerClient('chat-files');
    await container.createIfNotExists();

    const safeEmail = sanitizeUserIdForBlobPrefix(email);
    const blobName = `${safeEmail}/${remoteFileId}`;
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

    const ct = decoded.mimeType || mimeType || 'application/octet-stream';
    const dispName = safeFileName(fileName || remoteFileId);

    await blob.uploadData(buf, {
      blobHTTPHeaders: {
        blobContentType: ct,
        blobContentDisposition: `inline; filename="${dispName}"`
      },
      metadata: {
        originalName: dispName,
        uploadedAt: new Date().toISOString()
      }
    });

    context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { success: true, remoteFileId } };
  } catch (err) {
    context.log.error('chat-file-upload error', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message || String(err) } };
  }
};

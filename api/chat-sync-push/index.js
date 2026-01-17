const { getBlobServiceClient } = require('../utils/storage');
const { requireAuth, setCors } = require('../utils/auth');
const { checkUserCanAddBytes, buildQuotaExceededBody } = require('../utils/storageQuota');

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
    const conversations = req.body?.conversations;
    if (!Array.isArray(conversations)) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'conversations doit être un tableau' } };
      return;
    }

    const svc = getBlobServiceClient();
    if (!svc) {
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'Azure Storage non configuré' } };
      return;
    }

    const container = svc.getContainerClient('chat-sync');
    await container.createIfNotExists();
    const blobName = `${email}/conversations.json`;
    const blob = container.getBlockBlobClient(blobName);

    const payload = Buffer.from(JSON.stringify(conversations), 'utf8');

    // Delta = taille ajoutée nette (si overwrite)
    let existingBytes = 0;
    try {
      const props = await blob.getProperties();
      existingBytes = Number(props?.contentLength) || 0;
    } catch (_) {}
    const deltaBytes = Math.max(0, payload.length - Math.max(0, existingBytes));

    const quotaCheck = await checkUserCanAddBytes(email, deltaBytes);
    if (!quotaCheck.ok) {
      context.res = {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
        body: buildQuotaExceededBody(quotaCheck)
      };
      return;
    }

    await blob.uploadData(payload, {
      blobHTTPHeaders: { blobContentType: 'application/json' }
    });

    context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { success: true } };
  } catch (err) {
    context.log.error('chat-sync-push error', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message || String(err) } };
  }
};

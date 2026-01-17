const { getBlobServiceClient } = require('../utils/storage');
const { requireAuth, setCors } = require('../utils/auth');
const { sanitizeUserIdForBlobPrefix } = require('../utils/blobNaming');

module.exports = async function (context, req) {
  setCors(context, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  const email = requireAuth(context, req);
  if (!email) return;

  try {
    const svc = getBlobServiceClient();
    if (!svc) {
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'Azure Storage non configuré' } };
      return;
    }

    const container = svc.getContainerClient('chat-sync');
    await container.createIfNotExists();
    const safeEmail = sanitizeUserIdForBlobPrefix(email);
    const blobName = `${safeEmail}/conversations.json`;
    const blob = container.getBlockBlobClient(blobName);

    const exists = await blob.exists();
    if (!exists) {
      context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { conversations: [] } };
      return;
    }

    const buf = await blob.downloadToBuffer();
    const json = buf.toString('utf8');
    let data = null;
    try {
      data = JSON.parse(json);
    } catch {
      data = null;
    }

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { conversations: Array.isArray(data) ? data : (data && Array.isArray(data.conversations) ? data.conversations : []) }
    };
  } catch (err) {
    context.log.error('chat-sync-pull error', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message || String(err) } };
  }
};

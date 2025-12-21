const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');

function getConfig() {
  const conn = (process.env.APPSETTING_AZURE_STORAGE_CONNECTION_STRING || process.env.AZURE_STORAGE_CONNECTION_STRING || '').trim();
  const account = (process.env.APPSETTING_AZURE_STORAGE_ACCOUNT || process.env.AZURE_STORAGE_ACCOUNT || '').trim();
  const key = (process.env.APPSETTING_AZURE_STORAGE_KEY || process.env.AZURE_STORAGE_KEY || '').trim();
  const sas = (process.env.APPSETTING_AZURE_STORAGE_SAS_TOKEN || process.env.AZURE_STORAGE_SAS_TOKEN || '').trim();
  return { conn, account, key, sas };
}

function getBlobServiceClient() {
  const { conn, account, key } = getConfig();
  if (conn) return BlobServiceClient.fromConnectionString(conn);
  if (account && key) {
    const cred = new StorageSharedKeyCredential(account, key);
    const url = `https://${account}.blob.core.windows.net`;
    return new BlobServiceClient(url, cred);
  }
  return null;
}

function buildBlobUrl(container, blobName) {
  const { account, sas } = getConfig();
  if (!account) return null;
  const base = `https://${account}.blob.core.windows.net/${container}/${encodeURIComponent(blobName)}`;
  if (sas) {
    const q = sas.startsWith('?') ? sas : `?${sas}`;
    return `${base}${q}`;
  }
  return base;
}

async function ensureContainer(containerClient) {
  try {
    await containerClient.createIfNotExists({ access: 'container' });
  } catch {}
}

async function uploadBuffer(container, blobName, buffer, contentType) {
  const svc = getBlobServiceClient();
  if (!svc) return null;
  const containerClient = svc.getContainerClient(container);
  await ensureContainer(containerClient);
  const blockBlob = containerClient.getBlockBlobClient(blobName);
  const opts = contentType ? { blobHTTPHeaders: { blobContentType: contentType } } : undefined;
  await blockBlob.uploadData(buffer, opts);
  return buildBlobUrl(container, blobName) || blockBlob.url;
}

async function listBlobs(container) {
  const svc = getBlobServiceClient();
  if (!svc) return [];
  const out = [];
  const containerClient = svc.getContainerClient(container);
  for await (const item of containerClient.listBlobsFlat()) {
    out.push({ name: item.name, size: item.properties?.contentLength || null, url: buildBlobUrl(container, item.name) });
  }
  return out;
}

module.exports = { getBlobServiceClient, uploadBuffer, listBlobs, buildBlobUrl };

async function deleteBlob(container, blobName) {
  const svc = getBlobServiceClient();
  if (!svc) return false;
  const containerClient = svc.getContainerClient(container);
  const client = containerClient.getBlobClient(blobName);
  try {
    await client.deleteIfExists();
    return true;
  } catch {
    return false;
  }
}

module.exports.deleteBlob = deleteBlob;

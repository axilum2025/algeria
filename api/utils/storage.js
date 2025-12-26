const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');

function getConfig() {
  const conn = (process.env.APPSETTING_AZURE_STORAGE_CONNECTION_STRING || process.env.AZURE_STORAGE_CONNECTION_STRING || '').trim();
  let account = (process.env.APPSETTING_AZURE_STORAGE_ACCOUNT || process.env.AZURE_STORAGE_ACCOUNT || '').trim();
  let key = (process.env.APPSETTING_AZURE_STORAGE_KEY || process.env.AZURE_STORAGE_KEY || '').trim();
  const sas = (process.env.APPSETTING_AZURE_STORAGE_SAS_TOKEN || process.env.AZURE_STORAGE_SAS_TOKEN || '').trim();
  
  // Si connection string fournie, extraire account et key
  if (conn && (!account || !key)) {
    const accountMatch = conn.match(/AccountName=([^;]+)/);
    const keyMatch = conn.match(/AccountKey=([^;]+)/);
    if (accountMatch) account = accountMatch[1];
    if (keyMatch) key = keyMatch[1];
  }
  
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

function buildBlobUrlWithSAS(container, blobName, expiryMinutes = 60) {
  const { account, key, sas } = getConfig();
  
  // Si SAS token global fourni, l'utiliser
  if (sas) {
    if (!account) return null;
    const base = `https://${account}.blob.core.windows.net/${container}/${encodeURIComponent(blobName)}`;
    const q = sas.startsWith('?') ? sas : `?${sas}`;
    return `${base}${q}`;
  }
  
  // Sinon, générer un SAS token temporaire
  if (account && key) {
    try {
      const startsOn = new Date();
      const expiresOn = new Date(startsOn.getTime() + expiryMinutes * 60 * 1000);
      
      const permissions = BlobSASPermissions.parse('r'); // Read only
      const credential = new StorageSharedKeyCredential(account, key);
      
      const sasToken = generateBlobSASQueryParameters(
        {
          containerName: container,
          blobName: blobName,
          permissions,
          startsOn,
          expiresOn
        },
        credential
      ).toString();
      
      return `https://${account}.blob.core.windows.net/${container}/${encodeURIComponent(blobName)}?${sasToken}`;
    } catch (error) {
      console.error('Error generating SAS token:', error);
      return null;
    }
  }
  
  return null;
}

// Backward compatibility
function buildBlobUrl(container, blobName) {
  return buildBlobUrlWithSAS(container, blobName);
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
    // Essayer buildBlobUrl avec SAS token
    let url = buildBlobUrl(container, item.name);
    
    // Si toujours pas d'URL, fallback sur generateBlobSASUrl
    if (!url) {
      try {
        const blockBlob = containerClient.getBlockBlobClient(item.name);
        const { account, key } = getConfig();
        
        if (account && key) {
          // Générer SAS directement
          const startsOn = new Date();
          const expiresOn = new Date(startsOn.getTime() + 60 * 60 * 1000); // 1 heure
          const permissions = BlobSASPermissions.parse('r');
          const credential = new StorageSharedKeyCredential(account, key);
          
          const sasToken = generateBlobSASQueryParameters(
            {
              containerName: container,
              blobName: item.name,
              permissions,
              startsOn,
              expiresOn
            },
            credential
          ).toString();
          
          url = `${blockBlob.url}?${sasToken}`;
        } else {
          url = blockBlob.url;
        }
      } catch (error) {
        console.error('Error generating SAS for blob:', item.name, error);
        url = null;
      }
    }
    
    out.push({ name: item.name, size: item.properties?.contentLength || null, url });
  }
  return out;
}

module.exports = { getBlobServiceClient, uploadBuffer, listBlobs, buildBlobUrl, getConfig };

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

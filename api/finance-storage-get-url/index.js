const { buildBlobUrl, getBlobServiceClient, getConfig } = require('../utils/storage');
const { generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  const setCors = () => {
    context.res = context.res || {};
    context.res.headers = Object.assign({}, context.res.headers, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
  };

  if (req.method === 'OPTIONS') {
    setCors();
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  try {
    const container = (req.body?.container || 'invoices').toString();
    const name = (req.body?.name || '').toString();
    
    if (!name) {
      setCors();
      context.res.status = 400;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { error: 'Missing blob name' };
      return;
    }
    
    // Essayer buildBlobUrl d'abord (avec SAS si disponible)
    let url = buildBlobUrl(container, name);
    
    // Si null, générer un SAS token directement
    if (!url) {
      const svc = getBlobServiceClient();
      if (svc) {
        const containerClient = svc.getContainerClient(container);
        const blockBlob = containerClient.getBlockBlobClient(name);
        const config = getConfig();
        
        if (config.account && config.key) {
          try {
            const startsOn = new Date();
            const expiresOn = new Date(startsOn.getTime() + 60 * 60 * 1000); // 1 heure
            const permissions = BlobSASPermissions.parse('r');
            const credential = new StorageSharedKeyCredential(config.account, config.key);
            
            const sasToken = generateBlobSASQueryParameters(
              {
                containerName: container,
                blobName: name,
                permissions,
                startsOn,
                expiresOn
              },
              credential
            ).toString();
            
            url = `${blockBlob.url}?${sasToken}`;
          } catch (error) {
            context.log.error('Error generating SAS token:', error);
          }
        }
        
        if (!url) {
          url = blockBlob.url;
        }
      }
    }
    
    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { url };
  } catch (err) {
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { error: err.message || String(err) };
  }
};

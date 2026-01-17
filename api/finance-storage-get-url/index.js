const { buildBlobUrl, getBlobServiceClient, getConfig } = require('../utils/storage');
const { generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { getAuthEmail, setCors } = require('../utils/auth');
const { buildUsersBlobName } = require('../utils/blobNaming');

module.exports = async function (context, req) {
  setCors(context, 'POST, OPTIONS');
  context.res.headers['Content-Type'] = 'application/json';

  if (req.method === 'OPTIONS') {
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  try {
    // Auth obligatoire pour obtenir une URL de téléchargement
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
      context.res.body = { error: 'Missing blob name' };
      return;
    }
    
    // Construire le chemin complet avec préfixe utilisateur
    const fullBlobName = buildUsersBlobName(userId, name);
    
    // Essayer buildBlobUrl d'abord (avec SAS si disponible)
    let url = buildBlobUrl(container, fullBlobName);
    
    // Si null, générer un SAS token directement
    if (!url) {
      const svc = getBlobServiceClient();
      if (svc) {
        const containerClient = svc.getContainerClient(container);
        const blockBlob = containerClient.getBlockBlobClient(fullBlobName);
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
                blobName: fullBlobName,
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
    
    context.res.status = 200;
    context.res.body = { url };
  } catch (err) {
    context.res.status = 500;
    context.res.body = { error: err.message || String(err) };
  }
};

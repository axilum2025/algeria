const crypto = require('crypto');
const { requireAuth, setCors } = require('../utils/auth');
const { getElasticConfig, ensureIndex, bulkIndex } = require('../utils/elasticsearch');
const { chunkText } = require('../utils/textChunking');
const { generateSimpleEmbedding } = require('../utils/simpleEmbedding');

function pickSnippet(text, max = 120) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    setCors(context, 'POST, OPTIONS');
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  try {
    const userId = requireAuth(context, req);
    if (!userId) return;

    const { url, index, vectorDims } = getElasticConfig();
    if (!url) {
      setCors(context, 'POST, OPTIONS');
      context.res.status = 500;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = {
        error: 'Elasticsearch non configuré',
        details: 'ELASTICSEARCH_URL manquant'
      };
      return;
    }

    const body = req.body || {};
    const documents = Array.isArray(body.documents) ? body.documents : null;

    if (!documents || documents.length === 0) {
      setCors(context, 'POST, OPTIONS');
      context.res.status = 400;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { error: 'documents[] requis' };
      return;
    }

    await ensureIndex(index, vectorDims);

    const maxDocs = Math.min(50, documents.length);
    const maxChunksPerDoc = 80;

    let ndjson = '';
    const indexed = [];

    for (let di = 0; di < maxDocs; di++) {
      const doc = documents[di] || {};
      const documentId = String(doc.documentId || doc.id || crypto.randomUUID());
      const title = String(doc.title || '').trim() || null;
      const source = String(doc.source || 'upload').trim();
      const urlValue = doc.url ? String(doc.url).trim() : null;
      const tags = Array.isArray(doc.tags) ? doc.tags.map(t => String(t)) : undefined;
      const createdAt = doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString();

      const content = String(doc.content || '').trim();
      if (!content) continue;

      const chunks = chunkText(content, {
        maxChars: Number(body.maxChars || 1200) || 1200,
        overlap: Number(body.overlap || 150) || 150
      }).slice(0, maxChunksPerDoc);

      chunks.forEach((chunk, chunkId) => {
        const id = `${userId}:${documentId}:${chunkId}`;
        const vector = generateSimpleEmbedding(chunk, vectorDims);

        ndjson += JSON.stringify({ index: { _id: id } }) + '\n';
        ndjson += JSON.stringify({
          tenantId: userId,
          documentId,
          chunkId,
          title,
          content: chunk,
          source,
          url: urlValue,
          tags,
          createdAt,
          content_vector: vector
        }) + '\n';
      });

      indexed.push({ documentId, chunks: chunks.length, title: title || pickSnippet(content) });
    }

    if (!ndjson) {
      setCors(context, 'POST, OPTIONS');
      context.res.status = 400;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { error: 'Aucun contenu indexable trouvé' };
      return;
    }

    const result = await bulkIndex(index, ndjson);

    setCors(context, 'POST, OPTIONS');
    context.res.status = result.ok ? 200 : 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = {
      ok: result.ok,
      index,
      indexed,
      took: result.took,
      errors: result.errors
    };
  } catch (err) {
    setCors(context, 'POST, OPTIONS');
    context.res.status = err.status || 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = {
      error: err.message || String(err),
      details: err.details || null
    };
  }
};

const { requireAuth, setCors } = require('../utils/auth');
const { getElasticConfig, ensureIndex, searchText, searchVector, rrfMerge } = require('../utils/elasticsearch');
const { embedTexts } = require('../utils/embeddings');

function normalizeMode(mode) {
  const m = String(mode || '').toLowerCase().trim();
  if (m === 'text' || m === 'bm25') return 'text';
  if (m === 'vector' || m === 'knn') return 'vector';
  return 'hybrid';
}

function toPublicHit(hit) {
  const src = hit?._source || {};
  const highlight = hit?.highlight?.content;
  const snippet = Array.isArray(highlight) && highlight.length ? highlight.join(' … ') : null;

  return {
    id: hit?._id,
    score: hit?._score ?? null,
    documentId: src.documentId,
    chunkId: src.chunkId,
    title: src.title,
    source: src.source,
    url: src.url,
    tags: src.tags,
    createdAt: src.createdAt,
    snippet,
    content: snippet ? null : (src.content ? String(src.content).slice(0, 500) : null)
  };
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
    const q = String(body.q || body.query || '').trim();
    const mode = normalizeMode(body.mode);
    const topK = Math.max(1, Math.min(20, Number(body.topK || 5) || 5));

    if (!q) {
      setCors(context, 'POST, OPTIONS');
      context.res.status = 400;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { error: 'q requis' };
      return;
    }

    await ensureIndex(index, vectorDims);

    let textResp = null;
    let vectorResp = null;

    if (mode === 'text' || mode === 'hybrid') {
      textResp = await searchText({ indexName: index, tenantId: userId, query: q, topK });
    }

    if (mode === 'vector' || mode === 'hybrid') {
      const embedded = await embedTexts([q], { userId, route: 'elastic/search', dims: vectorDims, preferAzure: true });
      const vector = embedded && Array.isArray(embedded.vectors) && embedded.vectors[0] ? embedded.vectors[0] : null;
      if (!vector) {
        setCors(context, 'POST, OPTIONS');
        context.res.status = 500;
        context.res.headers['Content-Type'] = 'application/json';
        context.res.body = { error: 'Embedding indisponible' };
        return;
      }
      vectorResp = await searchVector({ indexName: index, tenantId: userId, vector, topK });
    }

    const textHits = textResp?.hits?.hits || [];
    const vectorHits = vectorResp?.hits?.hits || [];

    let finalHits = [];
    if (mode === 'text') finalHits = textHits;
    else if (mode === 'vector') finalHits = vectorHits;
    else finalHits = rrfMerge({ textHits, vectorHits, limit: topK });

    setCors(context, 'POST, OPTIONS');
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = {
      ok: true,
      mode,
      topK,
      hits: finalHits.map(toPublicHit)
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

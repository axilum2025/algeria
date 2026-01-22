function getElasticConfig() {
  // Azure App Service / Functions injecte souvent les app settings aussi sous forme APPSETTING_*.
  const url = String(process.env.ELASTICSEARCH_URL || process.env.APPSETTING_ELASTICSEARCH_URL || '').trim();
  const apiKey = String(process.env.ELASTICSEARCH_API_KEY || process.env.APPSETTING_ELASTICSEARCH_API_KEY || '').trim();
  const username = String(process.env.ELASTICSEARCH_USERNAME || process.env.APPSETTING_ELASTICSEARCH_USERNAME || '').trim();
  const password = String(process.env.ELASTICSEARCH_PASSWORD || process.env.APPSETTING_ELASTICSEARCH_PASSWORD || '').trim();
  const index = String(process.env.ELASTICSEARCH_INDEX || process.env.APPSETTING_ELASTICSEARCH_INDEX || 'axilum-user-docs').trim();
  const vectorDimsRaw = process.env.ELASTICSEARCH_VECTOR_DIMS || process.env.APPSETTING_ELASTICSEARCH_VECTOR_DIMS || 100;
  const vectorDims = Math.max(8, Number(vectorDimsRaw) || 100);

  return { url, apiKey, username, password, index, vectorDims };
}

function buildAuthHeader({ apiKey, username, password }) {
  if (apiKey) return `ApiKey ${apiKey}`;
  if (username) {
    const token = Buffer.from(`${username}:${password || ''}`).toString('base64');
    return `Basic ${token}`;
  }
  return null;
}

async function elasticRequest(path, { method = 'GET', body = null, headers = {}, contentType = null } = {}) {
  const cfg = getElasticConfig();
  if (!cfg.url) {
    const err = new Error('ELASTICSEARCH_URL manquant');
    err.code = 'ELASTIC_NOT_CONFIGURED';
    throw err;
  }

  const auth = buildAuthHeader(cfg);
  const h = Object.assign({}, headers);
  if (auth) h['Authorization'] = auth;
  h['Accept'] = 'application/json';

  let finalBody = body;
  if (body && typeof body === 'object' && !(body instanceof Buffer)) {
    finalBody = JSON.stringify(body);
    h['Content-Type'] = contentType || 'application/json';
  } else if (typeof body === 'string') {
    h['Content-Type'] = contentType || 'application/json';
  } else if (contentType) {
    h['Content-Type'] = contentType;
  }

  const url = `${cfg.url.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  const resp = await fetch(url, { method, headers: h, body: finalBody });

  const text = await resp.text();
  const json = text ? safeJsonParse(text) : null;

  if (!resp.ok) {
    const err = new Error(`Elasticsearch error ${resp.status}`);
    err.status = resp.status;
    err.details = json || text;
    throw err;
  }

  return json;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function ensureIndex(indexName, vectorDims) {
  const index = String(indexName || '').trim();
  if (!index) throw new Error('Index Elasticsearch vide');

  const dims = Math.max(8, Number(vectorDims) || 100);

  // HEAD index
  try {
    await elasticRequest(`/${encodeURIComponent(index)}`, { method: 'HEAD' });

    // Si l'index existe déjà, vérifier (best-effort) que les dims du champ dense_vector correspondent.
    // Sinon, l'indexation échouera avec un 400 du cluster.
    try {
      const mapping = await elasticRequest(`/${encodeURIComponent(index)}/_mapping`, { method: 'GET' });
      const props = mapping && mapping[index] && mapping[index].mappings && mapping[index].mappings.properties;
      const existingDims = props && props.content_vector && props.content_vector.dims;
      const existing = Number(existingDims);
      if (Number.isFinite(existing) && existing > 0 && existing !== dims) {
        const err = new Error(`ELASTICSEARCH_VECTOR_DIMS mismatch: index=${index} mapping.dims=${existing} config.dims=${dims}`);
        err.status = 400;
        err.code = 'ELASTIC_DIMS_MISMATCH';
        err.details = {
          hint: 'Supprimez et recréez l\'index (ou changez ELASTICSEARCH_VECTOR_DIMS pour correspondre). Un dense_vector ne peut pas changer de dims après création.',
          index,
          mappingDims: existing,
          configDims: dims
        };
        throw err;
      }
    } catch (e) {
      // Si la lecture du mapping échoue (droits, version), on n'empêche pas l'app de continuer.
      // L'erreur réelle de bulk index sera renvoyée plus bas.
      if (e && e.code === 'ELASTIC_DIMS_MISMATCH') throw e;
    }
    return { created: false, index };
  } catch (e) {
    if (e && e.status !== 404) throw e;
  }

  const mapping = {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0
    },
    mappings: {
      properties: {
        tenantId: { type: 'keyword' },
        documentId: { type: 'keyword' },
        chunkId: { type: 'integer' },
        title: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword', ignore_above: 256 }
          }
        },
        content: { type: 'text' },
        source: { type: 'keyword' },
        url: { type: 'keyword', ignore_above: 2048 },
        tags: { type: 'keyword' },
        createdAt: { type: 'date' },
        content_vector: {
          type: 'dense_vector',
          dims,
          index: true,
          similarity: 'cosine'
        }
      }
    }
  };

  await elasticRequest(`/${encodeURIComponent(index)}`, { method: 'PUT', body: mapping });
  return { created: true, index };
}

async function bulkIndex(indexName, operationsNdjson) {
  const index = String(indexName || '').trim();
  if (!index) throw new Error('Index Elasticsearch vide');

  const resp = await elasticRequest(`/${encodeURIComponent(index)}/_bulk?refresh=true`, {
    method: 'POST',
    body: operationsNdjson,
    contentType: 'application/x-ndjson'
  });

  const errors = !!resp?.errors;
  return { ok: !errors, took: resp?.took, errors, items: resp?.items || [] };
}

async function searchText({ indexName, tenantId, query, topK = 5 }) {
  const index = String(indexName || '').trim();
  const q = String(query || '').trim();
  const uid = String(tenantId || '').trim();

  const body = {
    size: Math.max(1, Math.min(50, Number(topK) || 5)),
    query: {
      bool: {
        filter: [{ term: { tenantId: uid } }],
        must: [
          {
            multi_match: {
              query: q,
              fields: ['title^2', 'content']
            }
          }
        ]
      }
    },
    highlight: {
      fields: {
        content: { fragment_size: 160, number_of_fragments: 2 }
      }
    }
  };

  return elasticRequest(`/${encodeURIComponent(index)}/_search`, { method: 'POST', body });
}

async function searchVector({ indexName, tenantId, vector, topK = 5 }) {
  const index = String(indexName || '').trim();
  const uid = String(tenantId || '').trim();
  const k = Math.max(1, Math.min(50, Number(topK) || 5));

  const body = {
    size: k,
    knn: {
      field: 'content_vector',
      query_vector: vector,
      k,
      num_candidates: Math.max(50, k * 10),
      filter: {
        term: { tenantId: uid }
      }
    }
  };

  return elasticRequest(`/${encodeURIComponent(index)}/_search`, { method: 'POST', body });
}

async function deleteByTenant({ indexName, tenantId }) {
  const index = String(indexName || '').trim();
  const uid = String(tenantId || '').trim();
  if (!index) throw new Error('Index Elasticsearch vide');
  if (!uid) throw new Error('tenantId vide');

  const body = {
    query: {
      term: { tenantId: uid }
    }
  };

  return elasticRequest(`/${encodeURIComponent(index)}/_delete_by_query?refresh=true&conflicts=proceed`, {
    method: 'POST',
    body
  });
}

function rrfMerge({ textHits = [], vectorHits = [], k = 60, limit = 10 }) {
  const scores = new Map();

  const add = (hits, sourceWeight = 1) => {
    hits.forEach((h, i) => {
      const id = h?._id;
      if (!id) return;
      const rank = i + 1;
      const s = sourceWeight * (1 / (k + rank));
      const prev = scores.get(id) || { score: 0, hit: h };
      scores.set(id, { score: prev.score + s, hit: prev.hit || h });
    });
  };

  add(textHits, 1);
  add(vectorHits, 1);

  return [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([, v]) => v.hit);
}

module.exports = {
  getElasticConfig,
  ensureIndex,
  bulkIndex,
  searchText,
  searchVector,
  deleteByTenant,
  rrfMerge
};

const { requireAuth, setCors } = require('../utils/auth');
const { getElasticConfig, ensureIndex, deleteByTenant } = require('../utils/elasticsearch');

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

    await ensureIndex(index, vectorDims);

    const result = await deleteByTenant({ indexName: index, tenantId: userId });

    setCors(context, 'POST, OPTIONS');
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = {
      ok: true,
      index,
      deleted: result.deleted || 0,
      took: result.took || null
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

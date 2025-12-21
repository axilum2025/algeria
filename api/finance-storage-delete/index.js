const { deleteBlob } = require('../utils/storage');

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
      context.res.body = { error: 'name requis' };
      return;
    }
    const ok = await deleteBlob(container, name);
    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { container, name, deleted: ok };
  } catch (err) {
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { error: err.message || String(err) };
  }
};

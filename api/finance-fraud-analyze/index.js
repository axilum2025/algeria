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
    const transactions = Array.isArray(req.body?.transactions) ? req.body.transactions : [];

    const alerts = [];
    const seen = new Map();

    // Rules: high amount, duplicate amount+vendor in short window, weekend transactions
    const HIGH_AMOUNT_THRESHOLD = 1000000; // 1M DZD/EUR (example)

    transactions.forEach((t, idx) => {
      const amount = Number(t.amount || 0);
      const vendor = String(t.vendor || '').trim().toLowerCase();
      const date = new Date(t.date || Date.now());

      if (amount >= HIGH_AMOUNT_THRESHOLD) {
        alerts.push({ type: 'HIGH_AMOUNT', index: idx, amount, vendor });
      }

      const key = `${vendor}|${amount}`;
      if (seen.has(key)) {
        alerts.push({ type: 'POTENTIAL_DUPLICATE', index: idx, amount, vendor, ref: seen.get(key) });
      } else {
        seen.set(key, idx);
      }

      const day = date.getDay();
      if (day === 0 || day === 6) {
        alerts.push({ type: 'WEEKEND_TX', index: idx, vendor, amount });
      }
    });

    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { alerts, count: alerts.length, rules: ['HIGH_AMOUNT', 'POTENTIAL_DUPLICATE', 'WEEKEND_TX'] };
  } catch (err) {
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { error: err.message || String(err) };
  }
};

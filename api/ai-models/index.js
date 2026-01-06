const { setCors } = require('../utils/auth');

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

module.exports = async function (context, req) {
  setCors(context, 'GET, OPTIONS');

  if (String(req.method || '').toUpperCase() === 'OPTIONS') {
    context.res = { status: 204, body: '' };
    return;
  }

  const pricingRaw = String(process.env.AI_PRICING_JSON || '').trim();
  const pricing = pricingRaw ? safeJsonParse(pricingRaw) : null;
  const pricingCurrency = String(process.env.AI_PRICING_CURRENCY || 'EUR').trim().toUpperCase() || 'EUR';

  const ids = pricing && typeof pricing === 'object' ? Object.keys(pricing) : [];
  ids.sort((a, b) => String(a).localeCompare(String(b)));

  const models = ids.map((id) => {
    const row = pricing && pricing[id] && typeof pricing[id] === 'object' ? pricing[id] : {};
    return {
      id: String(id),
      pricingCurrency,
      in: row.in != null ? Number(row.in) : null,
      out: row.out != null ? Number(row.out) : null
    };
  });

  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      ok: true,
      pricingCurrency,
      models
    }
  };
};

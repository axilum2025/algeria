const { setCors } = require('../utils/auth');

// Catalogue connu des modèles Groq (IDs tels que publiés par Groq au 2025-12)
const GROQ_MODEL_CATALOG = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'llama-3.2-90b-vision-preview',
  'llama-3.2-11b-vision-preview',
  'llama-3.2-3b-preview',
  'llama-3.2-1b-preview',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'whisper-large-v3',
  'distil-whisper-large-v3'
];

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function mergePricingWithCatalog(pricingObj, pricingCurrency) {
  const seen = new Set();
  const rows = [];

  if (pricingObj && typeof pricingObj === 'object') {
    Object.keys(pricingObj).forEach((id) => {
      const row = pricingObj[id] && typeof pricingObj[id] === 'object' ? pricingObj[id] : {};
      const cleanId = String(id || '').trim();
      if (!cleanId || seen.has(cleanId)) return;
      seen.add(cleanId);
      rows.push({
        id: cleanId,
        pricingCurrency,
        in: row.in != null ? Number(row.in) : null,
        out: row.out != null ? Number(row.out) : null
      });
    });
  }

  GROQ_MODEL_CATALOG.forEach((id) => {
    const cleanId = String(id || '').trim();
    if (!cleanId || seen.has(cleanId)) return;
    seen.add(cleanId);
    rows.push({ id: cleanId, pricingCurrency, in: null, out: null });
  });

  rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return rows;
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

  const models = mergePricingWithCatalog(pricing, pricingCurrency);

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

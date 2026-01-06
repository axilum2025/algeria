function corsJsonHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
    ...extra
  };
}

function readAdminKey(req) {
  const raw = req.headers?.['x-admin-key'] || req.headers?.['X-Admin-Key'] || '';
  return String(Array.isArray(raw) ? raw[0] : raw).trim();
}

function requireAdminIfConfigured(req) {
  const expected = String(process.env.ADMIN_API_KEY || '').trim();
  if (!expected) return { ok: true, enforced: false };

  const got = readAdminKey(req);
  if (got && got === expected) return { ok: true, enforced: true };

  return { ok: false, enforced: true };
}

function safeJsonParseWithError(value) {
  try {
    return { ok: true, value: JSON.parse(value), error: null };
  } catch (e) {
    return { ok: false, value: null, error: String(e?.message || e) };
  }
}

function previewSecret(raw, max = 80) {
  const s = String(raw || '');
  if (!s) return '';
  const trimmed = s.trim();
  if (!trimmed) return '';
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max) + '…';
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers: corsJsonHeaders() };
    return;
  }

  const admin = requireAdminIfConfigured(req);
  if (!admin.ok) {
    context.res = {
      status: 401,
      headers: corsJsonHeaders(),
      body: { error: 'Non autorisé' }
    };
    return;
  }

  const pricingRaw = String(process.env.AI_PRICING_JSON || '');
  const pricingTrimmed = pricingRaw.trim();

  const pricingCurrency = String(process.env.AI_PRICING_CURRENCY || 'EUR').trim().toUpperCase() || 'EUR';
  const costCurrency = String(process.env.AI_COST_CURRENCY || 'EUR').trim().toUpperCase() || 'EUR';
  const fxUsdToEur = String(process.env.AI_FX_USD_TO_EUR || '').trim();
  const creditEnforced = String(process.env.AI_CREDIT_ENFORCE || '').trim() === '1';

  let parsed = null;
  let parse = null;
  let modelIds = [];

  if (pricingTrimmed) {
    parse = safeJsonParseWithError(pricingTrimmed);
    parsed = parse.value;
    if (parse.ok && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      modelIds = Object.keys(parsed);
      modelIds.sort((a, b) => String(a).localeCompare(String(b)));
    }
  }

  context.res = {
    status: 200,
    headers: corsJsonHeaders(),
    body: {
      ok: true,
      adminKeyRequired: Boolean(String(process.env.ADMIN_API_KEY || '').trim()),
      creditEnforced,
      pricing: {
        present: Boolean(pricingTrimmed),
        length: pricingTrimmed.length,
        preview: previewSecret(pricingTrimmed),
        parseOk: parse ? Boolean(parse.ok) : null,
        parseError: parse && !parse.ok ? parse.error : null,
        type: parse && parse.ok ? (Array.isArray(parsed) ? 'array' : typeof parsed) : null,
        pricingCurrency,
        modelCount: modelIds.length,
        modelIds
      },
      cost: {
        costCurrency,
        fxUsdToEur: fxUsdToEur || null
      }
    }
  };
};

const { getMonthlyTotals, monthKeyFromDate } = require('../utils/aiUsageBudget');
const { estimateAzureOverheadEur, computeRetailPrice } = require('../utils/azureCostEstimator');

function corsJsonHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
    ...extra
  };
}

function parseNumber(value) {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? n : null;
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

  try {
    const mk = String(req.query?.month || '') || monthKeyFromDate();
    const totals = await getMonthlyTotals(mk);

    const overrides = (req.body && typeof req.body === 'object') ? (req.body.azure || req.body.overrides || {}) : {};

    const azureEstimate = estimateAzureOverheadEur({
      aiCalls: totals.totalCalls || 0,
      blobStorageGbMonth: parseNumber(overrides.blobStorageGbMonth) || 0,
      blobWrites: parseNumber(overrides.blobWrites) || 0,
      blobReads: parseNumber(overrides.blobReads) || 0,
      egressGb: parseNumber(overrides.egressGb) || 0,
      visionTransactions: parseNumber(overrides.visionTransactions) || 0,
      formRecognizerPages: parseNumber(overrides.formRecognizerPages) || 0,
      emailsSent: parseNumber(overrides.emailsSent) || 0
    });

    const aiCostEur = Number(totals.totalCost || 0);
    const azureCostEur = Number(azureEstimate.totalEur || 0);
    const totalCostEur = aiCostEur + azureCostEur;

    const marginPct = parseNumber(req.query?.marginPct) ?? parseNumber(process.env.PRICING_MARGIN_PCT) ?? 0.15;
    const fixedEur = parseNumber(req.query?.fixedEur) ?? parseNumber(process.env.PRICING_FIXED_EUR) ?? 0;

    const retail = computeRetailPrice({ costEur: totalCostEur, marginPct, fixedEur });

    context.res = {
      status: 200,
      headers: corsJsonHeaders(),
      body: {
        month: mk,
        adminKeyRequired: Boolean(String(process.env.ADMIN_API_KEY || '').trim()),
        ai: {
          totalCostEur: aiCostEur,
          totalTokens: Number(totals.totalTokens || 0),
          totalCalls: Number(totals.totalCalls || 0),
          currency: totals.currency || 'EUR'
        },
        azure: azureEstimate,
        totals: {
          totalCostEur,
          currency: 'EUR'
        },
        suggestedRetail: retail
      }
    };
  } catch (e) {
    context.log.error('admin-cost-estimate error', e);
    context.res = {
      status: 500,
      headers: corsJsonHeaders(),
      body: { error: e?.message || String(e) }
    };
  }
};

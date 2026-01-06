const crypto = require('crypto');
const { TableClient } = require('@azure/data-tables');

const USAGE_TABLE = 'AiUsage';
const MONTHLY_TABLE = 'AiUsageMonthly';

// In-memory fallback (dev/local) when Azure Table is not configured.
const memory = {
  monthly: Object.create(null), // { [monthKey]: { totalCost, totalTokens, totalCalls, currency } } (TOTAL)
  userMonthly: Object.create(null) // { [monthKey]: { [userRowKey]: { totalCost, totalTokens, totalCalls, currency } } }
};

let usageClient = null;
let monthlyClient = null;
let initPromise = null;

function getConnectionString() {
  return String(
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
      process.env.APPSETTING_AZURE_STORAGE_CONNECTION_STRING ||
      ''
  ).trim();
}

function parseNumber(value) {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? n : null;
}

function parsePricing() {
  const raw = String(process.env.AI_PRICING_JSON || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function getPricingCurrency() {
  return String(process.env.AI_PRICING_CURRENCY || '').trim().toUpperCase() || 'EUR';
}

function getCostCurrency() {
  // Currency in which we compute/bill costs (credit/budget). Defaults to EUR.
  return String(process.env.AI_COST_CURRENCY || process.env.AI_BUDGET_CURRENCY || '').trim().toUpperCase() || 'EUR';
}

function getUsdToEurRate() {
  const raw = String(process.env.AI_FX_USD_TO_EUR || '').trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function convertAmount(amount, fromCurrency, toCurrency) {
  const a = Number(amount);
  if (!Number.isFinite(a)) return null;
  const from = String(fromCurrency || '').toUpperCase();
  const to = String(toCurrency || '').toUpperCase();
  if (!from || !to || from === to) return a;

  // Minimal conversion support (needed because you provided Groq prices in USD)
  if (from === 'USD' && to === 'EUR') {
    const fx = getUsdToEurRate();
    if (!fx) return null;
    return a * fx;
  }

  return null;
}

function estimatePromptTokensFromMessages(messages) {
  // Estimation conservative: on sur-estime pour éviter de dépasser un crédit prépayé.
  // Heuristique simple: ~1 token / 3 chars + overhead par message.
  const arr = Array.isArray(messages) ? messages : [];
  let chars = 0;
  for (const m of arr) {
    const c = m && m.content != null ? String(m.content) : '';
    chars += c.length;
  }
  const approx = Math.ceil(chars / 3);
  const overhead = arr.length * 25;
  return Math.max(0, approx + overhead);
}

function estimateCostFromMessages({ model, messages, maxTokens }) {
  const { pricing, pricingCurrency, costCurrency } = getBudgetConfig();
  if (!pricing) return null;
  const m = String(model || '').trim();
  const row = pricing[m];
  if (!row || typeof row !== 'object') return null;

  const inRate = parseNumber(row.in);
  const outRate = parseNumber(row.out);
  if (inRate == null && outRate == null) return null;

  const promptTokens = estimatePromptTokensFromMessages(messages);
  const completionTokens = Math.max(0, Number(maxTokens || 0));

  const inCost = inRate == null ? 0 : (promptTokens / 1_000_000) * inRate;
  const outCost = outRate == null ? 0 : (completionTokens / 1_000_000) * outRate;
  const total = inCost + outCost;
  return convertAmount(total, pricingCurrency, costCurrency);
}

function eurosToCents(amountEur) {
  const n = Number(amountEur || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.round(n * 100));
}

function getBudgetConfig() {
  const budget =
    parseNumber(process.env.AI_BUDGET_MONTHLY) ??
    parseNumber(process.env.AI_BUDGET_MONTHLY_USD) ??
    parseNumber(process.env.AI_BUDGET_MONTHLY_EUR) ??
    parseNumber(process.env.AI_BUDGET_MONTHLY_DZD);

  const currency =
    String(process.env.AI_BUDGET_CURRENCY || '').trim() ||
    (process.env.AI_BUDGET_MONTHLY_DZD ? 'DZD' : process.env.AI_BUDGET_MONTHLY_EUR ? 'EUR' : 'USD');

  const pricing = parsePricing();

  // Pricing might be in USD; we compute costs in costCurrency (default EUR)
  const pricingCurrency = getPricingCurrency();
  const costCurrency = getCostCurrency();

  return { budget, currency, pricing, pricingCurrency, costCurrency };
}

function monthKeyFromDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function safeKeyPart(s) {
  return String(s || '')
    .trim()
    .replace(/[\\/#?]/g, '_')
    .slice(0, 220);
}

function makeRowKey() {
  const ts = new Date().toISOString().replace(/[:]/g, '_');
  const rnd = crypto.randomBytes(6).toString('hex');
  return `ts_${ts}_${rnd}`;
}

function secondsUntilNextMonthUtc() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const next = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  const diffMs = Math.max(0, next.getTime() - now.getTime());
  return Math.ceil(diffMs / 1000);
}

function isPreconditionFailed(err) {
  const status = Number(err?.statusCode || err?.status || 0);
  const code = String(err?.code || '').toLowerCase();
  return status === 412 || code.includes('condition');
}

async function ensureInit() {
  const conn = getConnectionString();
  if (!conn) return { usageClient: null, monthlyClient: null };

  if (usageClient && monthlyClient) return { usageClient, monthlyClient };
  if (initPromise) {
    await initPromise;
    return { usageClient, monthlyClient };
  }

  initPromise = (async () => {
    usageClient = TableClient.fromConnectionString(conn, USAGE_TABLE);
    monthlyClient = TableClient.fromConnectionString(conn, MONTHLY_TABLE);
    await Promise.all([
      usageClient.createTable().catch(() => {}),
      monthlyClient.createTable().catch(() => {})
    ]);
  })();

  await initPromise;
  return { usageClient, monthlyClient };
}

class BudgetExceededError extends Error {
  constructor({ used, limit, currency }) {
    super(`Budget mensuel dépassé (${used.toFixed(4)} / ${limit.toFixed(4)} ${currency})`);
    this.name = 'BudgetExceededError';
    this.code = 'BUDGET_EXCEEDED';
    this.status = 429;
    this.used = used;
    this.limit = limit;
    this.currency = currency;
    this.retryAfterSeconds = secondsUntilNextMonthUtc();
  }
}

async function getMonthlyTotals(monthKey) {
  const mk = String(monthKey || monthKeyFromDate());
  const { monthlyClient: client } = await ensureInit();

  if (!client) {
    const bucket = memory.monthly[mk];
    if (!bucket) return { totalCost: 0, totalTokens: 0, currency: null };
    return {
      totalCost: Number(bucket.totalCost || 0),
      totalTokens: Number(bucket.totalTokens || 0),
      totalCalls: Number(bucket.totalCalls || 0),
      currency: bucket.currency || null
    };
  }

  try {
    const entity = await client.getEntity(`m_${mk}`, 'TOTAL');
    return {
      totalCost: Number(entity.totalCost || 0),
      totalTokens: Number(entity.totalTokens || 0),
      totalCalls: Number(entity.totalCalls || 0),
      currency: entity.currency ? String(entity.currency) : null
    };
  } catch (_) {
    return { totalCost: 0, totalTokens: 0, totalCalls: 0, currency: null };
  }
}

async function getUserMonthlyTotals(userId, monthKey) {
  const mk = String(monthKey || monthKeyFromDate());
  const uid = safeKeyPart(userId || 'anonymous');
  const userRowKey = `u_${uid}`;
  const { monthlyClient: client } = await ensureInit();

  if (!client) {
    const bucket = memory.userMonthly[mk] && memory.userMonthly[mk][userRowKey];
    if (!bucket) return { totalCost: 0, totalTokens: 0, totalCalls: 0, currency: null };
    return {
      totalCost: Number(bucket.totalCost || 0),
      totalTokens: Number(bucket.totalTokens || 0),
      totalCalls: Number(bucket.totalCalls || 0),
      currency: bucket.currency || null
    };
  }

  try {
    const entity = await client.getEntity(`m_${mk}`, userRowKey);
    return {
      totalCost: Number(entity.totalCost || 0),
      totalTokens: Number(entity.totalTokens || 0),
      totalCalls: Number(entity.totalCalls || 0),
      currency: entity.currency ? String(entity.currency) : null
    };
  } catch (_) {
    return { totalCost: 0, totalTokens: 0, totalCalls: 0, currency: null };
  }
}

async function assertWithinBudget({ provider = 'Groq', route = '', userId = '' } = {}) {
  const { budget, currency } = getBudgetConfig();
  if (!budget || budget <= 0) return { ok: true, enforced: false };

  const mk = monthKeyFromDate();
  const totals = await getMonthlyTotals(mk);
  const used = Number(totals.totalCost || 0);

  if (used >= budget) {
    throw new BudgetExceededError({ used, limit: budget, currency });
  }

  return {
    ok: true,
    enforced: true,
    month: mk,
    used,
    limit: budget,
    currency,
    provider,
    route,
    userId
  };
}

function computeCostFromUsage({ model, usage }) {
  const { pricing, pricingCurrency, costCurrency } = getBudgetConfig();
  if (!pricing) return null;

  const m = String(model || '').trim();
  const row = pricing[m];
  if (!row || typeof row !== 'object') return null;

  const inRate = parseNumber(row.in);
  const outRate = parseNumber(row.out);
  if (inRate == null && outRate == null) return null;

  const prompt = Number(usage?.prompt_tokens || 0);
  const completion = Number(usage?.completion_tokens || 0);

  const inCost = inRate == null ? 0 : (prompt / 1_000_000) * inRate;
  const outCost = outRate == null ? 0 : (completion / 1_000_000) * outRate;
  const total = inCost + outCost;
  return convertAmount(total, pricingCurrency, costCurrency);
}

async function incrementMonthlyTotals({ monthKey, rowKey = 'TOTAL', addCost, addTokens, addCalls, currency }) {
  const mk = String(monthKey || monthKeyFromDate());
  const { monthlyClient: client } = await ensureInit();

  const rk = String(rowKey || 'TOTAL');

  if (!client) {
    if (rk === 'TOTAL') {
      const existing = memory.monthly[mk] || { totalCost: 0, totalTokens: 0, totalCalls: 0, currency: currency || null };
      existing.totalCost = Number(existing.totalCost || 0) + Number(addCost || 0);
      existing.totalTokens = Number(existing.totalTokens || 0) + Number(addTokens || 0);
      existing.totalCalls = Number(existing.totalCalls || 0) + Number(addCalls || 0);
      if (currency) existing.currency = currency;
      memory.monthly[mk] = existing;
      return;
    }

    const m = (memory.userMonthly[mk] = memory.userMonthly[mk] || Object.create(null));
    const existing = m[rk] || { totalCost: 0, totalTokens: 0, totalCalls: 0, currency: currency || null };
    existing.totalCost = Number(existing.totalCost || 0) + Number(addCost || 0);
    existing.totalTokens = Number(existing.totalTokens || 0) + Number(addTokens || 0);
    existing.totalCalls = Number(existing.totalCalls || 0) + Number(addCalls || 0);
    if (currency) existing.currency = currency;
    m[rk] = existing;
    return;
  }

  const partitionKey = `m_${mk}`;
  const rowKeySafe = rk;

  // Optimistic concurrency to avoid lost updates.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let entity;
      try {
        entity = await client.getEntity(partitionKey, rowKeySafe);
      } catch (_) {
        entity = {
          partitionKey,
          rowKey: rowKeySafe,
          totalCost: 0,
          totalTokens: 0,
          totalCalls: 0,
          currency: currency || '',
          updatedAt: new Date().toISOString()
        };
        await client.upsertEntity(entity);
        entity = await client.getEntity(partitionKey, rowKeySafe);
      }

      const next = {
        partitionKey,
        rowKey: rowKeySafe,
        totalCost: Number(entity.totalCost || 0) + Number(addCost || 0),
        totalTokens: Number(entity.totalTokens || 0) + Number(addTokens || 0),
        totalCalls: Number(entity.totalCalls || 0) + Number(addCalls || 0),
        currency: currency || String(entity.currency || ''),
        updatedAt: new Date().toISOString()
      };

      await client.updateEntity(next, 'Replace', { etag: entity.etag });
      return;
    } catch (e) {
      if (isPreconditionFailed(e)) continue;
      throw e;
    }
  }
}

async function recordUsage({
  provider = 'Groq',
  model,
  route = '',
  userId = '',
  usage,
  latencyMs = null,
  ok = true
} = {}) {
  const mk = monthKeyFromDate();
  const { currency, costCurrency } = getBudgetConfig();

  const promptTokens = Number(usage?.prompt_tokens || 0);
  const completionTokens = Number(usage?.completion_tokens || 0);
  const totalTokens = Number(usage?.total_tokens || promptTokens + completionTokens || 0);
  const cost = computeCostFromUsage({ model, usage });

  // Prefer costCurrency for stored cost (ex: EUR after conversion), fallback to budget currency
  const storedCurrency = costCurrency || currency;

  const { usageClient: client } = await ensureInit();

  // 1) Write detailed usage (best-effort)
  if (client) {
    try {
      const entity = {
        partitionKey: `m_${mk}`,
        rowKey: makeRowKey(),
        provider: String(provider || ''),
        model: safeKeyPart(model),
        route: safeKeyPart(route),
        userId: safeKeyPart(userId || 'anonymous'),
        promptTokens,
        completionTokens,
        totalTokens,
        cost: cost == null ? '' : Number(cost),
        currency: String(storedCurrency || ''),
        latencyMs: latencyMs == null ? '' : Number(latencyMs),
        ok: ok ? '1' : '0',
        createdAt: new Date().toISOString()
      };
      await client.upsertEntity(entity);
    } catch (_) {
      // ignore: do not break user flow
    }
  }

  // 2) Update monthly aggregates (enables fast budget checks)
  if (cost != null || totalTokens) {
    try {
      await incrementMonthlyTotals({
        monthKey: mk,
        rowKey: 'TOTAL',
        addCost: cost == null ? 0 : cost,
        addTokens: totalTokens,
        addCalls: 1,
        currency: storedCurrency
      });
    } catch (_) {
      // ignore
    }

    // 3) Update per-user aggregates (enables user dashboard)
    try {
      const userRowKey = `u_${safeKeyPart(userId || 'anonymous')}`;
      await incrementMonthlyTotals({
        monthKey: mk,
        rowKey: userRowKey,
        addCost: cost == null ? 0 : cost,
        addTokens: totalTokens,
        addCalls: 1,
        currency: storedCurrency
      });
    } catch (_) {
      // ignore
    }
  }

  return {
    month: mk,
    provider,
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    cost,
    currency: storedCurrency
  };
}

module.exports = {
  BudgetExceededError,
  assertWithinBudget,
  estimateCostFromMessages,
  eurosToCents,
  computeCostFromUsage,
  recordUsage,
  getMonthlyTotals,
  getUserMonthlyTotals,
  monthKeyFromDate
};

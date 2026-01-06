const { TableClient } = require('@azure/data-tables');
const { setCors, getAuthEmail } = require('../utils/auth');
const { getCredit } = require('../utils/userCredits');
const { monthKeyFromDate, getUserMonthlyTotals } = require('../utils/aiUsageBudget');

const USAGE_TABLE = 'AiUsage';

function getConnectionString() {
  return String(
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
      process.env.APPSETTING_AZURE_STORAGE_CONNECTION_STRING ||
      ''
  ).trim();
}

function safeKeyPart(s) {
  return String(s || '')
    .trim()
    .replace(/[\\/#?]/g, '_')
    .slice(0, 220);
}

function escapeODataString(value) {
  return String(value || '').replace(/'/g, "''");
}

function normalizeLimit(n, def = 25, min = 1, max = 100) {
  const num = Number(n);
  if (!Number.isFinite(num)) return def;
  return Math.min(max, Math.max(min, Math.floor(num)));
}

module.exports = async function (context, req) {
  setCors(context, 'GET, OPTIONS');

  if (String(req.method || '').toUpperCase() === 'OPTIONS') {
    context.res = { status: 204, body: '' };
    return;
  }

  try {
    const email = getAuthEmail(req);
    const fallbackUserId = String((req.query && (req.query.userId || req.query.uid)) || '').trim();
    const userId = email || fallbackUserId || 'guest';

    const month = String((req.query && (req.query.month || req.query.monthKey)) || '').trim() || monthKeyFromDate();
    const currency = String((req.query && req.query.currency) || 'EUR').trim().toUpperCase() || 'EUR';
    const limit = normalizeLimit(req.query && (req.query.limit || req.query.n), 25, 1, 100);

    const credit = await getCredit(userId, { currency }).catch(() => ({ balanceCents: 0, currency }));
    const balanceCents = Number(credit?.balanceCents || 0);
    const balanceEur = Math.round(balanceCents) / 100;

    const totals = await getUserMonthlyTotals(userId, month);

    const conn = getConnectionString();
    let items = [];

    if (conn) {
      const client = TableClient.fromConnectionString(conn, USAGE_TABLE);
      const partitionKey = `m_${month}`;
      const userKey = safeKeyPart(userId || 'anonymous');
      const filter = `PartitionKey eq '${escapeODataString(partitionKey)}' and userId eq '${escapeODataString(userKey)}'`;

      const rows = [];
      for await (const entity of client.listEntities({
        queryOptions: {
          filter,
          select: ['provider', 'model', 'route', 'promptTokens', 'completionTokens', 'totalTokens', 'cost', 'currency', 'latencyMs', 'ok', 'createdAt']
        }
      })) {
        rows.push(entity);
      }

      rows.sort((a, b) => {
        const da = String(a.createdAt || '');
        const db = String(b.createdAt || '');
        return db.localeCompare(da);
      });

      items = rows.slice(0, limit).map(e => {
        const costRaw = e.cost;
        const cost = costRaw === '' || costRaw == null ? null : Number(costRaw);
        return {
          createdAt: e.createdAt ? String(e.createdAt) : null,
          provider: e.provider ? String(e.provider) : null,
          model: e.model ? String(e.model) : null,
          route: e.route ? String(e.route) : null,
          promptTokens: Number(e.promptTokens || 0),
          completionTokens: Number(e.completionTokens || 0),
          totalTokens: Number(e.totalTokens || 0),
          cost,
          currency: e.currency ? String(e.currency) : null,
          latencyMs: e.latencyMs === '' || e.latencyMs == null ? null : Number(e.latencyMs),
          ok: String(e.ok || '') === '1'
        };
      });
    }

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        ok: true,
        month,
        userId: email || (fallbackUserId || null),
        credit: {
          currency,
          balanceCents,
          balanceEur
        },
        totals: {
          currency: totals.currency || null,
          totalCost: Number(totals.totalCost || 0),
          totalTokens: Number(totals.totalTokens || 0),
          totalCalls: Number(totals.totalCalls || 0)
        },
        items
      }
    };
  } catch (err) {
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { ok: false, error: String(err?.message || err) }
    };
  }
};

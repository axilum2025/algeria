const { TableClient } = require('@azure/data-tables');

const TABLE_NAME = 'UserCredits';

// In-memory fallback when Azure Table is not configured
const memory = Object.create(null); // { [partitionKey]: { balanceCents, currency } }

let tableClient = null;
let initPromise = null;

function getConnectionString() {
  return String(
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
      process.env.APPSETTING_AZURE_STORAGE_CONNECTION_STRING ||
      ''
  ).trim();
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makePartitionKey(userId) {
  return `u_${base64UrlEncode(String(userId || 'guest').toLowerCase())}`;
}

function makeEntity(userId, balanceCents, currency) {
  return {
    partitionKey: makePartitionKey(userId),
    rowKey: 'BALANCE',
    balanceCents: Number(balanceCents || 0),
    currency: String(currency || 'EUR'),
    updatedAt: new Date().toISOString()
  };
}

async function getClient() {
  const conn = getConnectionString();
  if (!conn) return null;

  if (tableClient) return tableClient;
  if (initPromise) {
    await initPromise;
    return tableClient;
  }

  initPromise = (async () => {
    tableClient = TableClient.fromConnectionString(conn, TABLE_NAME);
    await tableClient.createTable().catch(() => {});
  })();

  await initPromise;
  return tableClient;
}

function isPreconditionFailed(err) {
  const status = Number(err?.statusCode || err?.status || 0);
  const code = String(err?.code || '').toLowerCase();
  return status === 412 || code.includes('condition');
}

class InsufficientCreditError extends Error {
  constructor({ remainingCents, currency }) {
    const eur = (Number(remainingCents || 0) / 100).toFixed(2);
    super(`Crédit insuffisant (${eur} ${currency})`);
    this.name = 'InsufficientCreditError';
    this.code = 'INSUFFICIENT_CREDIT';
    this.status = 402;
    this.remainingCents = Number(remainingCents || 0);
    this.currency = String(currency || 'EUR');
  }
}

async function getCredit(userId, { currency = 'EUR' } = {}) {
  const uid = String(userId || '').trim();
  if (!uid) return { balanceCents: 0, currency };

  const client = await getClient();
  const partitionKey = makePartitionKey(uid);

  if (!client) {
    const entry = memory[partitionKey];
    return {
      balanceCents: Number(entry?.balanceCents || 0),
      currency: entry?.currency || currency
    };
  }

  try {
    const entity = await client.getEntity(partitionKey, 'BALANCE');
    return {
      balanceCents: Number(entity.balanceCents || 0),
      currency: String(entity.currency || currency)
    };
  } catch (_) {
    return { balanceCents: 0, currency };
  }
}

async function setCredit(userId, balanceCents, { currency = 'EUR' } = {}) {
  const uid = String(userId || '').trim();
  if (!uid) return null;

  const client = await getClient();
  const entity = makeEntity(uid, balanceCents, currency);

  if (!client) {
    memory[entity.partitionKey] = { balanceCents: Number(entity.balanceCents || 0), currency: entity.currency };
    return { balanceCents: Number(entity.balanceCents || 0), currency: entity.currency };
  }

  await client.upsertEntity(entity);
  return { balanceCents: Number(entity.balanceCents || 0), currency: entity.currency };
}

async function debitCredit(userId, amountCents, { currency = 'EUR', allowPartial = false } = {}) {
  const uid = String(userId || '').trim();
  if (!uid) throw new InsufficientCreditError({ remainingCents: 0, currency });

  const debit = Math.max(0, Number(amountCents || 0));
  const client = await getClient();
  const partitionKey = makePartitionKey(uid);

  if (!client) {
    const entry = memory[partitionKey] || { balanceCents: 0, currency };
    const current = Number(entry.balanceCents || 0);
    if (current < debit && !allowPartial) throw new InsufficientCreditError({ remainingCents: current, currency: entry.currency || currency });
    const next = allowPartial ? Math.max(0, current - debit) : (current - debit);
    memory[partitionKey] = { balanceCents: next, currency: entry.currency || currency };
    return { balanceCents: next, currency: entry.currency || currency, debitedCents: Math.min(debit, current) };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    let entity;
    try {
      entity = await client.getEntity(partitionKey, 'BALANCE');
    } catch (_) {
      entity = makeEntity(uid, 0, currency);
      await client.upsertEntity(entity);
      entity = await client.getEntity(partitionKey, 'BALANCE');
    }

    const current = Number(entity.balanceCents || 0);
    const curCurrency = String(entity.currency || currency);

    if (current < debit && !allowPartial) throw new InsufficientCreditError({ remainingCents: current, currency: curCurrency });

    const next = allowPartial ? Math.max(0, current - debit) : (current - debit);
    const updated = {
      partitionKey,
      rowKey: 'BALANCE',
      balanceCents: next,
      currency: curCurrency,
      updatedAt: new Date().toISOString()
    };

    try {
      await client.updateEntity(updated, 'Replace', { etag: entity.etag });
      return { balanceCents: next, currency: curCurrency, debitedCents: Math.min(debit, current) };
    } catch (e) {
      if (isPreconditionFailed(e)) continue;
      throw e;
    }
  }

  // If concurrency keeps failing, treat as insufficient for safety
  const latest = await getCredit(uid, { currency });
  throw new InsufficientCreditError({ remainingCents: latest.balanceCents, currency: latest.currency });
}

module.exports = {
  InsufficientCreditError,
  getCredit,
  setCredit,
  debitCredit
};

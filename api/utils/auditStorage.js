const crypto = require('crypto');
const { TableClient } = require('@azure/data-tables');

let tableClient = null;

function getTableClient() {
  if (tableClient) return tableClient;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) return null;

  tableClient = TableClient.fromConnectionString(connectionString, 'AuditEvents');
  tableClient.createTable().catch(() => {});
  return tableClient;
}

function safeKeyPart(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .slice(0, 180);
}

function makeRowKey() {
  const ts = new Date().toISOString();
  const rnd = crypto.randomBytes(6).toString('hex');
  return `ts_${ts}_${rnd}`.replace(/[:]/g, '_');
}

async function appendAuditEvent({ email, action, status, plan, meta }) {
  const client = getTableClient();
  if (!client) return null;

  const userPart = email ? safeKeyPart(email) : 'guest';
  const partitionKey = `audit_user_${userPart}`;
  const rowKey = makeRowKey();

  const entity = {
    partitionKey,
    rowKey,
    email: email || 'guest',
    action: String(action || ''),
    status: String(status || ''),
    plan: String(plan || ''),
    meta: meta ? JSON.stringify(meta) : '',
    createdAt: new Date().toISOString()
  };

  await client.upsertEntity(entity);
  return { partitionKey, rowKey };
}

module.exports = {
  appendAuditEvent
};

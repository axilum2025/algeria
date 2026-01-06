const { TableClient } = require('@azure/data-tables');

// Minimal persistent storage for ToDo tasks using Azure Table Storage.
// Falls back to in-memory storage when AZURE_STORAGE_CONNECTION_STRING is not configured.

const TABLE_NAME = 'TodoTasks';

// In-memory fallback: { [partitionKey]: { [rowKey]: entity } }
const memory = Object.create(null);

let tableClient = null;

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
  // Azure Table keys disallow: / \ # ?
  // Encoding keeps it stable and avoids surprises.
  return `u_${base64UrlEncode(String(userId || 'default').toLowerCase())}`;
}

function makeRowKey(taskId) {
  return `t_${base64UrlEncode(String(taskId || ''))}`;
}

function parseRowKey(rowKey) {
  // We don’t need to decode task id for reads; we store original id in payload.
  return String(rowKey || '');
}

function getClient() {
  if (tableClient) return tableClient;
  const conn = getConnectionString();
  if (!conn) return null;
  tableClient = TableClient.fromConnectionString(conn, TABLE_NAME);
  tableClient.createTable().catch(() => {});
  return tableClient;
}

function toEntity(userId, task) {
  const t = task && typeof task === 'object' ? task : {};
  const id = String(t.id || '').trim();
  const partitionKey = makePartitionKey(userId);
  const rowKey = makeRowKey(id || `${Date.now()}_${Math.random().toString(36).slice(2)}`);

  return {
    partitionKey,
    rowKey,
    taskJson: JSON.stringify(t),
    updatedAt: String(t.updatedAt || new Date().toISOString()),
    status: String(t.status || ''),
    priority: String(t.priority || ''),
    deadline: t.deadline == null ? '' : String(t.deadline)
  };
}

function entityToTask(entity) {
  if (!entity) return null;
  try {
    const parsed = JSON.parse(String(entity.taskJson || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function listTasks(userId) {
  const client = getClient();
  const partitionKey = makePartitionKey(userId);

  if (!client) {
    const bucket = memory[partitionKey];
    if (!bucket) return [];
    return Object.values(bucket)
      .map(entityToTask)
      .filter(Boolean);
  }

  const tasks = [];
  const entities = client.listEntities({
    queryOptions: {
      filter: `PartitionKey eq '${partitionKey}'`,
      select: ['taskJson', 'updatedAt', 'rowKey']
    }
  });

  for await (const entity of entities) {
    const t = entityToTask(entity);
    if (t) tasks.push(t);
  }

  return tasks;
}

async function upsertTask(userId, task) {
  const client = getClient();
  const entity = toEntity(userId, task);

  if (!client) {
    const pk = entity.partitionKey;
    memory[pk] = memory[pk] || Object.create(null);
    memory[pk][entity.rowKey] = entity;
    return true;
  }

  await client.upsertEntity(entity, 'Replace');
  return true;
}

async function deleteTask(userId, taskId) {
  const client = getClient();
  const partitionKey = makePartitionKey(userId);
  const rowKey = makeRowKey(String(taskId || ''));

  if (!client) {
    const bucket = memory[partitionKey];
    if (bucket) delete bucket[rowKey];
    return true;
  }

  try {
    await client.deleteEntity(partitionKey, rowKey);
  } catch (_) {
    // If it doesn't exist, behave like idempotent delete.
  }
  return true;
}

async function replaceAllTasks(userId, tasks) {
  const client = getClient();
  const partitionKey = makePartitionKey(userId);

  if (!client) {
    memory[partitionKey] = Object.create(null);
    const arr = Array.isArray(tasks) ? tasks : [];
    for (const t of arr) {
      const entity = toEntity(userId, t);
      memory[partitionKey][entity.rowKey] = entity;
    }
    return true;
  }

  // Delete existing
  const existing = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${partitionKey}'`, select: ['partitionKey', 'rowKey'] }
  });
  for await (const e of existing) {
    try {
      await client.deleteEntity(e.partitionKey, e.rowKey);
    } catch (_) {}
  }

  // Insert new
  const arr = Array.isArray(tasks) ? tasks : [];
  for (const t of arr) {
    const entity = toEntity(userId, t);
    await client.upsertEntity(entity, 'Replace');
  }

  return true;
}

module.exports = {
  listTasks,
  upsertTask,
  deleteTask,
  replaceAllTasks,
  makePartitionKey,
  makeRowKey,
  parseRowKey
};

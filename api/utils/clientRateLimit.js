const crypto = require('crypto');
const { TableClient } = require('@azure/data-tables');

// Simple in-memory rate limiter (best-effort). In serverless, this is per-instance.
const buckets = new Map();

let tableClient = null;

function getConnectionString() {
  return process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.APPSETTING_AZURE_STORAGE_CONNECTION_STRING;
}

function getRateLimitTableClient() {
  if (tableClient) return tableClient;

  const cs = getConnectionString();
  if (!cs) return null;

  const tableName = String(process.env.RATE_LIMIT_TABLE_NAME || 'RateLimits').trim() || 'RateLimits';
  tableClient = TableClient.fromConnectionString(cs, tableName);
  tableClient.createTable().catch(() => { });
  return tableClient;
}

function cleanupExpired(now = Date.now()) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets.entries()) {
    if (!bucket || bucket.resetAt <= now) buckets.delete(key);
  }
}

function hashIdentifier(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function parsePartitionKey(key) {
  const k = String(key || '');
  const parts = k.split(':').filter(Boolean);
  // Example keys: "verifyCode:ip:<hash>", "verifyEmail:token:<hash>"
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  if (parts.length >= 1) return parts[0];
  return 'generic';
}

function getClientIp(req) {
  const header = req && req.headers ? (req.headers['x-forwarded-for'] || req.headers['x-client-ip']) : '';
  if (header) {
    // x-forwarded-for can be a list: client, proxy1, proxy2
    return String(header).split(',')[0].trim();
  }
  return (req && req.socket && req.socket.remoteAddress) ? String(req.socket.remoteAddress) : 'unknown';
}

function rateLimitMemory({ key, limit, windowMs }) {
  const now = Date.now();
  cleanupExpired(now);

  const k = String(key);
  const max = Number(limit);
  const win = Number(windowMs);
  if (!k || !Number.isFinite(max) || max <= 0 || !Number.isFinite(win) || win <= 0) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  let bucket = buckets.get(k);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + win };
  }

  bucket.count += 1;
  buckets.set(k, bucket);

  if (bucket.count > max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

async function rateLimitAzureTable({ key, limit, windowMs }) {
  const client = getRateLimitTableClient();
  if (!client) {
    return rateLimitMemory({ key, limit, windowMs });
  }

  const now = Date.now();
  const k = String(key);
  const max = Number(limit);
  const win = Number(windowMs);
  if (!k || !Number.isFinite(max) || max <= 0 || !Number.isFinite(win) || win <= 0) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Avoid storing raw identifiers/PII in the table.
  const partitionKey = parsePartitionKey(k);
  const rowKey = hashIdentifier(k);

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let entity = null;
    try {
      entity = await client.getEntity(partitionKey, rowKey);
    } catch (e) {
      entity = null;
    }

    let count = 0;
    let resetAt = 0;
    let etag = undefined;
    if (entity) {
      count = Number(entity.count || 0);
      resetAt = Number(entity.resetAt || 0);
      etag = entity.etag;
    }

    if (!resetAt || resetAt <= now) {
      count = 0;
      resetAt = now + win;
    }

    count += 1;
    const allowed = count <= max;

    const toWrite = {
      partitionKey,
      rowKey,
      count,
      resetAt,
      updatedAt: new Date()
    };

    try {
      if (entity) {
        // Concurrency-safe update with optimistic concurrency (etag)
        await client.updateEntity(toWrite, 'Merge', { etag });
      } else {
        await client.createEntity(toWrite);
      }

      if (!allowed) {
        return { allowed: false, retryAfterSeconds: Math.ceil((resetAt - now) / 1000) };
      }
      return { allowed: true, retryAfterSeconds: 0 };
    } catch (e) {
      // 412/409 => conflict; retry
      const code = String(e && (e.statusCode || e.code) || '');
      const msg = String(e && e.message || '');
      const isConflict = code === '412' || code === '409' || msg.includes('PreconditionFailed') || msg.includes('ConditionNotMet') || msg.includes('Conflict');
      if (attempt < maxRetries - 1 && isConflict) {
        continue;
      }

      // Fall back to memory if table is unavailable/erroring.
      return rateLimitMemory({ key, limit, windowMs });
    }
  }

  return rateLimitMemory({ key, limit, windowMs });
}

async function rateLimit({ key, limit, windowMs }) {
  const enabled = String(process.env.RATE_LIMIT_TABLE_ENABLED || 'true').toLowerCase() !== 'false';
  if (enabled && getConnectionString()) {
    return await rateLimitAzureTable({ key, limit, windowMs });
  }
  return rateLimitMemory({ key, limit, windowMs });
}

module.exports = {
  getClientIp,
  hashIdentifier,
  rateLimit
};

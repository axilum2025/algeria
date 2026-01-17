const { TableClient } = require('@azure/data-tables');
const { setCors } = require('../utils/auth');

function getAdminKey(req) {
  return String((req.headers && (req.headers['x-admin-api-key'] || req.headers['X-Admin-Api-Key'])) || '').trim();
}

function isValidAdminKey(req) {
  const expected = String(process.env.ADMIN_API_KEY || '').trim();
  if (!expected) return false;
  return getAdminKey(req) === expected;
}

function getConnectionString() {
  return process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.APPSETTING_AZURE_STORAGE_CONNECTION_STRING;
}

module.exports = async function (context, req) {
  setCors(context, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    context.res = { status: 200, body: '' };
    return;
  }

  try {
    const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    const enabled = String(process.env.RATE_LIMIT_CLEANUP_ENABLED || '').trim() === '1';

    if (isProd && !enabled) {
      context.res = { status: 404, body: 'Not found' };
      return;
    }

    // Require admin API key in prod (and also whenever ADMIN_API_KEY is configured)
    const expectedKey = String(process.env.ADMIN_API_KEY || '').trim();
    if ((isProd || expectedKey) && !isValidAdminKey(req)) {
      context.res = { status: 401, headers: { 'Content-Type': 'application/json' }, body: { error: 'Unauthorized' } };
      return;
    }

    const cs = getConnectionString();
    if (!cs) {
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'AZURE_STORAGE_CONNECTION_STRING manquant' } };
      return;
    }

    const tableName = String(process.env.RATE_LIMIT_TABLE_NAME || 'RateLimits').trim() || 'RateLimits';
    const client = TableClient.fromConnectionString(cs, tableName);

    const now = Date.now();
    const maxToDelete = Math.min(5000, Math.max(1, Number(req.body?.maxToDelete ?? req.query?.maxToDelete ?? 500)));
    const dryRun = String(req.body?.dryRun ?? req.query?.dryRun ?? '').trim() === '1';
    const continuationToken = req.body?.continuationToken || req.query?.continuationToken;

    let deleted = 0;
    let scanned = 0;
    let nextToken = null;

    // Try server-side filtering; if it errors, fallback to client-side filtering.
    let useServerFilter = true;

    const listPage = async (filter) => {
      return client.listEntities({ queryOptions: filter ? { filter } : undefined }).byPage({
        maxPageSize: 200,
        continuationToken
      });
    };

    try {
      // resetAt is stored as a number; OData numeric comparison should work.
      const filter = `resetAt lt ${now}`;
      for await (const page of await listPage(filter)) {
        nextToken = page.continuationToken || null;
        for (const entity of page) {
          scanned += 1;
          const pk = entity.partitionKey ?? entity.PartitionKey;
          const rk = entity.rowKey ?? entity.RowKey;
          if (!pk || !rk) continue;

          if (!dryRun) {
            try {
              await client.deleteEntity(pk, rk);
              deleted += 1;
            } catch (_) {
              // ignore individual deletion errors
            }
          } else {
            deleted += 1;
          }

          if (deleted >= maxToDelete) {
            context.res = {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
              body: { success: true, tableName, dryRun, scanned, deleted, nextContinuationToken: nextToken }
            };
            return;
          }
        }

        if (!nextToken) break;
      }
    } catch (e) {
      useServerFilter = false;
      context.log.warn('RATE_LIMIT cleanup: server-side filter failed, fallback to client scan:', e?.message || String(e));
    }

    if (!useServerFilter) {
      for await (const page of await listPage(null)) {
        nextToken = page.continuationToken || null;
        for (const entity of page) {
          scanned += 1;
          const pk = entity.partitionKey ?? entity.PartitionKey;
          const rk = entity.rowKey ?? entity.RowKey;
          const resetAt = Number(entity.resetAt || 0);
          if (!pk || !rk) continue;
          if (!resetAt || resetAt >= now) continue;

          if (!dryRun) {
            try {
              await client.deleteEntity(pk, rk);
              deleted += 1;
            } catch (_) {
              // ignore
            }
          } else {
            deleted += 1;
          }

          if (deleted >= maxToDelete) {
            context.res = {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
              body: { success: true, tableName, dryRun, scanned, deleted, nextContinuationToken: nextToken }
            };
            return;
          }
        }

        if (!nextToken) break;
      }
    }

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { success: true, tableName, dryRun, scanned, deleted, nextContinuationToken: nextToken }
    };
  } catch (err) {
    context.log.error('admin-rate-limits-cleanup error', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: err.message || String(err) } };
  }
};

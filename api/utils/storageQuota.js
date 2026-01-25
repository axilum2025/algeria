const { listBlobs, listBlobsByPrefix } = require('./storage');
const { getUserPlan } = require('./entitlements');
const { getUserByEmail } = require('./userStorage');
const { buildDirectPrefix } = require('./blobNaming');

function safeNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function safeIntGb(n, fallback = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.floor(v));
}

function getIncludedStorageQuotaGb(plan) {
  const p = String(plan || '').toLowerCase();
  if (p === 'free') return 0.2; // 200 Mo indicatif
  if (p === 'enterprise') return 50;
  return 5; // PRO
}

function gbToBytes(gb) {
  return Math.max(0, safeNumber(gb, 0)) * 1024 * 1024 * 1024;
}

// Containers "cloud" qui doivent être comptés et bloqués.
const DEFAULT_CONTAINERS = [
  { name: 'invoices', prefixType: 'users' },
  { name: 'reports', prefixType: 'users' },
  { name: 'chat-images', prefixType: 'direct' },
  { name: 'chat-files', prefixType: 'direct' },
  { name: 'chat-sync', prefixType: 'direct' }
];

async function getUserStorageAddonGb(email) {
  const user = await getUserByEmail(email).catch(() => null);
  return safeIntGb(user && (user.storageAddonGb ?? user.storage_addon_gb ?? 0), 0);
}

async function computeUserCloudStorageState(email, options = {}) {
  const maxItems = Number.isFinite(Number(options.maxItems)) ? Math.min(10000, Math.max(1, Math.floor(Number(options.maxItems)))) : 10000;
  const containers = Array.isArray(options.containers) && options.containers.length
    ? options.containers
    : DEFAULT_CONTAINERS;

  const plan = await getUserPlan(email).catch(() => 'pro');
  const includedGb = getIncludedStorageQuotaGb(plan);
  const addonGb = await getUserStorageAddonGb(email);
  const totalGb = Math.max(0, safeNumber(includedGb, 0) + safeNumber(addonGb, 0));

  let totalBytes = 0;
  const byContainer = {};

  for (const c of containers) {
    const containerName = typeof c === 'string' ? c : c.name;
    const prefixType = typeof c === 'string' ? 'users' : (c.prefixType || 'users');

    let items = [];
    if (prefixType === 'direct') {
      const prefix = buildDirectPrefix(email);
      items = await listBlobsByPrefix(containerName, prefix);
    } else {
      items = await listBlobs(containerName, email);
    }

    const trimmed = items.slice(0, maxItems);
    let bytes = 0;
    for (const it of trimmed) {
      bytes += safeNumber(it && it.size != null ? it.size : 0, 0);
    }

    byContainer[containerName] = {
      bytes,
      count: trimmed.length,
      truncated: items.length > trimmed.length
    };
    totalBytes += bytes;
  }

  const totalQuotaBytes = gbToBytes(totalGb);

  return {
    email,
    plan,
    containers: containers.map(c => (typeof c === 'string' ? c : c.name)),
    usage: { totalBytes, byContainer },
    quota: {
      includedGb,
      addonGb,
      totalGb,
      totalBytes: totalQuotaBytes
    }
  };
}

async function checkUserCanAddBytes(email, deltaBytes, options = {}) {
  const delta = Math.max(0, safeNumber(deltaBytes, 0));
  const state = options.state || await computeUserCloudStorageState(email, options);
  const limitBytes = safeNumber(state?.quota?.totalBytes, 0);
  const currentBytes = safeNumber(state?.usage?.totalBytes, 0);

  // Si quota=0, on bloque dès qu'il y a un ajout > 0.
  const ok = (currentBytes + delta) <= limitBytes;
  return { ok, state, deltaBytes: delta, currentBytes, limitBytes };
}

function buildQuotaExceededBody(check) {
  const remainingBytes = Math.max(0, safeNumber(check.limitBytes, 0) - safeNumber(check.currentBytes, 0));
  return {
    error: 'Quota de stockage cloud dépassé',
    code: 'STORAGE_QUOTA_EXCEEDED',
    deltaBytes: check.deltaBytes,
    remainingBytes,
    quota: check.state?.quota,
    usage: check.state?.usage
  };
}

module.exports = {
  DEFAULT_CONTAINERS,
  getIncludedStorageQuotaGb,
  gbToBytes,
  computeUserCloudStorageState,
  checkUserCanAddBytes,
  buildQuotaExceededBody
};

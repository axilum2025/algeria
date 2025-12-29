const { TableClient } = require('@azure/data-tables');

// Fallback mémoire (dev/local) si Azure Table non configuré
const memoryStorage = {};

let tableClient = null;

function getTableClient() {
    if (tableClient) return tableClient;
    const connectionString = (process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.APPSETTING_AZURE_STORAGE_CONNECTION_STRING || '').trim();
    if (!connectionString) return null;
    tableClient = TableClient.fromConnectionString(connectionString, 'VerificationCodes');
    tableClient.createTable().catch(() => {});
    return tableClient;
}

async function storeCode(email, code, expiresAt) {
    const client = getTableClient();
    if (client) {
        const entity = {
            partitionKey: 'code',
            rowKey: String(email).toLowerCase(),
            code: String(code),
            expiresAt: Number(expiresAt),
            createdAt: Date.now()
        };
        await client.upsertEntity(entity);
        return;
    }

    const key = String(email).toLowerCase();
    memoryStorage[key] = { code, expiresAt };
    cleanExpiredTokens();
}

async function getCode(email) {
    const key = String(email).toLowerCase();
    const client = getTableClient();
    if (client) {
        try {
            const entity = await client.getEntity('code', key);
            const expiresAt = Number(entity.expiresAt);
            if (!expiresAt || expiresAt < Date.now()) {
                try { await client.deleteEntity('code', key); } catch (_) {}
                return null;
            }
            return { code: String(entity.code), expiresAt };
        } catch (_) {
            return null;
        }
    }

    const data = memoryStorage[key] || memoryStorage[email];
    if (!data) return null;
    if (data.expiresAt < Date.now()) {
        delete memoryStorage[key];
        delete memoryStorage[email];
        return null;
    }
    return data;
}

async function deleteCode(email) {
    const key = String(email).toLowerCase();
    const client = getTableClient();
    if (client) {
        try { await client.deleteEntity('code', key); } catch (_) {}
        return;
    }
    delete memoryStorage[key];
    delete memoryStorage[email];
}

function cleanExpiredTokens() {
    const now = Date.now();
    for (const [key, value] of Object.entries(memoryStorage)) {
        if (value.expiresAt < now) {
            delete memoryStorage[key];
        }
    }
}

module.exports = {
    storeCode,
    getCode,
    deleteCode
};

const { TableClient } = require("@azure/data-tables");

let tableClient = null;

function getTableClient() {
    if (!tableClient) {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (connectionString) {
            tableClient = TableClient.fromConnectionString(connectionString, "Users");
            tableClient.createTable().catch(() => {});
        }
    }
    return tableClient;
}

async function userExists(username) {
    const client = getTableClient();
    if (client) {
        try {
            await client.getEntity("user", username);
            return true;
        } catch (err) {
            return false;
        }
    }
    // In-memory fallback
    if (!global.__users) global.__users = {};
    return !!global.__users[username];
}

async function createUser(username, data) {
    const client = getTableClient();
    const entity = Object.assign({}, data, {
        partitionKey: "user",
        rowKey: username,
        createdAt: new Date()
    });
    if (client) {
        await client.upsertEntity(entity);
    } else {
        if (!global.__users) global.__users = {};
        // ensure roles array
        if (!entity.roles) entity.roles = [];
        global.__users[username] = entity;
    }
}

async function getUser(username) {
    const client = getTableClient();
    if (client) {
        try {
            const e = await client.getEntity("user", username);
            return e;
        } catch (err) {
            return null;
        }
    }
    if (!global.__users) global.__users = {};
    return global.__users[username] || null;
}

async function addRole(username, role) {
    const client = getTableClient();
    if (client) {
        try {
            const e = await client.getEntity('user', username);
            const roles = e.roles ? JSON.parse(e.roles) : [];
            if (!roles.includes(role)) roles.push(role);
            e.roles = JSON.stringify(roles);
            await client.upsertEntity(e);
            return roles;
        } catch (err) {
            throw err;
        }
    }
    if (!global.__users) global.__users = {};
    const u = global.__users[username] || {};
    if (!u.roles) u.roles = [];
    if (!u.roles.includes(role)) u.roles.push(role);
    global.__users[username] = u;
    return u.roles;
}

async function removeRole(username, role) {
    const client = getTableClient();
    if (client) {
        try {
            const e = await client.getEntity('user', username);
            const roles = e.roles ? JSON.parse(e.roles) : [];
            const idx = roles.indexOf(role);
            if (idx !== -1) roles.splice(idx, 1);
            e.roles = JSON.stringify(roles);
            await client.upsertEntity(e);
            return roles;
        } catch (err) {
            throw err;
        }
    }
    if (!global.__users) global.__users = {};
    const u = global.__users[username] || {};
    if (!u.roles) u.roles = [];
    u.roles = u.roles.filter(r => r !== role);
    global.__users[username] = u;
    return u.roles;
}

async function getRoles(username) {
    const client = getTableClient();
    if (client) {
        try {
            const e = await client.getEntity('user', username);
            return e.roles ? JSON.parse(e.roles) : [];
        } catch (err) {
            return [];
        }
    }
    if (!global.__users) global.__users = {};
    const u = global.__users[username] || {};
    return u.roles || [];
}

async function listAllRoles() {
    const client = getTableClient();
    const set = new Set();
    if (client) {
        for await (const entity of client.listEntities()) {
            if (entity.partitionKey === 'user' && entity.roles) {
                try {
                    const arr = JSON.parse(entity.roles);
                    arr.forEach(r => set.add(r));
                } catch (e) {}
            }
        }
        return Array.from(set);
    }
    if (!global.__users) global.__users = {};
    Object.values(global.__users).forEach(u => {
        if (u.roles && Array.isArray(u.roles)) u.roles.forEach(r => set.add(r));
    });
    return Array.from(set);
}

module.exports = { userExists, createUser, getUser, addRole, removeRole, getRoles, listAllRoles };

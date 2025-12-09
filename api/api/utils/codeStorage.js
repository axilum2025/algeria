const { TableClient } = require("@azure/data-tables");

// Utilise Azure Table Storage si disponible, sinon en mémoire (dev)
let tableClient = null;
const memoryStorage = {}; // Fallback pour le développement local

function getTableClient() {
    if (!tableClient) {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (connectionString) {
            tableClient = TableClient.fromConnectionString(
                connectionString,
                "VerificationCodes"
            );
            // Créer la table si elle n'existe pas
            tableClient.createTable().catch(() => {
                // La table existe déjà, ignorer l'erreur
            });
        }
    }
    return tableClient;
}

async function storeCode(email, code, expiresAt) {
    const client = getTableClient();
    
    if (client) {
        // Utiliser Azure Table Storage
        const entity = {
            partitionKey: "verification",
            rowKey: email,
            code: code,
            expiresAt: expiresAt,
            timestamp: new Date()
        };
        await client.upsertEntity(entity);
    } else {
        // Fallback en mémoire pour le développement
        memoryStorage[email] = { code, expiresAt };
    }
}

async function getCode(email) {
    const client = getTableClient();
    
    if (client) {
        // Récupérer depuis Azure Table Storage
        try {
            const entity = await client.getEntity("verification", email);
            return {
                code: entity.code,
                expiresAt: entity.expiresAt
            };
        } catch (error) {
            return null; // Code non trouvé
        }
    } else {
        // Fallback en mémoire
        return memoryStorage[email] || null;
    }
}

async function deleteCode(email) {
    const client = getTableClient();
    
    if (client) {
        // Supprimer de Azure Table Storage
        try {
            await client.deleteEntity("verification", email);
        } catch (error) {
            // Ignorer si n'existe pas
        }
    } else {
        // Fallback en mémoire
        delete memoryStorage[email];
    }
}

module.exports = {
    storeCode,
    getCode,
    deleteCode
};

// Simple in-memory storage (works perfectly for verification codes)
// Tokens expire in 24h, no need for persistent storage
const memoryStorage = {};

async function storeCode(email, code, expiresAt) {
    memoryStorage[email] = { code, expiresAt };
    
    // Clean up expired tokens every hour
    cleanExpiredTokens();
}

async function getCode(email) {
    const data = memoryStorage[email];
    if (!data) return null;
    
    // Check expiration
    if (data.expiresAt < Date.now()) {
        delete memoryStorage[email];
        return null;
    }
    
    return data;
}

async function deleteCode(email) {
    delete memoryStorage[email];
}

// Clean expired tokens periodically
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

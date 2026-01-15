// Azure Table Storage pour Finance & Accounting
// Isolation stricte par utilisateur (userId)

const { TableClient } = require('@azure/data-tables');

class FinanceStorage {
    constructor() {
        this.conversationsTable = 'financeconversations';
        this.invoicesTable = 'financeinvoices';
        this.reportsTable = 'financereports';
        this.settingsTable = 'financesettings';
        this.clients = {};
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 
                                    process.env.APPSETTING_AZURE_STORAGE_CONNECTION_STRING;
            
            if (!connectionString) {
                console.warn('⚠️ AZURE_STORAGE_CONNECTION_STRING non configuré pour Finance');
                this.initialized = false;
                return false;
            }

            // Initialiser les clients pour chaque table
            this.clients.conversations = TableClient.fromConnectionString(connectionString, this.conversationsTable);
            this.clients.invoices = TableClient.fromConnectionString(connectionString, this.invoicesTable);
            this.clients.reports = TableClient.fromConnectionString(connectionString, this.reportsTable);
            this.clients.settings = TableClient.fromConnectionString(connectionString, this.settingsTable);

            // Créer les tables si elles n'existent pas
            await Promise.all([
                this.clients.conversations.createTable().catch(() => {}),
                this.clients.invoices.createTable().catch(() => {}),
                this.clients.reports.createTable().catch(() => {}),
                this.clients.settings.createTable().catch(() => {})
            ]);

            this.initialized = true;
            console.log('✅ Finance Storage initialisé (Azure Tables)');
            return true;
        } catch (error) {
            console.error('❌ Erreur initialisation Finance Storage:', error.message);
            this.initialized = false;
            return false;
        }
    }

    // ===================================
    // CONVERSATIONS
    // ===================================
    
    async saveConversation(userId, conversationId, data) {
        if (!this.initialized || !this.clients.conversations) {
            throw new Error('Storage non initialisé');
        }

        const entity = {
            partitionKey: userId, // Isolation par utilisateur
            rowKey: conversationId,
            name: data.name || '',
            historyJson: JSON.stringify(data.history || []),
            contextJson: JSON.stringify(data.context || {}),
            messageCount: data.messageCount || 0,
            lastUpdated: new Date().toISOString(),
            timestamp: new Date()
        };

        await this.clients.conversations.upsertEntity(entity, 'Replace');
        return entity;
    }

    async getConversation(userId, conversationId) {
        if (!this.initialized || !this.clients.conversations) {
            return null;
        }

        try {
            const entity = await this.clients.conversations.getEntity(userId, conversationId);
            return {
                id: entity.rowKey,
                name: entity.name,
                history: JSON.parse(entity.historyJson || '[]'),
                context: JSON.parse(entity.contextJson || '{}'),
                messageCount: entity.messageCount || 0,
                lastUpdated: entity.lastUpdated
            };
        } catch (error) {
            if (error.statusCode === 404) return null;
            throw error;
        }
    }

    async listConversations(userId, limit = 50) {
        if (!this.initialized || !this.clients.conversations) {
            return [];
        }

        try {
            const entities = this.clients.conversations.listEntities({
                queryOptions: { 
                    filter: `PartitionKey eq '${userId}'`
                }
            });

            const conversations = [];
            for await (const entity of entities) {
                conversations.push({
                    id: entity.rowKey,
                    name: entity.name,
                    messageCount: entity.messageCount || 0,
                    lastUpdated: entity.lastUpdated
                });
                if (conversations.length >= limit) break;
            }

            return conversations.sort((a, b) => 
                new Date(b.lastUpdated) - new Date(a.lastUpdated)
            );
        } catch (error) {
            console.error('Erreur listConversations:', error);
            return [];
        }
    }

    async deleteConversation(userId, conversationId) {
        if (!this.initialized || !this.clients.conversations) {
            throw new Error('Storage non initialisé');
        }

        await this.clients.conversations.deleteEntity(userId, conversationId);
    }

    // ===================================
    // INVOICES
    // ===================================
    
    async saveInvoice(userId, invoiceId, data) {
        if (!this.initialized || !this.clients.invoices) {
            throw new Error('Storage non initialisé');
        }

        const entity = {
            partitionKey: userId,
            rowKey: invoiceId,
            vendor: data.vendor || '',
            amount: data.amount || 0,
            type: data.type || '',
            date: data.date || '',
            invoiceNumber: data.invoiceNumber || '',
            category: data.category || '',
            dataJson: JSON.stringify(data),
            timestamp: new Date()
        };

        await this.clients.invoices.upsertEntity(entity, 'Replace');
        return entity;
    }

    async listInvoices(userId, limit = 100) {
        if (!this.initialized || !this.clients.invoices) {
            return [];
        }

        try {
            const entities = this.clients.invoices.listEntities({
                queryOptions: { 
                    filter: `PartitionKey eq '${userId}'`
                }
            });

            const invoices = [];
            for await (const entity of entities) {
                invoices.push(JSON.parse(entity.dataJson || '{}'));
                if (invoices.length >= limit) break;
            }

            return invoices;
        } catch (error) {
            console.error('Erreur listInvoices:', error);
            return [];
        }
    }

    async deleteInvoice(userId, invoiceId) {
        if (!this.initialized || !this.clients.invoices) {
            throw new Error('Storage non initialisé');
        }

        await this.clients.invoices.deleteEntity(userId, invoiceId);
    }

    // ===================================
    // SETTINGS
    // ===================================
    
    async saveSettings(userId, settings) {
        if (!this.initialized || !this.clients.settings) {
            throw new Error('Storage non initialisé');
        }

        const entity = {
            partitionKey: userId,
            rowKey: 'company_settings',
            settingsJson: JSON.stringify(settings),
            timestamp: new Date()
        };

        await this.clients.settings.upsertEntity(entity, 'Replace');
        return settings;
    }

    async getSettings(userId) {
        if (!this.initialized || !this.clients.settings) {
            return null;
        }

        try {
            const entity = await this.clients.settings.getEntity(userId, 'company_settings');
            return JSON.parse(entity.settingsJson || '{}');
        } catch (error) {
            if (error.statusCode === 404) return null;
            throw error;
        }
    }

    // ===================================
    // REPORTS (Liens vers Blob Storage)
    // ===================================
    
    async saveReportMetadata(userId, reportId, metadata) {
        if (!this.initialized || !this.clients.reports) {
            throw new Error('Storage non initialisé');
        }

        const entity = {
            partitionKey: userId,
            rowKey: reportId,
            name: metadata.name || '',
            url: metadata.url || '',
            size: metadata.size || 0,
            generatedAt: metadata.generatedAt || new Date().toISOString(),
            metadataJson: JSON.stringify(metadata),
            timestamp: new Date()
        };

        await this.clients.reports.upsertEntity(entity, 'Replace');
        return metadata;
    }

    async listReports(userId, limit = 50) {
        if (!this.initialized || !this.clients.reports) {
            return [];
        }

        try {
            const entities = this.clients.reports.listEntities({
                queryOptions: { 
                    filter: `PartitionKey eq '${userId}'`
                }
            });

            const reports = [];
            for await (const entity of entities) {
                reports.push(JSON.parse(entity.metadataJson || '{}'));
                if (reports.length >= limit) break;
            }

            return reports;
        } catch (error) {
            console.error('Erreur listReports:', error);
            return [];
        }
    }
}

// Singleton
const financeStorage = new FinanceStorage();

module.exports = financeStorage;

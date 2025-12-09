// Azure Table Storage - Alternative économique à Redis
// Prix: ~0.045$/GB/mois vs 15$/mois pour Redis

const { TableClient } = require('@azure/data-tables');

class ResponseHistoryStorage {
    constructor() {
        this.tableName = 'responsehistory';
        this.partitionKey = 'history';
        this.client = null;
        this.initialized = false;
        this.cache = { entries: [], lastSync: null }; // Cache en mémoire pour performance
    }

    async initialize() {
        if (this.initialized) return;

        try {
            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            
            if (!connectionString) {
                console.warn('⚠️ AZURE_STORAGE_CONNECTION_STRING non configuré, utilisation de la mémoire volatile');
                this.initialized = false;
                return;
            }

            this.client = TableClient.fromConnectionString(connectionString, this.tableName);
            
            // Créer la table si elle n'existe pas
            await this.client.createTable().catch(() => {
                // Table existe déjà, c'est OK
            });

            // Charger les 100 dernières entrées en cache
            await this.loadCache();
            
            this.initialized = true;
            console.log('✅ Azure Table Storage initialisé');
        } catch (error) {
            console.error('❌ Erreur initialisation Table Storage:', error.message);
            this.initialized = false;
        }
    }

    async loadCache() {
        if (!this.client) return;

        try {
            const entities = this.client.listEntities({
                queryOptions: { 
                    filter: `PartitionKey eq '${this.partitionKey}'`,
                    select: ['rowKey', 'confidence', 'validation', 'messageLength', 'timestamp']
                }
            });

            const entries = [];
            for await (const entity of entities) {
                entries.push({
                    confidence: entity.confidence,
                    validation: entity.validation,
                    messageLength: entity.messageLength,
                    timestamp: entity.timestamp
                });
            }

            // Trier par timestamp décroissant et garder les 100 dernières
            entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            this.cache.entries = entries.slice(0, 100);
            this.cache.lastSync = new Date();

            console.log(`📥 Cache chargé: ${this.cache.entries.length} entrées`);
        } catch (error) {
            console.error('❌ Erreur chargement cache:', error.message);
        }
    }

    async add(entry) {
        const timestamp = new Date().toISOString();
        const rowKey = new Date().getTime().toString() + Math.random().toString(36).substring(7);

        // Ajouter au cache immédiatement
        this.cache.entries.unshift({
            ...entry,
            timestamp
        });

        // Garder seulement 100 entrées en cache
        if (this.cache.entries.length > 100) {
            this.cache.entries.pop();
        }

        // Sauvegarder en Table Storage (async, non-bloquant)
        if (this.initialized && this.client) {
            this.client.createEntity({
                partitionKey: this.partitionKey,
                rowKey: rowKey,
                confidence: entry.confidence,
                validation: entry.validation,
                messageLength: entry.messageLength || 0,
                timestamp: timestamp
            }).catch(error => {
                console.error('❌ Erreur sauvegarde Table Storage:', error.message);
            });
        }
    }

    getStats() {
        const entries = this.cache.entries;

        if (entries.length === 0) {
            return { avgConfidence: 0.7, avgValidation: 1.0, sampleSize: 0 };
        }

        const avgConfidence = entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length;
        const avgValidation = entries.reduce((sum, e) => sum + e.validation, 0) / entries.length;

        return {
            avgConfidence: Math.round(avgConfidence * 100) / 100,
            avgValidation: Math.round(avgValidation * 100) / 100,
            sampleSize: entries.length
        };
    }

    getAdaptiveThreshold() {
        const stats = this.getStats();

        // Ajuster le seuil d'alerte basé sur l'historique
        if (stats.avgValidation < 0.8) {
            return 0.25; // Seuil plus strict (25%)
        } else if (stats.avgConfidence > 0.85) {
            return 0.35; // Seuil plus permissif (35%)
        }

        return 0.30; // Seuil par défaut (30%)
    }

    // Nettoyage des anciennes entrées (garder seulement 1000 dernières)
    async cleanup(keepLast = 1000) {
        if (!this.initialized || !this.client) return;

        try {
            const entities = [];
            for await (const entity of this.client.listEntities()) {
                entities.push(entity);
            }

            // Trier par rowKey (timestamp) décroissant
            entities.sort((a, b) => b.rowKey.localeCompare(a.rowKey));

            // Supprimer les entrées au-delà de keepLast
            const toDelete = entities.slice(keepLast);
            for (const entity of toDelete) {
                await this.client.deleteEntity(entity.partitionKey, entity.rowKey);
            }

            console.log(`🗑️ Nettoyage: ${toDelete.length} entrées supprimées`);
        } catch (error) {
            console.error('❌ Erreur nettoyage:', error.message);
        }
    }
}

// Instance singleton
const storage = new ResponseHistoryStorage();

module.exports = storage;

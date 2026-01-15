// Finance Storage Client - Utilise Azure Storage au lieu de localStorage
// Isolation complète par utilisateur

class FinanceStorageClient {
    constructor() {
        this.apiBase = '/api/finance';
        this.userId = null;
        this.token = null;
    }

    // Initialiser avec l'utilisateur connecté
    initialize(userId, token) {
        this.userId = userId;
        this.token = token;
        console.log('[FinanceStorage] Initialisé pour user:', userId);
    }

    // Headers avec authentification
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token || this.userId}`
        };
    }

    // ===================================
    // CONVERSATIONS
    // ===================================

    async saveConversation(conversationId, data) {
        if (!this.userId) {
            console.warn('[FinanceStorage] userId non défini, fallback localStorage');
            return this.saveToLocalStorage(conversationId, data);
        }

        try {
            const response = await fetch(`${this.apiBase}/conversations`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    userId: this.userId,
                    conversationId,
                    data
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            console.log('[FinanceStorage] Conversation sauvegardée:', conversationId);
            return result;
        } catch (error) {
            console.error('[FinanceStorage] Erreur sauvegarde:', error);
            // Fallback vers localStorage en cas d'erreur
            return this.saveToLocalStorage(conversationId, data);
        }
    }

    async getConversation(conversationId) {
        if (!this.userId) {
            return this.getFromLocalStorage(conversationId);
        }

        try {
            const response = await fetch(`${this.apiBase}/conversations?conversationId=${conversationId}`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            return result.conversation;
        } catch (error) {
            console.error('[FinanceStorage] Erreur récupération:', error);
            return this.getFromLocalStorage(conversationId);
        }
    }

    async listConversations() {
        if (!this.userId) {
            return this.listFromLocalStorage();
        }

        try {
            const response = await fetch(`${this.apiBase}/conversations`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            return result.conversations || [];
        } catch (error) {
            console.error('[FinanceStorage] Erreur liste:', error);
            return this.listFromLocalStorage();
        }
    }

    async deleteConversation(conversationId) {
        if (!this.userId) {
            return this.deleteFromLocalStorage(conversationId);
        }

        try {
            const response = await fetch(`${this.apiBase}/conversations`, {
                method: 'DELETE',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    userId: this.userId,
                    conversationId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            console.log('[FinanceStorage] Conversation supprimée:', conversationId);
        } catch (error) {
            console.error('[FinanceStorage] Erreur suppression:', error);
            this.deleteFromLocalStorage(conversationId);
        }
    }

    // ===================================
    // SETTINGS
    // ===================================

    async saveSettings(settings) {
        if (!this.userId) {
            localStorage.setItem('axilum_finance_settings', JSON.stringify(settings));
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/settings`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    userId: this.userId,
                    settings
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            console.log('[FinanceStorage] Paramètres sauvegardés');
        } catch (error) {
            console.error('[FinanceStorage] Erreur sauvegarde settings:', error);
            localStorage.setItem('axilum_finance_settings', JSON.stringify(settings));
        }
    }

    async getSettings() {
        if (!this.userId) {
            const stored = localStorage.getItem('axilum_finance_settings');
            return stored ? JSON.parse(stored) : null;
        }

        try {
            const response = await fetch(`${this.apiBase}/settings`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            return result.settings;
        } catch (error) {
            console.error('[FinanceStorage] Erreur récupération settings:', error);
            const stored = localStorage.getItem('axilum_finance_settings');
            return stored ? JSON.parse(stored) : null;
        }
    }

    // ===================================
    // FALLBACK localStorage
    // ===================================

    saveToLocalStorage(conversationId, data) {
        try {
            const key = `finance_conv_${this.userId || 'guest'}`;
            const conversations = JSON.parse(localStorage.getItem(key) || '{}');
            conversations[conversationId] = {
                id: conversationId,
                ...data,
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem(key, JSON.stringify(conversations));
            console.log('[FinanceStorage] Sauvegarde localStorage (fallback)');
        } catch (error) {
            console.error('[FinanceStorage] Erreur localStorage:', error);
        }
    }

    getFromLocalStorage(conversationId) {
        try {
            const key = `finance_conv_${this.userId || 'guest'}`;
            const conversations = JSON.parse(localStorage.getItem(key) || '{}');
            return conversations[conversationId] || null;
        } catch (error) {
            console.error('[FinanceStorage] Erreur lecture localStorage:', error);
            return null;
        }
    }

    listFromLocalStorage() {
        try {
            const key = `finance_conv_${this.userId || 'guest'}`;
            const conversations = JSON.parse(localStorage.getItem(key) || '{}');
            return Object.values(conversations);
        } catch (error) {
            console.error('[FinanceStorage] Erreur liste localStorage:', error);
            return [];
        }
    }

    deleteFromLocalStorage(conversationId) {
        try {
            const key = `finance_conv_${this.userId || 'guest'}`;
            const conversations = JSON.parse(localStorage.getItem(key) || '{}');
            delete conversations[conversationId];
            localStorage.setItem(key, JSON.stringify(conversations));
        } catch (error) {
            console.error('[FinanceStorage] Erreur suppression localStorage:', error);
        }
    }

    // Nettoyer localStorage à la déconnexion
    clearUserData() {
        if (this.userId) {
            const key = `finance_conv_${this.userId}`;
            localStorage.removeItem(key);
            console.log('[FinanceStorage] Données locales nettoyées');
        }
        this.userId = null;
        this.token = null;
    }
}

// Singleton global
window.financeStorageClient = window.financeStorageClient || new FinanceStorageClient();

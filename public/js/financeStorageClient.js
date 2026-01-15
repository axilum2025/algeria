/**
 * Finance Storage Client - Appelle les APIs backend Azure
 * Version simple avec fallback localStorage
 */

(function() {
    'use strict';

    const FinanceStorageClient = {
        apiBase: '/api',
        userId: null,
        token: null,
        initialized: false,

        /**
         * Initialise le client
         */
        async initialize(userId, token) {
            this.userId = userId;
            this.token = token || userId; // Fallback si pas de token
            this.initialized = true;
            console.log('[FinanceStorage] Client initialisé pour:', userId);
        },

        /**
         * Vérifie si initialisé
         */
        isInitialized() {
            return this.initialized && this.userId;
        },

        /**
         * Headers pour les requêtes
         */
        getHeaders() {
            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token || this.userId}`
            };
        },

        /**
         * Sauvegarde une conversation
         */
        async saveConversation(conversationId, data) {
            if (!this.isInitialized()) {
                console.warn('[FinanceStorage] Non initialisé, fallback localStorage');
                return this._saveToLocalStorage(conversationId, data);
            }

            try {
                const response = await fetch(`${this.apiBase}/finance-conversations`, {
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
                console.log('[FinanceStorage] ✅ Conversation sauvegardée via API');
                return result;
            } catch (error) {
                console.error('[FinanceStorage] ❌ Erreur API, fallback localStorage:', error);
                return this._saveToLocalStorage(conversationId, data);
            }
        },

        /**
         * Récupère une conversation
         */
        async getConversation(conversationId) {
            if (!this.isInitialized()) {
                return this._getFromLocalStorage(conversationId);
            }

            try {
                const response = await fetch(`${this.apiBase}/finance-conversations?conversationId=${conversationId}`, {
                    method: 'GET',
                    headers: this.getHeaders()
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();
                console.log('[FinanceStorage] ✅ Conversation récupérée via API');
                return result.conversation || null;
            } catch (error) {
                console.error('[FinanceStorage] ❌ Erreur API, fallback localStorage:', error);
                return this._getFromLocalStorage(conversationId);
            }
        },

        /**
         * Liste toutes les conversations
         */
        async listConversations() {
            if (!this.isInitialized()) {
                return this._listFromLocalStorage();
            }

            try {
                const response = await fetch(`${this.apiBase}/finance-conversations`, {
                    method: 'GET',
                    headers: this.getHeaders()
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();
                console.log('[FinanceStorage] ✅ Liste conversations via API:', result.conversations.length);
                return result.conversations || [];
            } catch (error) {
                console.error('[FinanceStorage] ❌ Erreur API, fallback localStorage:', error);
                return this._listFromLocalStorage();
            }
        },

        /**
         * Supprime une conversation
         */
        async deleteConversation(conversationId) {
            if (!this.isInitialized()) {
                return this._deleteFromLocalStorage(conversationId);
            }

            try {
                const response = await fetch(`${this.apiBase}/finance-conversations`, {
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

                console.log('[FinanceStorage] ✅ Conversation supprimée via API');
                return true;
            } catch (error) {
                console.error('[FinanceStorage] ❌ Erreur API, fallback localStorage:', error);
                return this._deleteFromLocalStorage(conversationId);
            }
        },

        // ===== FALLBACK localStorage =====

        _saveToLocalStorage(conversationId, data) {
            try {
                const conversations = JSON.parse(localStorage.getItem('financeConversations') || '{}');
                conversations[conversationId] = data;
                localStorage.setItem('financeConversations', JSON.stringify(conversations));
                console.log('[FinanceStorage] 💾 Sauvegardé dans localStorage');
                return Promise.resolve(data);
            } catch (error) {
                console.error('[FinanceStorage] Erreur localStorage:', error);
                return Promise.reject(error);
            }
        },

        _getFromLocalStorage(conversationId) {
            try {
                const conversations = JSON.parse(localStorage.getItem('financeConversations') || '{}');
                return Promise.resolve(conversations[conversationId] || null);
            } catch (error) {
                return Promise.resolve(null);
            }
        },

        _listFromLocalStorage() {
            try {
                const conversations = JSON.parse(localStorage.getItem('financeConversations') || '{}');
                const list = Object.values(conversations).sort((a, b) => 
                    new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0)
                );
                return Promise.resolve(list);
            } catch (error) {
                return Promise.resolve([]);
            }
        },

        _deleteFromLocalStorage(conversationId) {
            try {
                const conversations = JSON.parse(localStorage.getItem('financeConversations') || '{}');
                delete conversations[conversationId];
                localStorage.setItem('financeConversations', JSON.stringify(conversations));
                console.log('[FinanceStorage] 💾 Supprimé de localStorage');
                return Promise.resolve(true);
            } catch (error) {
                return Promise.reject(error);
            }
        }
    };

    // Exposer globalement
    window.financeStorageClient = FinanceStorageClient;
    console.log('[FinanceStorage] 📦 Client chargé');
})();

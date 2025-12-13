// ⏱️ Rate Limiter avec Queue - Gère les limites API et file d'attente
// Évite les erreurs 429, distribue la charge, garantit fairness

class RateLimiter {
    constructor(maxRequestsPerMinute = 30) {
        this.maxRequestsPerMinute = maxRequestsPerMinute;
        this.requests = []; // Timestamps des requêtes
        this.queue = [];    // File d'attente
        this.processing = false;
    }

    /**
     * Enregistre une requête et vérifie si limite atteinte
     */
    canMakeRequest() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        // Nettoyer anciennes requêtes
        this.requests = this.requests.filter(ts => ts > oneMinuteAgo);
        
        // Vérifier limite
        return this.requests.length < this.maxRequestsPerMinute;
    }

    /**
     * Calcule temps d'attente avant prochaine requête possible
     */
    getWaitTime() {
        if (this.canMakeRequest()) return 0;
        
        const now = Date.now();
        const oldestRequest = this.requests[0];
        const waitTime = 60000 - (now - oldestRequest) + 100; // +100ms buffer
        
        return Math.max(0, waitTime);
    }

    /**
     * Ajoute une requête à la queue
     */
    async enqueue(requestFn, priority = 'normal') {
        return new Promise((resolve, reject) => {
            const queueItem = {
                requestFn,
                priority,
                resolve,
                reject,
                timestamp: Date.now()
            };
            
            // Priorité haute → début de queue
            if (priority === 'high') {
                this.queue.unshift(queueItem);
            } else {
                this.queue.push(queueItem);
            }
            
            // Démarrer traitement si pas déjà en cours
            if (!this.processing) {
                this.processQueue();
            }
        });
    }

    /**
     * Traite la file d'attente
     */
    async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        
        while (this.queue.length > 0) {
            const waitTime = this.getWaitTime();
            
            if (waitTime > 0) {
                // Attendre avant prochaine requête
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            const item = this.queue.shift();
            
            try {
                // Exécuter requête
                const now = Date.now();
                this.requests.push(now);
                
                const result = await item.requestFn();
                item.resolve(result);
            } catch (error) {
                item.reject(error);
            }
        }
        
        this.processing = false;
    }

    /**
     * Stats de la queue
     */
    getStats() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const recentRequests = this.requests.filter(ts => ts > oneMinuteAgo);
        
        return {
            queueLength: this.queue.length,
            requestsLastMinute: recentRequests.length,
            remainingCapacity: this.maxRequestsPerMinute - recentRequests.length,
            estimatedWaitTime: this.getWaitTime(),
            isProcessing: this.processing
        };
    }
}

/**
 * Rate limiters pour différents services
 */
class MultiServiceRateLimiter {
    constructor() {
        this.limiters = {
            groq: new RateLimiter(30),      // 30 req/min Groq gratuit
            gemini: new RateLimiter(15),    // 15 req/min Gemini Flash
            brave: new RateLimiter(50),     // 50 req/min Brave Search
            azure: new RateLimiter(100)     // 100 req/min Azure Functions
        };
    }

    /**
     * Exécute une requête avec rate limiting approprié
     */
    async execute(service, requestFn, priority = 'normal') {
        const limiter = this.limiters[service];
        
        if (!limiter) {
            throw new Error(`Service inconnu: ${service}`);
        }
        
        return await limiter.enqueue(requestFn, priority);
    }

    /**
     * Stats de tous les services
     */
    getAllStats() {
        const stats = {};
        
        for (const [service, limiter] of Object.entries(this.limiters)) {
            stats[service] = limiter.getStats();
        }
        
        return stats;
    }

    /**
     * Vérifie si un service est surchargé
     */
    isOverloaded(service, threshold = 0.8) {
        const limiter = this.limiters[service];
        if (!limiter) return false;
        
        const stats = limiter.getStats();
        const usage = stats.requestsLastMinute / limiter.maxRequestsPerMinute;
        
        return usage > threshold;
    }

    /**
     * Recommande le meilleur service selon charge
     */
    recommendService(services) {
        let bestService = services[0];
        let lowestLoad = 1;
        
        for (const service of services) {
            const limiter = this.limiters[service];
            if (!limiter) continue;
            
            const stats = limiter.getStats();
            const load = stats.requestsLastMinute / limiter.maxRequestsPerMinute;
            
            if (load < lowestLoad) {
                lowestLoad = load;
                bestService = service;
            }
        }
        
        return bestService;
    }
}

// Instance globale (singleton)
const globalRateLimiter = new MultiServiceRateLimiter();

/**
 * Wrapper pour appels Groq avec rate limiting
 */
async function callGroqWithRateLimit(requestFn, priority = 'normal') {
    return await globalRateLimiter.execute('groq', requestFn, priority);
}

/**
 * Wrapper pour appels Gemini avec rate limiting
 */
async function callGeminiWithRateLimit(requestFn, priority = 'normal') {
    return await globalRateLimiter.execute('gemini', requestFn, priority);
}

/**
 * Wrapper pour appels Brave avec rate limiting
 */
async function callBraveWithRateLimit(requestFn, priority = 'normal') {
    return await globalRateLimiter.execute('brave', requestFn, priority);
}

module.exports = {
    RateLimiter,
    MultiServiceRateLimiter,
    globalRateLimiter,
    callGroqWithRateLimit,
    callGeminiWithRateLimit,
    callBraveWithRateLimit
};

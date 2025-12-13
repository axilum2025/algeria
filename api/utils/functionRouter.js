// 🎯 Function Router - Orchestration intelligente des fonctions avec cache et retry
// Gère les appels parallèles, séquentiels, cache, et gestion d'erreurs

let NodeCache, cache;

try {
    NodeCache = require('node-cache');
    // Cache simple (TTL: 5 minutes)
    cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
} catch (e) {
    // Fallback si node-cache pas installé
    console.warn('⚠️ node-cache non installé, cache désactivé');
    cache = {
        get: () => undefined,
        set: () => true
    };
}

/**
 * Détecte quelle(s) fonction(s) appeler selon le message utilisateur
 */
function detectFunctions(userMessage) {
    const message = userMessage.toLowerCase();
    const functions = [];
    
    // Détection par mots-clés (ordre de priorité)
    const patterns = {
        // ✅ Nouvelles fonctions développées
        excelAssistant: /excel|formule|tableau|spreadsheet|cellule|colonne|somme|moyenne/i,
        translate: /traduis|traduction|translate|en anglais|en français|en espagnol|langue/i,
        taskManager: /tâche|to-?do|rappelle|note|ajoute.*liste|gérer.*tâche/i,
        
        // 🖼️ Fonctions existantes
        generateImage: /génère|crée|dessine|image|photo|illustration/i,
        analyzeImage: /analyse.*image|décris.*image|que vois-tu|reconnaissance/i,
        searchWeb: /cherche|recherche|trouve|infos? sur|google|brave/i,
        calendar: /calendrier|rendez-vous|réunion|planning|disponible|événement/i,
        analyzeDocument: /analyse.*document|extrait.*données|ocr|pdf|scan/i,
        
        // 📧 Fonctions communication
        sendEmail: /envoie|envoi|mail|email|message/i,
        
        // 🔢 Calculs et données
        calculate: /calcul|combien|résultat|équation|mathématique/i
    };
    
    for (const [func, pattern] of Object.entries(patterns)) {
        if (pattern.test(message)) {
            functions.push(func);
        }
    }
    
    return functions;
}

/**
 * Exécute une fonction avec retry automatique
 */
async function executeWithRetry(functionName, params, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await executeFunction(functionName, params);
            return { success: true, result };
        } catch (error) {
            lastError = error;
            
            // Retry seulement sur erreurs temporaires
            if (error.message.includes('429') || error.message.includes('timeout')) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            // Erreur permanente → arrêt
            break;
        }
    }
    
    return { success: false, error: lastError.message };
}

/**
 * Exécute une fonction avec cache
 */
async function executeCached(functionName, params) {
    const cacheKey = `${functionName}:${JSON.stringify(params)}`;
    
    // Vérifier cache
    const cached = cache.get(cacheKey);
    if (cached) {
        return { 
            success: true, 
            result: cached, 
            cached: true 
        };
    }
    
    // Exécuter avec retry
    const result = await executeWithRetry(functionName, params);
    
    // Mettre en cache si succès
    if (result.success) {
        cache.set(cacheKey, result.result);
    }
    
    return { ...result, cached: false };
}

/**
 * Exécute réellement la fonction (à implémenter selon vos endpoints)
 */
async function executeFunction(functionName, params) {
    // Mapping vers vos APIs Azure Functions
    const endpoints = {
        searchWeb: '/api/searchBrave',
        generateImage: '/api/generateImage',
        calendar: '/api/microsoftCalendar',
        analyzeDocument: '/api/analyzeDocument',
        translate: '/api/translate'
    };
    
    const endpoint = endpoints[functionName];
    if (!endpoint) {
        throw new Error(`Fonction inconnue: ${functionName}`);
    }
    
    // Appel HTTP (à adapter selon votre infrastructure)
    const response = await fetch(`${process.env.BASE_URL || ''}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });
    
    if (!response.ok) {
        throw new Error(`${functionName} failed: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Orchestre l'exécution de plusieurs fonctions
 */
async function orchestrateFunctions(functions, userMessage) {
    const results = [];
    
    // Séparer fonctions parallèles vs séquentielles
    const { parallel, sequential } = categorizeFunctions(functions);
    
    // 1. Exécuter fonctions parallèles (indépendantes)
    if (parallel.length > 0) {
        const promises = parallel.map(func => 
            executeCached(func.name, { query: userMessage, ...func.params })
        );
        
        const parallelResults = await Promise.allSettled(promises);
        
        parallelResults.forEach((res, idx) => {
            results.push({
                function: parallel[idx].name,
                success: res.status === 'fulfilled' && res.value.success,
                result: res.status === 'fulfilled' ? res.value.result : null,
                error: res.status === 'rejected' ? res.reason : null,
                cached: res.value?.cached || false
            });
        });
    }
    
    // 2. Exécuter fonctions séquentielles (dépendantes)
    for (const func of sequential) {
        const params = buildParamsFromPreviousResults(func, results);
        const result = await executeCached(func.name, params);
        
        results.push({
            function: func.name,
            success: result.success,
            result: result.result,
            error: result.error,
            cached: result.cached
        });
        
        // Si fonction critique échoue → arrêt
        if (func.critical && !result.success) {
            break;
        }
    }
    
    return results;
}

/**
 * Catégorise fonctions selon dépendances
 */
function categorizeFunctions(functions) {
    // Règles de dépendance
    const dependencies = {
        createCalendarEvent: ['checkAvailability'],  // Doit vérifier dispo avant
        createTaskWithDeadline: ['calendar'],        // Ajoute au calendrier après
    };
    
    const parallel = [];
    const sequential = [];
    
    for (const func of functions) {
        const funcName = typeof func === 'string' ? func : func.name;
        
        if (dependencies[funcName]) {
            sequential.push({ name: funcName, critical: true });
        } else {
            parallel.push({ name: funcName, critical: false });
        }
    }
    
    return { parallel, sequential };
}

/**
 * Construit params d'une fonction à partir des résultats précédents
 */
function buildParamsFromPreviousResults(func, previousResults) {
    const params = { ...func.params };
    
    // Exemple: createCalendarEvent a besoin du résultat de checkAvailability
    if (func.name === 'createCalendarEvent') {
        const availabilityResult = previousResults.find(r => r.function === 'checkAvailability');
        if (availabilityResult && availabilityResult.success) {
            params.suggestedTime = availabilityResult.result.nextAvailableSlot;
        }
    }
    
    return params;
}

/**
 * Résume les résultats pour Axilum
 */
function summarizeResults(results) {
    const summary = {
        totalFunctions: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        cached: results.filter(r => r.cached).length,
        details: results.map(r => ({
            function: r.function,
            status: r.success ? 'success' : 'failed',
            cached: r.cached
        }))
    };
    
    return summary;
}

module.exports = {
    detectFunctions,
    executeCached,
    executeWithRetry,
    orchestrateFunctions,
    summarizeResults,
    cache
};

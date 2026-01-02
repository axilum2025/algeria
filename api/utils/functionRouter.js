// 🎯 Function Router - Orchestration intelligente des fonctions avec cache et retry
// Gère les appels parallèles, séquentiels, cache, et gestion d'erreurs

const DEFAULT_TIMEOUT_MS = 25_000;

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
        // ✅ Fonctions réellement orchestrables sans données binaires
        excelAssistant: /excel|formule|tableau|spreadsheet|cellule|colonne|xlookup|recherchx|vlookup|recherchev|index\s*\(|match\s*\(/i,
        translate: /traduis|traduction|translate|en anglais|en français|en espagnol|langue/i,
        taskManager: /tâche|to-?do|rappelle|note|ajoute.*liste|gérer.*tâche/i,
        generateImage: /(g[ée]n[èe]re|cr[ée]e|dessine|fabrique|produis).*(image|photo|illustration|dessin|visuel|logo)|\b(image|photo|illustration|dessin|visuel|logo)\b/i,
        searchWeb: /cherche|recherche|trouve|infos? sur|google|brave/i,

        // ⚠️ Désactivés par défaut (besoin de données/credentials spécifiques)
        // analyzeImage: nécessite image base64
        // calendar: nécessite accessToken Microsoft
        // analyzeDocument: route non présente (utiliser extractText/vision-ocr si besoin)
        // sendEmail: nécessite paramètres email et endpoints dédiés
        // calculate: éviter exécution arbitraire côté serveur
    };
    
    for (const [func, pattern] of Object.entries(patterns)) {
        if (pattern.test(message)) {
            functions.push(func);
        }
    }
    
    return functions;
}

function getFunctionsBaseUrl() {
    const explicit = process.env.AXILUM_FUNCTIONS_BASE_URL || process.env.FUNCTIONS_BASE_URL || process.env.BASE_URL;
    if (explicit) return String(explicit).replace(/\/$/, '');

    // Azure Functions
    if (process.env.WEBSITE_HOSTNAME) return `https://${process.env.WEBSITE_HOSTNAME}`;

    // Local default
    return 'http://localhost:7071';
}

function withTimeout(fetchPromise, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return {
        promise: (async () => {
            try {
                return await fetchPromise(controller.signal);
            } finally {
                clearTimeout(timer);
            }
        })(),
        controller
    };
}

async function braveWebSearch(query) {
    const braveKey = process.env.APPSETTING_BRAVE_API_KEY || process.env.BRAVE_API_KEY;
    if (!braveKey) return [];

    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`;
    const resp = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': braveKey
        }
    });

    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Brave search failed: ${resp.status} ${txt.substring(0, 300)}`);
    }

    const data = await resp.json();
    const results = data.web?.results || [];
    return results.slice(0, 3).map(r => ({
        title: r.title,
        description: r.description,
        url: r.url
    }));
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
            if (String(error.message || '').includes('429') || String(error.message || '').includes('timeout')) {
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
    // Certains “outils” sont plus fiables en inline (pas de dépendance à l’URL locale)
    if (functionName === 'searchWeb') {
        const query = params?.query || params?.q || params?.text || '';
        const results = await braveWebSearch(String(query));
        return { success: true, results };
    }

    const baseUrl = getFunctionsBaseUrl();

    // Mapping vers les routes Azure Functions existantes (cf. function.json)
    const routes = {
        translate: '/api/translate',
        excelAssistant: '/api/excelAssistant',
        taskManager: '/api/tasks/smart-command',
        generateImage: '/api/generate-image',
        calendar: '/api/microsoftCalendar',
        extractText: '/api/extractText',
        analyzeImage: '/api/analyze-image'
    };

    const route = routes[functionName];
    if (!route) throw new Error(`Fonction inconnue: ${functionName}`);

    const timeoutMs = Number(params?.timeoutMs || DEFAULT_TIMEOUT_MS);
    const headers = Object.assign(
        { 'Content-Type': 'application/json' },
        params?.headers && typeof params.headers === 'object' ? params.headers : {}
    );

    // Ne pas forwarder des champs de contrôle internes
    const { timeoutMs: _timeout, headers: _headers, ...body } = (params && typeof params === 'object') ? params : {};

    const { promise } = withTimeout((signal) => fetch(`${baseUrl}${route}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal
    }), timeoutMs);

    const response = await promise;
    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`${functionName} failed: ${response.status} ${txt.substring(0, 300)}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return await response.json();
    return { raw: await response.text() };
}

function buildParamsForFunction(functionName, userMessage, requestBody = {}) {
    const message = String(userMessage || '').trim();

    switch (functionName) {
        case 'translate': {
            // Heuristique simple: si “en anglais/en français/en espagnol…” apparaît, on l’utilise
            const lower = message.toLowerCase();
            let targetLang = requestBody.targetLang;
            if (!targetLang) {
                if (/(en\s+anglais|to\s+english)/i.test(lower)) targetLang = 'anglais';
                else if (/(en\s+fran[çc]ais|to\s+french)/i.test(lower)) targetLang = 'français';
                else if (/(en\s+espagnol|to\s+spanish)/i.test(lower)) targetLang = 'espagnol';
            }
            return {
                text: requestBody.text || message,
                targetLang: targetLang || 'anglais',
                sourceLang: requestBody.sourceLang,
                preserveFormatting: true,
                includeAlternatives: false
            };
        }

        case 'excelAssistant':
            return {
                task: requestBody.task || message,
                data: requestBody.data,
                context: requestBody.context
            };

        case 'taskManager': {
            const userId = requestBody.userId;
            return {
                command: requestBody.command || message,
                history: requestBody.taskHistory || requestBody.history,
                userId
            };
        }

        case 'generateImage':
            return {
                prompt: requestBody.prompt || message,
                width: requestBody.width,
                height: requestBody.height
            };

        case 'calendar':
            return {
                action: requestBody.action || 'list',
                accessToken: requestBody.accessToken,
                startDate: requestBody.startDate,
                endDate: requestBody.endDate,
                event: requestBody.event,
                date: requestBody.date,
                time: requestBody.time
            };

        case 'extractText':
            return {
                file: requestBody.file,
                fileName: requestBody.fileName
            };

        case 'analyzeImage':
            return {
                imageBase64: requestBody.imageBase64 || requestBody.image,
                question: requestBody.question || message
            };

        case 'searchWeb':
            return {
                query: requestBody.query || message
            };

        default:
            return { query: message };
    }
}

/**
 * Orchestre l'exécution de plusieurs fonctions
 */
async function orchestrateFunctions(functions, userMessage, options = {}) {
    const results = [];
    const requestBody = options?.requestBody || {};
    
    // Séparer fonctions parallèles vs séquentielles
    const { parallel, sequential } = categorizeFunctions(functions);
    
    // 1. Exécuter fonctions parallèles (indépendantes)
    if (parallel.length > 0) {
        const promises = parallel.map(func => 
            executeCached(func.name, buildParamsForFunction(func.name, userMessage, requestBody))
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
        const baseParams = buildParamsForFunction(func.name, userMessage, requestBody);
        const params = buildParamsFromPreviousResults({ ...func, params: baseParams }, results);
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

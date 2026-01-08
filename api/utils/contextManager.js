// 🧠 Context Manager - Gestion intelligente du contexte pour éviter dépassement tokens
// Prioritise les informations importantes, compresse l'historique, résume les fonctions

const MAX_CONTEXT_TOKENS = 6000; // Sécurité pour context window 8K

const { normalizeLang, getResponseLanguageInstruction } = require('./lang');

/**
 * Estime le nombre de tokens (approximation)
 * 1 token ≈ 4 caractères en français
 */
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

/**
 * Résume l'historique ancien pour économiser tokens
 */
function summarizeOldHistory(history) {
    if (history.length <= 10) return history;
    
    // Garder 5 derniers messages complets
    const recent = history.slice(-5);
    
    // Résumer les anciens
    const old = history.slice(0, -5);
    const summary = `[Résumé conversation précédente: ${old.length} échanges sur ${extractTopics(old)}]`;
    
    return [
        { type: 'system', content: summary },
        ...recent
    ];
}

/**
 * Extrait les sujets principaux d'une conversation
 */
function extractTopics(history) {
    const keywords = history
        .map(msg => msg.content)
        .join(' ')
        .toLowerCase()
        .split(' ')
        .filter(w => w.length > 5);
    
    const topKeywords = [...new Set(keywords)].slice(0, 5);
    return topKeywords.join(', ');
}

/**
 * Priorise le contexte selon importance
 */
function prioritizeContext(contexts) {
    const prioritized = [];
    let totalTokens = 0;
    
    // Ordre de priorité
    const order = ['user_message', 'recent_history', 'function_results', 'rag_context', 'system_prompt'];
    
    for (const type of order) {
        const ctx = contexts.find(c => c.type === type);
        if (!ctx) continue;
        
        const tokens = estimateTokens(ctx.content);
        
        if (totalTokens + tokens > MAX_CONTEXT_TOKENS) {
            // Tronquer ou résumer
            const remaining = MAX_CONTEXT_TOKENS - totalTokens;
            const truncated = truncateText(ctx.content, remaining * 4); // *4 car 4 chars/token
            prioritized.push({ ...ctx, content: truncated, truncated: true });
            break;
        }
        
        prioritized.push(ctx);
        totalTokens += tokens;
    }
    
    return { contexts: prioritized, totalTokens };
}

/**
 * Tronque un texte intelligemment
 */
function truncateText(text, maxChars) {
    if (text.length <= maxChars) return text;
    
    // Couper au dernier point avant la limite
    const truncated = text.substring(0, maxChars);
    const lastPeriod = truncated.lastIndexOf('.');
    
    if (lastPeriod > maxChars * 0.8) {
        return truncated.substring(0, lastPeriod + 1) + '\n\n[...tronqué...]';
    }
    
    return truncated + '...[tronqué]';
}

/**
 * Gère le contexte multi-fonctions
 */
function buildContextForFunctions(userMessage, history, functionResults = []) {
    const contexts = [
        {
            type: 'user_message',
            content: userMessage,
            priority: 1
        },
        {
            type: 'recent_history',
            content: summarizeOldHistory(history),
            priority: 2
        }
    ];
    
    // Ajouter résultats de fonctions si présents
    if (functionResults.length > 0) {
        const functionContext = functionResults.map(r => {
            let rendered;
            try {
                rendered = typeof r.result === 'string' ? r.result : JSON.stringify(r.result);
            } catch (_) {
                rendered = String(r.result);
            }
            if (rendered.length > 1200) rendered = rendered.slice(0, 1200) + '...[tronqué]';
            return `[${r.function}] → ${rendered}`;
        }).join('\n');
        
        contexts.push({
            type: 'function_results',
            content: functionContext,
            priority: 3
        });
    }
    
    return prioritizeContext(contexts);
}

/**
 * Créer un system prompt compact pour fonctions multiples
 */
function buildCompactSystemPrompt(availableFunctions = [], options = {}) {
    const lang = normalizeLang(options?.lang);
    let prompt = `Tu es Axilum AI, assistant intelligent.\n\n`;
    
    if (availableFunctions.length > 0) {
        prompt += `FONCTIONS: ${availableFunctions.join(', ')}\n`;
        prompt += `Format appel: FUNCTION_CALL: {"name": "...", "params": {...}}\n\n`;
    }
    
    prompt += `Principes: nuances, sources, admets incertitude.\n`;
    prompt += `Rapport Hallucination Detector: si l'utilisateur colle un bloc qui commence par "🔎 Rapport Hallucination Detector" (ou demande HI/CHR/claims), reconnais-le comme un rapport interne de fiabilité et explique-le (Score, HI, CHR, Claims, points non confirmés, sources, actions de vérification).\n`;
    prompt += getResponseLanguageInstruction(lang, { tone: 'clair et professionnel' });
    
    return prompt;
}

module.exports = {
    estimateTokens,
    summarizeOldHistory,
    prioritizeContext,
    buildContextForFunctions,
    buildCompactSystemPrompt,
    MAX_CONTEXT_TOKENS
};

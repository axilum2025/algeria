// 📊 Excel Assistant - Génération formules, analyse de données, création tableaux
// Utilise Llama 3.3 70B pour comprendre les besoins et générer des solutions Excel

const { getAuthEmail } = require('../utils/auth');
const { precheckCredit, debitAfterUsage } = require('../utils/aiCreditGuard');

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    } catch (_) {
        return null;
    }
}

function resolveRequestedGroqModel(requested) {
    const r = String(requested || '').trim();
    if (!r) return DEFAULT_GROQ_MODEL;
    const raw = String(process.env.AI_PRICING_JSON || '').trim();
    if (!raw) return DEFAULT_GROQ_MODEL;
    const pricing = safeJsonParse(raw);
    if (!pricing || typeof pricing !== 'object') return DEFAULT_GROQ_MODEL;
    if (!Object.prototype.hasOwnProperty.call(pricing, r)) return DEFAULT_GROQ_MODEL;
    return r;
}

module.exports = async function (context, req) {
    context.log('📊 Excel Assistant Request');

    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        };
        return;
    }

    try {
        const { task, data, context: taskContext, userId: bodyUserId } = req.body;
        const requestedModel = req.body?.model || req.body?.aiModel || null;
        const resolvedModel = resolveRequestedGroqModel(requestedModel);
        const authEmail = getAuthEmail(req);
        const userId = authEmail || bodyUserId || 'guest';

        if (!task) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { error: "Task description is required" }
            };
            return;
        }

        const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;

        if (!groqKey) {
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: "Groq API Key not configured" }
            };
            return;
        }

        // Construire le prompt Excel spécialisé
        const systemPrompt = `Tu es un expert Excel/Google Sheets. Tu aides à:
1. Générer des formules Excel complexes
2. Analyser des données et suggérer des visualisations
3. Créer des structures de tableaux optimisées
4. Expliquer comment utiliser des fonctions Excel

RÈGLES:
- Donne des formules Excel exactes et testables
- Explique chaque partie de la formule
- Suggère des alternatives si pertinent
- Donne des exemples concrets
- Utilise le français pour les explications, garde les noms de fonctions en anglais

FORMAT DE RÉPONSE:
📊 **Formule Excel**:
\`=VOTRE_FORMULE_ICI\`

📝 **Explication**:
[Explication détaillée]

💡 **Exemple**:
[Exemple concret avec données]

${data ? `\n🔍 **Données fournies**:\n${JSON.stringify(data, null, 2)}` : ''}
${taskContext ? `\n📋 **Contexte**:\n${taskContext}` : ''}`;

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: task }
        ];

        // Crédit prépayé (EUR)
        try {
            await precheckCredit({ userId, model: resolvedModel, messages, maxTokens: 2000 });
        } catch (e) {
            context.res = {
                status: e?.code === 'INSUFFICIENT_CREDIT' ? (e.status || 402) : (e?.status || 500),
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: e?.code === 'INSUFFICIENT_CREDIT'
                    ? {
                        error: 'Quota prépayé insuffisant.',
                        code: 'INSUFFICIENT_CREDIT',
                        currency: e.currency || 'EUR',
                        balanceCents: Number(e.remainingCents || 0),
                        balanceEur: Number(((Number(e.remainingCents || 0)) / 100).toFixed(2))
                    }
                    : { error: 'Pricing manquant pour calculer le quota.', code: e?.code || 'CREDIT_ERROR', details: String(e?.message || e) }
            };
            return;
        }

        // Appel Groq avec Llama 3.3 70B
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify({
                model: resolvedModel,
                messages: messages,
                max_tokens: 2000,
                temperature: 0.3 // Plus déterministe pour formules
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: {
                    error: `Groq Error: ${response.status}`,
                    details: errorText
                }
            };
            return;
        }

        const aiData = await response.json();
        const solution = aiData.choices[0].message.content;

        const creditAfter = await debitAfterUsage({ userId, model: aiData?.model || resolvedModel, usage: aiData?.usage });

        // Extraire les formules Excel du texte
        const formulas = extractExcelFormulas(solution);

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                solution: solution,
                formulas: formulas,
                task: task,
                tokensUsed: aiData.usage?.total_tokens || 0,
                model: 'llama-3.3-70b',
                provider: 'Groq',
                credit: creditAfter || null
            }
        };

    } catch (error) {
        context.log.error('❌ Error:', error);
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: { error: error.message }
        };
    }
};

/**
 * Extrait les formules Excel du texte généré
 */
function extractExcelFormulas(text) {
    const formulas = [];
    
    // Pattern 1: Formules entre backticks
    const backtickPattern = /`(=.*?)`/g;
    let match;
    while ((match = backtickPattern.exec(text)) !== null) {
        formulas.push(match[1]);
    }
    
    // Pattern 2: Formules sur leur propre ligne
    const linePattern = /^(=\w+\(.*\))$/gm;
    while ((match = linePattern.exec(text)) !== null) {
        if (!formulas.includes(match[1])) {
            formulas.push(match[1]);
        }
    }
    
    return formulas;
}

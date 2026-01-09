const axios = require('axios');
const { assertWithinBudget, recordUsage, BudgetExceededError } = require('../utils/aiUsageBudget');
const { getAuthEmail } = require('../utils/auth');
const { precheckCredit, debitAfterUsage } = require('../utils/aiCreditGuard');
const { stripModelReasoning } = require('../utils/stripModelReasoning');

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

/**
 * Détecte si on doit proposer le téléchargement du résultat
 * Basé sur le contexte de la conversation et le type de réponse
 */
function detectDownloadOffer(messages, assistantMessage) {
  // Ne pas proposer si la conversation est trop courte
  if (messages.length < 3) return false;

  const lastUserMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
  const assistantLower = assistantMessage.toLowerCase();

  // Mots-clés indiquant une tâche terminée
  const completionKeywords = [
    'voici', 'voilà', 'j\'ai terminé', 'terminé', 'fini',
    'résultat', 'version corrigée', 'version traduite',
    'résumé', 'analyse complète', 'rapport'
  ];

  // Mots-clés de l'utilisateur indiquant une demande de production
  const taskKeywords = [
    'traduis', 'corrige', 'résume', 'réécris', 'analyse',
    'génère', 'crée', 'rédige', 'améliore'
  ];

  // Vérifier si l'assistant a produit un résultat substantiel
  const hasSubstantialContent = assistantMessage.length > 300;

  // Vérifier si l'assistant a utilisé des mots de complétion
  const hasCompletionWords = completionKeywords.some(keyword => 
    assistantLower.includes(keyword)
  );

  // Vérifier si l'utilisateur a demandé une tâche de production
  const userRequestedTask = taskKeywords.some(keyword => 
    lastUserMessage.includes(keyword)
  );

  // Proposer le téléchargement si:
  // 1. L'assistant a produit un contenu substantiel ET
  // 2. (L'assistant utilise des mots de complétion OU l'utilisateur a demandé une tâche)
  return hasSubstantialContent && (hasCompletionWords || userRequestedTask);
}

module.exports = async function (context, req) {
  const setCors = () => {
    context.res = context.res || {};
    context.res.headers = Object.assign({}, context.res.headers, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
  };

  if (req.method === 'OPTIONS') {
    setCors();
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  try {
    const { messages, userId: bodyUserId, context: reqContext } = req.body || {};
    const requestedModel = req.body?.model || req.body?.aiModel || null;
    const resolvedModel = resolveRequestedGroqModel(requestedModel);
    const authEmail = getAuthEmail(req);
    const userId = authEmail || bodyUserId || 'guest';
    
    if (!messages || !Array.isArray(messages)) {
      setCors();
      context.res.status = 400;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { error: 'messages array required' };
      return;
    }

    context.log('📨 Chat API - Reçu:', messages.length, 'messages');
    const fileMessages = messages.filter(m => m.content && m.content.includes('[FICHIER UPLOADÉ'));
    if (fileMessages.length > 0) {
      context.log('📄 Fichiers détectés:', fileMessages.length);
      fileMessages.forEach((fm, i) => {
        context.log(`  Fichier ${i+1}: ${fm.content.length} caractères`);
      });
    }

    const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
    
    if (!groqKey) {
      setCors();
      context.res.status = 200;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { response: 'Configuration API manquante. Veuillez contacter l\'administrateur.' };
      return;
    }

    // Crédit prépayé (EUR)
    try {
      await precheckCredit({ userId, model: resolvedModel, messages, maxTokens: 2000 });
    } catch (e) {
      if (e?.code === 'INSUFFICIENT_CREDIT') {
        setCors();
        context.res.status = e.status || 402;
        context.res.headers['Content-Type'] = 'application/json';
        context.res.body = {
          error: 'Quota prépayé insuffisant.',
          code: 'INSUFFICIENT_CREDIT',
          currency: e.currency || 'EUR',
          balanceCents: Number(e.remainingCents || 0),
          balanceEur: Number(((Number(e.remainingCents || 0)) / 100).toFixed(2))
        };
        return;
      }
      if (e?.code === 'PRICING_MISSING') {
        setCors();
        context.res.status = e.status || 500;
        context.res.headers['Content-Type'] = 'application/json';
        context.res.body = { error: 'Pricing manquant pour calculer le quota.', code: 'PRICING_MISSING', details: e.message };
        return;
      }
      throw e;
    }

    // Bloquer si le budget mensuel est dépassé (contrôle centralisé côté serveur)
    try {
      await assertWithinBudget({ provider: 'Groq', route: 'chat', userId });
    } catch (e) {
      if (e instanceof BudgetExceededError || e?.code === 'BUDGET_EXCEEDED') {
        setCors();
        context.res.status = e.status || 429;
        context.res.headers['Content-Type'] = 'application/json';
        context.res.headers['Retry-After'] = String(e.retryAfterSeconds || 3600);
        context.res.body = {
          error: 'Budget IA mensuel dépassé. Réessayez le mois prochain ou augmentez le budget.',
          code: 'BUDGET_EXCEEDED',
          used: e.used,
          limit: e.limit,
          currency: e.currency
        };
        return;
      }
      throw e;
    }

    // Call Groq API
    const startedAt = Date.now();
    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: resolvedModel,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Débiter le crédit sur le coût réel
    const creditAfter = await debitAfterUsage({
      userId,
      model: groqResponse?.data?.model || resolvedModel,
      usage: groqResponse?.data?.usage
    });

    // Enregistrer usage (tokens + coût si pricing configuré)
    try {
      await recordUsage({
        provider: 'Groq',
        model: groqResponse?.data?.model || resolvedModel,
        route: 'chat',
        userId,
        usage: groqResponse?.data?.usage,
        latencyMs: Date.now() - startedAt,
        ok: true
      });
    } catch (_) {
      // best-effort
    }

    const assistantMessageRaw = groqResponse.data.choices?.[0]?.message?.content || 'Pas de réponse générée.';
    const assistantMessage = stripModelReasoning(assistantMessageRaw) || 'Pas de réponse générée.';

    // Détecter si on doit proposer le téléchargement
    const shouldOfferDownload = detectDownloadOffer(messages, assistantMessage);

    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = {
      response: assistantMessage,
      userId,
      context: reqContext,
      offerDownload: shouldOfferDownload,
      credit: creditAfter || null
    };

  } catch (error) {
    context.log.error('Chat API Error:', error.message);
    setCors();
    context.res.status = error?.status || 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { 
      error: error.message || String(error),
      response: 'Désolé, une erreur s\'est produite. Veuillez réessayer.'
    };
  }
};

const axios = require('axios');
const { assertWithinBudget, recordUsage, BudgetExceededError } = require('../utils/aiUsageBudget');
const { getAuthEmail } = require('../utils/auth');
const { precheckCredit, debitAfterUsage } = require('../utils/aiCreditGuard');
const { stripModelReasoning } = require('../utils/stripModelReasoning');
const { normalizeLang, detectLangFromText, detectLangFromTextDetailed, getLangFromReq, getLanguageNameFr, getResponseLanguageInstruction, isLowSignalMessage, getConversationFocusInstruction, isAffirmation, isNegation, looksLikeQuestion, getYesNoDisambiguationInstruction } = require('../utils/lang');

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

function looksLikeTranslationFlow(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  const joinedSystem = messages
    .filter(m => m && m.role === 'system' && typeof m.content === 'string')
    .map(m => m.content.toLowerCase())
    .join('\n');

  // Text Pro / translator prompts typically include these.
  if (joinedSystem.includes('ne fournis que la traduction')) return true;
  if (joinedSystem.includes('tu es un traducteur')) return true;
  if (joinedSystem.includes('traduis le texte')) return true;
  if (joinedSystem.includes('translate the text')) return true;
  if (joinedSystem.includes('translation only')) return true;

  return false;
}

function pickLanguageFromMessages(messages, fallbackLang) {
  const fb = normalizeLang(fallbackLang || 'fr');
  if (!Array.isArray(messages) || messages.length === 0) return fb;

  // Prefer the FIRST meaningful user message (stable across the whole conversation)
  const firstUser = messages.find(m => m && m.role === 'user' && typeof m.content === 'string' && m.content.trim());
  const firstText = firstUser?.content || '';

  // If the first message is too short (e.g., "ok"), use last user message instead.
  const normalized = String(firstText || '').replace(/\s+/g, ' ').trim();
  const isTooShort = normalized.length < 6;
  if (!isTooShort) return detectLangFromText(normalized, { fallback: fb });

  const lastUser = [...messages].reverse().find(m => m && m.role === 'user' && typeof m.content === 'string' && m.content.trim());
  const lastText = String(lastUser?.content || '').replace(/\s+/g, ' ').trim();
  return detectLangFromText(lastText, { fallback: fb });
}

function pickLanguageFromMessagesDetailed(messages, fallbackLang) {
  const fb = normalizeLang(fallbackLang || 'fr');
  if (!Array.isArray(messages) || messages.length === 0) {
    return { lang: fb, confidence: 'low', reason: 'empty-messages' };
  }

  const firstUser = messages.find(m => m && m.role === 'user' && typeof m.content === 'string' && m.content.trim());
  const firstText = String(firstUser?.content || '').replace(/\s+/g, ' ').trim();
  const isTooShort = firstText.length < 6;
  if (!isTooShort) return detectLangFromTextDetailed(firstText, { fallback: fb });

  const lastUser = [...messages].reverse().find(m => m && m.role === 'user' && typeof m.content === 'string' && m.content.trim());
  const lastText = String(lastUser?.content || '').replace(/\s+/g, ' ').trim();
  return detectLangFromTextDetailed(lastText, { fallback: fb });
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

    // --- Langue auto: répondre dans la langue de l'utilisateur ---
    // 1) langue explicitement fournie par le client (si présent)
    // 2) sinon détection depuis le 1er message user (stable)
    // 3) fallback: Accept-Language
    // Langue: body/query = explicite. Sinon détection (1er message), fallback système.
    // Si la détection est forte, elle peut surclasser une préférence système.
    const explicitLang = req.body?.lang || req.body?.language || req.body?.locale || req.query?.lang;
    const hintedLang = explicitLang ? normalizeLang(explicitLang) : getLangFromReq(req, { fallback: 'fr' });
    const detected = explicitLang
      ? { lang: hintedLang, confidence: 'high', reason: 'explicit' }
      : pickLanguageFromMessagesDetailed(messages, hintedLang);
    const detectedLang = (detected.confidence === 'high' && detected.lang && detected.lang !== hintedLang)
      ? detected.lang
      : (detected.lang || hintedLang);

    const shouldEnforceLanguage = !looksLikeTranslationFlow(messages);
    const lastUserMsg = [...messages].reverse().find(m => m && m.role === 'user' && typeof m.content === 'string' && m.content.trim());
    const lastAssistantMsg = [...messages].reverse().find(m => m && m.role === 'assistant' && typeof m.content === 'string' && m.content.trim());
    const lastUserText = String(lastUserMsg?.content || '').trim();

    const shouldFocus = isLowSignalMessage(lastUserText);
    const isYesNo = isAffirmation(lastUserText) || isNegation(lastUserText);
    const disambiguateYesNo = isYesNo && looksLikeQuestion(lastAssistantMsg?.content || '');
    const languageSystemMessage = shouldEnforceLanguage
      ? {
          role: 'system',
          content: [
            `Langue utilisateur détectée: ${getLanguageNameFr(detectedLang)} (${detectedLang}).`,
            getResponseLanguageInstruction(detectedLang, { tone: 'même si le reste du contexte est dans une autre langue' }),
            'Règle: conserve cette langue tout au long de la conversation, sauf si l’utilisateur demande explicitement une traduction ou change volontairement de langue.',
            shouldFocus ? getConversationFocusInstruction(detectedLang) : '',
            disambiguateYesNo ? getYesNoDisambiguationInstruction(detectedLang) : ''
          ].join('\n')
        }
      : null;

    const finalMessages = languageSystemMessage ? [languageSystemMessage, ...messages] : messages;

    // Call Groq API
    const startedAt = Date.now();
    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: resolvedModel,
        messages: finalMessages,
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

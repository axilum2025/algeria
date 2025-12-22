const axios = require('axios');

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
    const { messages, userId, context: reqContext } = req.body || {};
    
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

    // Call Groq API
    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
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

    const assistantMessage = groqResponse.data.choices?.[0]?.message?.content || 'Pas de réponse générée.';

    // Détecter si on doit proposer le téléchargement
    const shouldOfferDownload = detectDownloadOffer(messages, assistantMessage);

    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = {
      response: assistantMessage,
      userId,
      context: reqContext,
      offerDownload: shouldOfferDownload
    };

  } catch (error) {
    context.log.error('Chat API Error:', error.message);
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { 
      error: error.message || String(error),
      response: 'Désolé, une erreur s\'est produite. Veuillez réessayer.'
    };
  }
};

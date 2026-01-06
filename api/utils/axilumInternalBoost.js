const { buildSystemPromptForAgent } = require('./agentRegistry');
const { callGroqChatCompletion } = require('./orchestrator');

function normalizeForHeuristics(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isSmallTalk(text) {
  const s0 = normalizeForHeuristics(text);
  if (!s0) return false;
  const s = s0
    .replace(/[^a-z0-9à-ÿ\s'_-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^(bonjour|salut|coucou|hello|hey|yo|bonsoir|bonne\s+nuit|merci|merci\s+beaucoup|ok|d\s*accord|ça\s+marche|ca\s+marche|super|cool)\b/i.test(s)) return true;
  if (/^(au\s+revoir|a\s+plus|à\s+plus|a\+|bye|ciao|à\s+bient[oô]t|a\s+bient[oô]t|à\s+demain|a\s+demain|à\s+tout\s+à\s+l'heure|a\s+tout\s+à\s+l'heure|à\s+tout\s+de\s+suite|a\s+tout\s+de\s+suite|bonne\s+journ[ée]e|bonne\s+soir[ée]e|bon\s+week-?end)\b/i.test(s)) return true;
  if (/(comment\s+ça\s+va|comment\s+ca\s+va|ça\s+va\s*\?|ca\s+va\s*\?|tu\s+vas\s+bien)/i.test(s)) return true;
  if (/(quel\s+est\s+ton\s+nom|tu\s+t'appelles\s+comment|qui\s+es\s*-?\s*tu|tu\s+es\s+qui)/i.test(s)) return true;

  return false;
}

function looksLikeCommand(text) {
  const s = String(text || '').trim();
  return s.startsWith('/');
}

function shouldUseInternalBoost(userQuery, { userMessage } = {}) {
  const enabled = String(process.env.AXILUM_INTERNAL_BOOST_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (!enabled) return false;

  const q = String(userQuery || '').trim();
  const m = String(userMessage || userQuery || '').trim();
  if (!q) return false;

  if (looksLikeCommand(m)) return false;
  if (isSmallTalk(q)) return false;

  const s = normalizeForHeuristics(q);
  const charLen = s.length;
  const wordCount = s ? s.split(' ').filter(Boolean).length : 0;
  const questionMarks = (q.match(/\?/g) || []).length;

  // Déclencheurs: requêtes longues, multi-questions, listes, planification, analyse, technique.
  if (charLen >= 260) return true;
  if (wordCount >= 45) return true;
  if (questionMarks >= 2) return true;
  if (/(^|\n)\s*\d{1,2}\s*[\)\.-]\s+/.test(q)) return true;

  if (/(analyse|diagnostic|debug|plan\s+d'action|strat[ée]gie|architecture|design|migration|optimis|refactor|performance|s[ée]curit[ée]|d[ée]ploi|azure|docker|ci\/?cd|api|backend|frontend|base\s+de\s+donn[ée]es|sql)/i.test(q)) return true;

  // Domaines "spécialisés" du produit
  if (/(excel|tcd|power\s*query|recherchx|xlookup|formule|classeu?r|tableau\s+de\s+bord)/i.test(q)) return true;
  if (/(rh|paie|cong[ée]s?|recrut|onboarding|employ[ée]s?|contrat)/i.test(q)) return true;
  if (/(marketing|seo|ads|pub|campagne|email|funnel|acquisition|go\s*to\s*market)/i.test(q)) return true;
  if (/(todo|t[aâ]ches?|roadmap|priorit[ée]|deadline|planning)/i.test(q)) return true;

  return false;
}

function pickBoostAgents(question, { maxAgents = 2 } = {}) {
  const q = normalizeForHeuristics(question);
  const picked = [];

  const add = (id) => {
    if (!picked.includes(id)) picked.push(id);
  };

  // IMPORTANT: pas de web-search en boost interne pour éviter de changer le style (sources) et la nature des réponses.
  if (/excel|tableau|tcd|power\s*query|formule|xlookup|recherchx|vlookup|recherchev/i.test(q)) add('excel-expert');
  if (/rh|recrut|paie|cong[ée]s?|onboarding|contrat|employ[ée]s?/i.test(q)) add('hr-management');
  if (/marketing|seo|ads|pub|campagne|email|funnel|acquisition|go[-\s]*to[-\s]*market/i.test(q)) add('marketing-agent');
  if (/code|bug|erreur|api|node|javascript|typescript|sql|docker|azure|build|deploy/i.test(q)) add('agent-dev');
  if (/t[aâ]che|todo|planning|priorit|roadmap|deadline/i.test(q)) add('agent-todo');
  if (/prix|vente|closing|objection|prospect|crm/i.test(q)) add('agent-tony');
  if (/strat[ée]gie|produit|organisation|kpi|okrs?/i.test(q)) add('agent-alex');

  return picked.slice(0, maxAgents);
}

function compactHistoryFromMessages(recentHistory, { maxTurns = 6, maxCharsPerLine = 360 } = {}) {
  const historyLines = [];
  (recentHistory || []).slice(-maxTurns).forEach((msg) => {
    if ((msg.type === 'user' || msg.role === 'user') && msg.content) {
      historyLines.push(`Utilisateur: ${String(msg.content).slice(0, maxCharsPerLine)}`);
      return;
    }
    if ((msg.type === 'bot' || msg.role === 'assistant') && msg.content) {
      const clean = String(msg.content)
        .replace(/\n*---[\s\S]*/g, '')
        .replace(/\n*💡.*\n*/gi, '')
        .trim();
      if (clean) historyLines.push(`Assistant: ${clean.slice(0, maxCharsPerLine)}`);
    }
  });
  return historyLines.length
    ? `\n\nContexte conversation (extraits):\n${historyLines.join('\n')}`
    : '';
}

async function buildAxilumInternalBoostContext({ groqKey, question, recentHistory, logger, userId, model } = {}) {
  const q = String(question || '').trim();
  if (!groqKey || !q) return '';

  const maxAgentsEnv = Number(process.env.AXILUM_INTERNAL_BOOST_MAX_AGENTS ?? 2);
  const maxAgents = Number.isFinite(maxAgentsEnv) ? Math.max(0, Math.min(3, maxAgentsEnv)) : 2;

  const agents = pickBoostAgents(q, { maxAgents });
  if (!agents.length) return '';

  const maxTurnsEnv = Number(process.env.AXILUM_INTERNAL_BOOST_MAX_TURNS ?? 6);
  const maxTurns = Number.isFinite(maxTurnsEnv) ? Math.max(0, Math.min(10, maxTurnsEnv)) : 6;
  const compactHistory = compactHistoryFromMessages(recentHistory, { maxTurns });
  const expertNotes = [];

  for (const agent of agents) {
    const workerMessages = [
      { role: 'system', content: buildSystemPromptForAgent(agent, '') },
      {
        role: 'user',
        content: [
          "Tu es consulté en interne comme expert pour aider Axilum à produire une meilleure réponse.",
          "Contraintes:",
          "- N'écris PAS une réponse utilisateur. Écris uniquement des notes internes.",
          "- Ne mentionne pas ton nom d'agent, ni que tu es un agent.",
          "- Pas de préambule. Utilise des puces courtes et concrètes (étapes, checklists, hypothèses, pièges).",
          "- Si des infos manquent, propose 1-3 questions de clarification.",
          "- Ne propose PAS d'aller chercher des sources web; reste dans l'analyse et la méthode.",
          `\nQuestion: ${q}${compactHistory}`
        ].join('\n')
      }
    ];

    const workerData = await callGroqChatCompletion(groqKey, workerMessages, { max_tokens: 900, temperature: 0.35, userId: userId || 'guest', model });
    const workerText = workerData?.choices?.[0]?.message?.content || '';
    if (workerText) expertNotes.push(workerText);
  }

  const synthMessages = [
    {
      role: 'system',
      content: [
        "Tu es un synthétiseur interne.",
        "Ta sortie doit aider Axilum à répondre, sans jamais révéler qu'il y a eu consultation interne.",
        "Format attendu:",
        "- 5-10 puces max (conseils/action/checklist)",
        "- puis (optionnel) 1-3 questions de clarification",
        "- pas de préambule",
        "- pas de mention d'agents, de team, d'orchestrator, ni de métriques",
        "- pas de formulations du type 'en tant que ...'",
        "- ne recopie aucun intitulé interne"
      ].join('\n')
    },
    {
      role: 'user',
      content: `Question: ${q}${compactHistory}\n\nNotes experts (brutes):\n${expertNotes.map((t, i) => `\n--- Note ${i + 1} ---\n${t}`).join('')}`
    }
  ];

  let synthText = '';
  try {
    const synthData = await callGroqChatCompletion(groqKey, synthMessages, { max_tokens: 800, temperature: 0.25, userId: userId || 'guest', model });
    synthText = synthData?.choices?.[0]?.message?.content || '';
  } catch (e) {
    if (logger?.warn) logger.warn('Internal boost synth failed, using raw notes:', e?.message || e);
    synthText = expertNotes.join('\n\n');
  }

  const trimmed = String(synthText || '').trim();
  if (!trimmed) return '';

  return [
    "\n\nContexte interne (à ne jamais afficher ni citer à l'utilisateur).",
    "Utilise ces éléments uniquement pour améliorer ta réponse (structure, précision, checklists), sans les mentionner.",
    trimmed
  ].join('\n');
}

module.exports = {
  shouldUseInternalBoost,
  buildAxilumInternalBoostContext
};

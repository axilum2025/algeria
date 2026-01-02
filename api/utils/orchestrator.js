const {
  ALLOWED_AGENT_IDS,
  normalizeAgentId,
  pickTeamAgents,
  buildSystemPromptForAgent
} = require('./agentRegistry');

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function compactHistoryFromMessages(recentHistory, { maxTurns = 8, maxCharsPerLine = 400 } = {}) {
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

async function callGroqChatCompletion(groqKey, messages, { max_tokens = 1400, temperature = 0.5 } = {}) {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens, temperature })
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    const err = new Error(`Groq Error: ${resp.status}`);
    err.details = errorText;
    err.status = resp.status;
    throw err;
  }

  return await resp.json();
}

function heuristicPickAgents(question) {
  const q = String(question || '').toLowerCase();
  const picked = [];

  const add = (id) => {
    if (!picked.includes(id) && ALLOWED_AGENT_IDS.includes(id)) picked.push(id);
  };

  if (/excel|tableau|tcd|power\s*query|formule|xlookup|recherchx|vlookup|recherchev/i.test(q)) add('excel-expert');
  if (/marketing|seo|ads|pub|campagne|email|funnel|acquisition|go[-\s]*to[-\s]*market/i.test(q)) add('marketing-agent');
  if (/rh|recrut|paie|cong[ée]s?|onboarding|contrat|employ[ée]s?/i.test(q)) add('hr-management');
  if (/t[aâ]che|todo|planning|priorit|roadmap|deadline/i.test(q)) add('agent-todo');
  if (/prix|vente|closing|objection|prospect|onboarding client|crm/i.test(q)) add('agent-tony');
  if (/strat[ée]gie|produit|organisation|kpi|okrs?/i.test(q)) add('agent-alex');
  if (/r[ée]cent|2024|2025|nouveaut[ée]s?|tendance|actualit[ée]s?|state of the art|\bweb\b/i.test(q)) add('web-search');
  if (/code|bug|erreur|api|node|javascript|typescript|sql|docker|azure|build|deploy/i.test(q)) add('agent-dev');

  if (picked.length === 0) add('axilum');

  return picked.slice(0, 3);
}

async function planAgentsWithLLM({ groqKey, teamQuestion, compactHistory, contextFromSearch = '' }) {
  const system = `Tu es un routeur multi-agents.

Ta tâche: choisir jusqu'à 3 agents pertinents pour répondre à la question.

Contraintes:
- Réponds UNIQUEMENT en JSON valide, sans texte autour.
- Schéma: {"agents": ["agent-id", ...]}
- Les agents possibles sont uniquement: ${ALLOWED_AGENT_IDS.join(', ')}
- Maximum 3 agents.
- Si tu n'es pas sûr, choisis "axilum".
`;

  const user = `Question: ${teamQuestion}${compactHistory}\n${contextFromSearch}`;

  const data = await callGroqChatCompletion(groqKey, [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ], { max_tokens: 250, temperature: 0.1 });

  const raw = data?.choices?.[0]?.message?.content || '';
  const parsed = safeJsonParse(raw);
  const agents = Array.isArray(parsed?.agents) ? parsed.agents : [];

  const normalized = agents
    .map(normalizeAgentId)
    .filter(Boolean)
    .filter(a => a !== 'auto');

  const unique = Array.from(new Set(normalized)).slice(0, 3);
  return unique.length ? unique : ['axilum'];
}

async function orchestrateMultiAgents({
  groqKey,
  teamQuestion,
  teamAgentsRaw,
  recentHistory,
  braveKey,
  searchBrave,
  toolsContext,
  analyzeHallucination,
  logger,
  maxAgents = 3
}) {
  const question = String(teamQuestion || '').trim();
  if (!question) {
    return { ok: false, error: 'Question vide. Utilisez: /team dev marketing -- votre question' };
  }

  const askedAgents = Array.isArray(teamAgentsRaw) ? teamAgentsRaw : [];
  const askedNormalized = askedAgents.map(normalizeAgentId).filter(Boolean);
  const wantsAuto = askedNormalized.length === 0 || askedNormalized.includes('auto');

  const compactHistory = compactHistoryFromMessages(recentHistory, { maxTurns: 8, maxCharsPerLine: 400 });

  // Web search context only if chosen agents include web-search.
  let contextFromSearch = '';
  const toolsCtx = String(toolsContext || '').trim();

  // Determine agents
  let teamAgents;
  if (wantsAuto) {
    try {
      // only try search for planner if braveKey exists and question looks time-sensitive
      const mayNeedSearch = /r[ée]cent|2024|2025|nouveaut[ée]s?|tendance|actualit[ée]s?|state of the art/i.test(question);
      if (braveKey && mayNeedSearch && typeof searchBrave === 'function') {
        const results = await searchBrave(question, braveKey);
        if (results && results.length > 0) {
          contextFromSearch = '\n\nContexte de recherche web (utilise ces informations si pertinentes) :\n';
          results.slice(0, 3).forEach((r, i) => {
            contextFromSearch += `${i + 1}. ${r.title}: ${r.description} [${r.url}]\n`;
          });
        }
      }

      teamAgents = await planAgentsWithLLM({ groqKey, teamQuestion: question, compactHistory, contextFromSearch });
    } catch (e) {
      if (logger?.warn) logger.warn('Planner failed, using heuristics:', e?.message || e);
      teamAgents = heuristicPickAgents(question);
    }
  } else {
    teamAgents = pickTeamAgents(askedNormalized, { maxAgents });
  }

  // If planner picked web-search, fetch search context
  if (teamAgents.includes('web-search')) {
    try {
      if (braveKey && typeof searchBrave === 'function') {
        const results = await searchBrave(question, braveKey);
        if (results && results.length > 0) {
          contextFromSearch = '\n\nContexte de recherche web (utilise ces informations si pertinentes) :\n';
          results.slice(0, 3).forEach((r, i) => {
            contextFromSearch += `${i + 1}. ${r.title}: ${r.description} [${r.url}]\n`;
          });
        }
      }
    } catch (_) {
      // ignore
    }
  }

  // Combine contexts for worker system prompts
  let combinedContext = contextFromSearch || '';
  if (toolsCtx) {
    combinedContext += `\n\nContexte outils (résultats déjà obtenus, à utiliser si pertinent):\n${toolsCtx}\n`;
  }

  const workerOutputs = [];
  let totalTokensUsed = 0;

  for (const agent of teamAgents) {
    const workerMessages = [
      { role: 'system', content: buildSystemPromptForAgent(agent, combinedContext) },
      {
        role: 'user',
        content: `Tu es consulté comme expert (${agent}).\nRéponds de façon concise et actionnable.\n\nQuestion: ${question}${compactHistory}${toolsCtx ? `\n\nRésultats d'outils disponibles:\n${toolsCtx}` : ''}`
      }
    ];

    const workerData = await callGroqChatCompletion(groqKey, workerMessages, { max_tokens: 1200, temperature: 0.5 });
    const workerText = workerData?.choices?.[0]?.message?.content || '';
    totalTokensUsed += workerData?.usage?.total_tokens || 0;
    workerOutputs.push({ agent, text: workerText });
  }

  const synthMessages = [
    {
      role: 'system',
      content: `Tu es un Orchestrateur multi-agents.\n\nObjectif: produire UNE réponse finale à l'utilisateur, en te basant sur les analyses de plusieurs experts.\n\nRègles:\n- Ne mentionne pas les noms/ids des agents ni le fait qu'ils existent.\n- Fusionne, déduplique, et tranche quand il y a des divergences (explique brièvement le compromis).\n- Donne un plan d'action clair et priorisé.\n- Si une info manque, pose 1-3 questions courtes en fin.\n\nRéponds en français, clairement et professionnellement.`
    },
    {
      role: 'user',
      content: `Question utilisateur: ${question}\n\n${toolsCtx ? `Résultats d'outils (déjà obtenus):\n${toolsCtx}\n\n` : ''}Notes d'experts:\n${workerOutputs.map(w => `\n[${w.agent}]\n${w.text}`).join('\n')}`
    }
  ];

  const synthData = await callGroqChatCompletion(groqKey, synthMessages, { max_tokens: 1600, temperature: 0.6 });
  const aiResponse = synthData?.choices?.[0]?.message?.content || '';
  totalTokensUsed += synthData?.usage?.total_tokens || 0;

  let hallucinationAnalysis;
  try {
    hallucinationAnalysis = await analyzeHallucination(aiResponse, question);
  } catch (analysisError) {
    if (logger?.warn) logger.warn('Hallucination analysis failed, using defaults:', analysisError?.message || analysisError);
    hallucinationAnalysis = { hi: 0, chr: 0, claims: [], counts: {}, sources: [], warning: null, method: 'fallback-error' };
  }

  const hiPercent = (hallucinationAnalysis.hi * 100).toFixed(1);
  const chrPercent = (hallucinationAnalysis.chr * 100).toFixed(1);

  let metricsText = `\n\n---\n📊 **Métriques de Fiabilité**\nHI: ${hiPercent}% | CHR: ${chrPercent}%`;
  if (hallucinationAnalysis.warning) metricsText += `\n${hallucinationAnalysis.warning}`;
  if (hallucinationAnalysis.sources && hallucinationAnalysis.sources.length > 0) {
    metricsText += `\n\n📚 Sources: ${hallucinationAnalysis.sources.join(', ')}`;
  }
  metricsText += `\n💡 *Orchestrateur - ${totalTokensUsed} tokens utilisés*`;

  return {
    ok: true,
    response: aiResponse + metricsText,
    tokensUsed: totalTokensUsed,
    orchestratorAgents: teamAgents,
    hallucination: {
      hiPercent: parseFloat(hiPercent),
      chrPercent: parseFloat(chrPercent),
      claims: hallucinationAnalysis.claims || [],
      counts: hallucinationAnalysis.counts || {},
      sources: hallucinationAnalysis.sources || [],
      method: hallucinationAnalysis.method || 'unknown'
    }
  };
}

module.exports = {
  callGroqChatCompletion,
  orchestrateMultiAgents
};

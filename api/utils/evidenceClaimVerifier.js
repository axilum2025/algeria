const { assertWithinBudget, recordUsage } = require('./aiUsageBudget');
const { precheckCredit, debitAfterUsage } = require('./aiCreditGuard');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

function normalizeLang(lang) {
  const raw = String(lang || '').toLowerCase();
  return raw.startsWith('en') ? 'en' : 'fr';
}

function computeHiFromCounts(counts) {
  const total = Number(counts?.total || 0);
  if (!total) return 0;
  const notSupported = Number(counts?.not_supported || 0);
  const contradictory = Number(counts?.contradictory || 0);
  const hi = (0.5 * notSupported + 1.0 * contradictory) / total;
  return Math.max(0, Math.min(1, hi));
}

function computeCounts(claims) {
  const out = { supported: 0, not_supported: 0, contradictory: 0, total: 0 };
  const arr = Array.isArray(claims) ? claims : [];
  for (const c of arr) {
    if (!c || !c.classification) continue;
    out.total += 1;
    if (c.classification === 'SUPPORTED') out.supported += 1;
    else if (c.classification === 'NOT_SUPPORTED') out.not_supported += 1;
    else if (c.classification === 'CONTRADICTORY') out.contradictory += 1;
  }
  return out;
}

function formatEvidence(evidenceItems, maxItems = 8) {
  const items = Array.isArray(evidenceItems) ? evidenceItems.slice(0, maxItems) : [];
  return items
    .map((it, idx) => {
      const title = it?.title ? String(it.title) : '';
      const url = it?.url ? String(it.url) : '';
      const snippet = it?.description ? String(it.description) : '';
      return [
        `E${idx + 1}:`,
        title ? `TITLE: ${title}` : null,
        url ? `URL: ${url}` : null,
        snippet ? `SNIPPET: ${snippet}` : null
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

function buildPrompt({ lang, claimText, evidenceItems }) {
  const normalized = normalizeLang(lang);
  const evidenceBlock = formatEvidence(evidenceItems);

  if (normalized === 'en') {
    return `You are a strict evidence-based fact-checker.

You MUST decide the classification using ONLY the evidence snippets below. If the evidence does not directly support or contradict the claim, answer NOT_SUPPORTED.

Important: treat clear logical implications as valid *only if they are grounded in the evidence*.
Examples:
- If evidence states the Sun emits visible light / is bright / appears white-yellow, that contradicts a claim that "the Sun is black" (as an apparent color claim).
- If evidence states the opposite explicitly, classify accordingly.

CLASSIFICATIONS:
- SUPPORTED: evidence directly supports the claim
- CONTRADICTORY: evidence directly contradicts the claim
- NOT_SUPPORTED: insufficient/unclear evidence

OUTPUT RULES:
- Reply ONLY valid JSON.
- Include rationale that references evidence ids (E1, E2...).
- Do not use prior knowledge.

CLAIM:
${claimText}

EVIDENCE:
${evidenceBlock || '(no evidence)'}

EXPECTED JSON:
{
  "classification": "SUPPORTED|NOT_SUPPORTED|CONTRADICTORY",
  "confidence": "high|medium|low",
  "rationale": "short explanation referencing E1/E2",
  "evidenceUsed": ["E1","E2"]
}`;
  }

  return `Tu es un fact-checker strict basé sur des preuves.

Tu DOIS décider la classification en utilisant UNIQUEMENT les extraits ci-dessous. Si les preuves ne confirment ni ne contredisent directement, réponds NOT_SUPPORTED.

Important : tu peux utiliser des implications logiques claires uniquement si elles sont ancrées dans les extraits.
Exemples :
- Si un extrait indique que le Soleil émet de la lumière visible / est lumineux / apparaît blanc-jaune, cela contredit une claim disant que « le Soleil est noir » (couleur apparente).
- Si un extrait indique explicitement l'inverse, classe en conséquence.

CLASSIFICATIONS:
- SUPPORTED : les preuves confirment directement
- CONTRADICTORY : les preuves contredisent directement
- NOT_SUPPORTED : preuves insuffisantes / ambiguës

RÈGLES:
- Réponds UNIQUEMENT en JSON valide.
- Fournis une justification courte qui cite des ids de preuves (E1, E2...).
- N'utilise pas de connaissances externes.

CLAIM:
${claimText}

PREUVES:
${evidenceBlock || '(aucune preuve)'}

JSON ATTENDU:
{
  "classification": "SUPPORTED|NOT_SUPPORTED|CONTRADICTORY",
  "confidence": "high|medium|low",
  "rationale": "explication courte avec E1/E2",
  "evidenceUsed": ["E1","E2"]
}`;
}

async function callGroq({ userId, lang, claimText, evidenceItems }) {
  const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY non configurée');

  await assertWithinBudget({ provider: 'Groq', route: 'evidenceClaimVerifier', userId: userId || '' });

  const prompt = buildPrompt({ lang, claimText, evidenceItems });
  const messages = [
    { role: 'system', content: 'Reply only valid JSON.' },
    { role: 'user', content: prompt }
  ];

  await precheckCredit({
    userId: userId || 'guest',
    model: GROQ_MODEL,
    messages,
    maxTokens: 500
  });

  const startedAt = Date.now();
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.0,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  await debitAfterUsage({ userId: userId || 'guest', model: data?.model || GROQ_MODEL, usage: data?.usage });

  try {
    await recordUsage({
      provider: 'Groq',
      model: data?.model || GROQ_MODEL,
      route: 'evidenceClaimVerifier',
      userId: String(userId || ''),
      usage: data?.usage,
      latencyMs: Date.now() - startedAt,
      ok: true
    });
  } catch (_) {
    // best-effort
  }

  const text = data?.choices?.[0]?.message?.content || '';
  return JSON.parse(text);
}

async function callGemini({ lang, claimText, evidenceItems }) {
  const geminiKey = process.env.APPSETTING_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('GEMINI_API_KEY non configurée');

  const prompt = buildPrompt({ lang, claimText, evidenceItems });
  const res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 500,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Pas de JSON valide dans la réponse Gemini');
  return JSON.parse(jsonMatch[0]);
}

async function verifyClaimsWithEvidence({ claims, evidenceByClaim, lang, userId } = {}) {
  const claimTexts = Array.isArray(claims) ? claims.map(c => (c && c.text ? String(c.text) : String(c || ''))).filter(Boolean) : [];
  const normalized = normalizeLang(lang);

  const results = [];

  for (const claimText of claimTexts.slice(0, 6)) {
    const evidenceItems = (evidenceByClaim && evidenceByClaim[claimText]) ? evidenceByClaim[claimText] : [];

    let verdict = null;
    try {
      verdict = await callGroq({ userId, lang: normalized, claimText, evidenceItems });
    } catch (_) {
      try {
        verdict = await callGemini({ lang: normalized, claimText, evidenceItems });
      } catch (_) {
        verdict = {
          classification: 'NOT_SUPPORTED',
          confidence: 'low',
          rationale: normalized === 'en'
            ? 'Automatic evidence evaluation unavailable (no model key).'
            : 'Évaluation automatique indisponible (pas de clé modèle).',
          evidenceUsed: []
        };
      }
    }

    const classificationRaw = String(verdict?.classification || 'NOT_SUPPORTED').toUpperCase();
    const classification = (classificationRaw === 'SUPPORTED' || classificationRaw === 'CONTRADICTORY' || classificationRaw === 'NOT_SUPPORTED')
      ? classificationRaw
      : 'NOT_SUPPORTED';

    results.push({
      text: claimText,
      classification,
      score: classification === 'SUPPORTED' ? 1.0 : classification === 'CONTRADICTORY' ? 0.0 : 0.5,
      confidence: String(verdict?.confidence || 'low'),
      rationale: String(verdict?.rationale || ''),
      evidenceUsed: Array.isArray(verdict?.evidenceUsed) ? verdict.evidenceUsed : [],
      evidence: Array.isArray(evidenceItems) ? evidenceItems.slice(0, 8) : []
    });
  }

  const counts = computeCounts(results);
  const hi = computeHiFromCounts(counts);

  return {
    method: 'evidence',
    lang: normalized,
    claims: results,
    counts,
    hi,
    // CHR minimal: on ne fait pas d'analyse linguistique ici; on s'aligne sur HI.
    chr: hi
  };
}

module.exports = {
  verifyClaimsWithEvidence,
  normalizeLang
};

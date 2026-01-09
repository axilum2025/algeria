const { assertWithinBudget, recordUsage } = require('./aiUsageBudget');
const { precheckCredit, debitAfterUsage } = require('./aiCreditGuard');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

function normalizeLang(lang) {
  const raw = String(lang || '').toLowerCase();
  return raw.startsWith('en') ? 'en' : 'fr';
}

function buildPrompt({ lang, claimText }) {
  const normalized = normalizeLang(lang);
  if (normalized === 'en') {
    return `You generate search queries for web verification.

TASK:
Given a claim, propose up to 5 concise search queries that maximize the chance of retrieving authoritative evidence.

RULES:
- Do NOT invent facts. Only rewrite the claim into query variants.
- Prefer authoritative sources when helpful: site:wikipedia.org, site:britannica.com, site:nasa.gov, site:esa.int, site:larousse.fr.
- If the claim contains numbers/units, include unit-normalized variants (e.g., 300,000 km/s and 299,792,458 m/s for speed of light).
- Output ONLY valid JSON.

CLAIM:
${claimText}

EXPECTED JSON:
{
  "queries": ["..."],
  "notes": "short"
}`;
  }

  return `Tu génères des requêtes de recherche pour une vérification web.

TÂCHE:
À partir d'une claim, propose jusqu'à 5 requêtes courtes qui maximisent la chance d'obtenir des preuves autoritatives.

RÈGLES:
- N'invente pas de faits. Reformule uniquement la claim en variantes de recherche.
- Privilégie des sources autoritatives si utile : site:fr.wikipedia.org, site:wikipedia.org, site:britannica.com, site:nasa.gov, site:esa.int, site:larousse.fr.
- Si la claim contient des nombres/unités, ajoute des variantes normalisées d'unités (ex: 300 000 km/s et 299 792 458 m/s pour la vitesse de la lumière).
- Réponds UNIQUEMENT en JSON valide.

CLAIM:
${claimText}

JSON ATTENDU:
{
  "queries": ["..."],
  "notes": "court"
}`;
}

async function callGroq({ userId, lang, claimText }) {
  const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY non configurée');

  await assertWithinBudget({ provider: 'Groq', route: 'claimSearchQueryGenerator', userId: userId || '' });

  const prompt = buildPrompt({ lang, claimText });
  const messages = [
    { role: 'system', content: 'Reply only valid JSON.' },
    { role: 'user', content: prompt }
  ];

  await precheckCredit({
    userId: userId || 'guest',
    model: GROQ_MODEL,
    messages,
    maxTokens: 250
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
      max_tokens: 250,
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
      route: 'claimSearchQueryGenerator',
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

async function callGemini({ lang, claimText }) {
  const geminiKey = process.env.APPSETTING_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('GEMINI_API_KEY non configurée');

  const prompt = buildPrompt({ lang, claimText });
  const res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 250,
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

function sanitizeQueries(queries) {
  const arr = Array.isArray(queries) ? queries : [];
  const cleaned = arr
    .map(q => String(q || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(q => q.length >= 4)
    .slice(0, 5);
  return [...new Set(cleaned)];
}

async function generateSearchQueries({ claimText, lang, userId } = {}) {
  const normalized = normalizeLang(lang);
  const text = String(claimText || '').trim();
  if (!text) return { queries: [], notes: 'empty' };

  try {
    const out = await callGroq({ userId, lang: normalized, claimText: text });
    return { queries: sanitizeQueries(out?.queries), notes: String(out?.notes || '') };
  } catch (_) {
    try {
      const out = await callGemini({ lang: normalized, claimText: text });
      return { queries: sanitizeQueries(out?.queries), notes: String(out?.notes || '') };
    } catch (_) {
      return { queries: [], notes: 'unavailable' };
    }
  }
}

module.exports = {
  generateSearchQueries,
  normalizeLang
};

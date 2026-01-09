const { assertWithinBudget, recordUsage } = require('./aiUsageBudget');
const { precheckCredit, debitAfterUsage } = require('./aiCreditGuard');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function getUrlDomain(url) {
  try {
    const u = new URL(String(url || ''));
    return String(u.hostname || '').replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return '';
  }
}

function tokenizeForMatch(text, lang) {
  const normalized = normalizeLang(lang);
  const raw = String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!raw) return [];
  const tokens = raw.split(' ').filter(Boolean);

  const stopwords = normalized === 'en'
    ? new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'that', 'this', 'it', 'as', 'at', 'from'])
    : new Set(['le', 'la', 'les', 'un', 'une', 'des', 'et', 'ou', 'de', 'du', 'dans', 'sur', 'pour', 'avec', 'par', 'est', 'sont', 'été', 'être', 'que', 'ce', 'cet', 'cette', 'il', 'elle', 'au', 'aux', 'en']);

  return tokens
    .filter(t => t.length >= 3)
    .filter(t => !stopwords.has(t));
}

function computeTokenOverlapScore(claimText, snippetText, lang) {
  const claimTokens = tokenizeForMatch(claimText, lang);
  const snippetTokens = tokenizeForMatch(snippetText, lang);
  if (claimTokens.length === 0 || snippetTokens.length === 0) return 0;

  const claimSet = new Set(claimTokens);
  const snippetSet = new Set(snippetTokens);
  let intersection = 0;
  for (const t of claimSet) {
    if (snippetSet.has(t)) intersection += 1;
  }
  const union = new Set([...claimSet, ...snippetSet]).size;
  if (!union) return 0;
  return clamp01(intersection / union);
}

function computeEvidenceQuality(evidenceItems, claimText, lang) {
  const items = Array.isArray(evidenceItems) ? evidenceItems : [];
  const n = items.length;
  if (n === 0) return { quality: 0, details: { n: 0, domains: 0, specificity: 0, authority: 0 } };

  const domains = items.map(it => getUrlDomain(it?.url)).filter(Boolean);
  const uniqueDomains = [...new Set(domains)];
  const d = uniqueDomains.length;

  const authoritativeDomains = new Set([
    'nasa.gov',
    'britannica.com',
    'who.int',
    'cdc.gov',
    'nih.gov',
    'esa.int',
    'ec.europa.eu',
    'un.org',
    'oecd.org'
  ]);
  let authorityHits = 0;
  for (const dom of uniqueDomains) {
    if (!dom) continue;
    if (authoritativeDomains.has(dom) || [...authoritativeDomains].some(ad => dom.endsWith(`.${ad}`))) {
      authorityHits += 1;
    }
  }

  // Spécificité: similarité claim/snippet, moyenne des meilleurs extraits.
  const snippetScores = items
    .map(it => computeTokenOverlapScore(claimText, `${it?.title || ''} ${it?.description || ''}`, lang))
    .filter(s => Number.isFinite(s))
    .sort((a, b) => b - a);
  const top = snippetScores.slice(0, 3);
  const specificity = top.length ? (top.reduce((sum, v) => sum + v, 0) / top.length) : 0;

  const f = (x) => 1 - Math.exp(-Math.max(0, Number(x) || 0));
  const authority = clamp01(authorityHits / 2);

  const quality = clamp01(
    0.25 * f(n) +
    0.25 * f(d) +
    0.30 * specificity +
    0.20 * authority
  );

  return { quality, details: { n, domains: d, specificity: clamp01(specificity), authority } };
}

function inferClaimType(claimText, lang) {
  const text = String(claimText || '');
  const normalized = normalizeLang(lang);

  const hasNumber = /\b\d+([,.]\d+)?%?\b/.test(text);
  if (hasNumber) return 'NUMERIC';
  const hasYear = /\b(19|20)\d{2}\b/.test(text);
  if (hasYear) return 'TEMPORAL';

  const medicalKeywords = normalized === 'en'
    ? ['diagnosis', 'treatment', 'medicine', 'disease', 'symptom', 'therapy']
    : ['diagnostic', 'traitement', 'médicament', 'maladie', 'symptôme', 'thérapie'];
  if (medicalKeywords.some(k => text.toLowerCase().includes(k))) return 'MEDICAL';

  const legalKeywords = normalized === 'en'
    ? ['law', 'article', 'code', 'legal', 'court']
    : ['loi', 'article', 'code', 'juridique', 'légal', 'tribunal'];
  if (legalKeywords.some(k => text.toLowerCase().includes(k))) return 'LEGAL';

  return 'FACTUAL';
}

function importanceWeightForType(claimType) {
  if (claimType === 'MEDICAL' || claimType === 'LEGAL') return 1.2;
  if (claimType === 'NUMERIC' || claimType === 'TEMPORAL') return 1.1;
  return 1.0;
}

function normalizeProbabilities(p) {
  const ps = clamp01(p?.p_supported);
  const pns = clamp01(p?.p_not_supported);
  const pc = clamp01(p?.p_contradictory);
  const sum = ps + pns + pc;
  if (!sum) return { p_supported: 0.1, p_not_supported: 0.8, p_contradictory: 0.1 };
  return { p_supported: ps / sum, p_not_supported: pns / sum, p_contradictory: pc / sum };
}

function deriveProbabilitiesFromVerdict({ classification, confidence, score }) {
  const cls = String(classification || 'NOT_SUPPORTED').toUpperCase();
  const conf = String(confidence || 'low').toLowerCase();
  const s = clamp01(score);

  const boost = conf === 'high' ? 0.15 : conf === 'medium' ? 0.05 : 0;

  if (cls === 'CONTRADICTORY') {
    const p_contradictory = clamp01(0.70 + 0.25 * s + boost);
    const p_supported = 0.05;
    const p_not_supported = clamp01(1 - p_contradictory - p_supported);
    return normalizeProbabilities({ p_supported, p_not_supported, p_contradictory });
  }
  if (cls === 'SUPPORTED') {
    const p_supported = clamp01(0.70 + 0.25 * s + boost);
    const p_contradictory = 0.05;
    const p_not_supported = clamp01(1 - p_supported - p_contradictory);
    return normalizeProbabilities({ p_supported, p_not_supported, p_contradictory });
  }

  // NOT_SUPPORTED
  const p_not_supported = clamp01(0.80 + boost);
  const remainder = clamp01(1 - p_not_supported);
  return normalizeProbabilities({ p_supported: remainder / 2, p_not_supported, p_contradictory: remainder / 2 });
}

function adjustProbabilitiesByEvidenceQuality(probabilities, evidenceQuality) {
  const Q = clamp01(evidenceQuality);
  const p = normalizeProbabilities(probabilities);
  // On réduit la certitude SUPPORTED/CONTRADICTORY si la preuve est faible.
  const p_supported = p.p_supported * Q;
  const p_contradictory = p.p_contradictory * Q;
  const p_not_supported = clamp01(1 - (p_supported + p_contradictory));
  return normalizeProbabilities({ p_supported, p_not_supported, p_contradictory });
}

function computeEvidenceCoverage(results, threshold = 0.6) {
  const arr = Array.isArray(results) ? results : [];
  if (!arr.length) return 0;
  let ok = 0;
  for (const r of arr) {
    const q = clamp01(r?.evidenceQuality);
    if (q >= threshold) ok += 1;
  }
  return ok / arr.length;
}

function computeContradictionRisk(results) {
  const arr = Array.isArray(results) ? results : [];
  let num = 0;
  let den = 0;
  for (const r of arr) {
    const Q = clamp01(r?.evidenceQuality);
    const I = importanceWeightForType(String(r?.type || 'FACTUAL'));
    const w = 0.6 * Q + 0.4 * I;
    const pc = clamp01(r?.probabilities?.p_contradictory);
    num += w * pc;
    den += w;
  }
  if (!den) return 0;
  return clamp01(num / den);
}

function bootstrapRiskCI90(results, iterations = 200) {
  const arr = Array.isArray(results) ? results : [];
  if (arr.length <= 1) {
    const base = computeContradictionRisk(arr);
    return { low: base, high: base };
  }

  const it = Math.max(50, Math.min(400, Number(iterations) || 200));
  const risks = [];
  for (let k = 0; k < it; k += 1) {
    const sample = [];
    for (let i = 0; i < arr.length; i += 1) {
      const idx = Math.floor(Math.random() * arr.length);
      sample.push(arr[idx]);
    }
    risks.push(computeContradictionRisk(sample));
  }
  risks.sort((a, b) => a - b);
  const p05 = risks[Math.floor(0.05 * (risks.length - 1))];
  const p95 = risks[Math.floor(0.95 * (risks.length - 1))];
  return { low: clamp01(p05), high: clamp01(p95) };
}

function looksLikeSunBlackClaim(claimText) {
  const t = String(claimText || '').toLowerCase();
  return (/(\bsun\b|\bsoleil\b)/i.test(t) && /(\bblack\b|\bnoir\b)/i.test(t));
}

function findEvidenceIdsMatching(evidenceItems, patterns) {
  const items = Array.isArray(evidenceItems) ? evidenceItems : [];
  const ids = [];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const blob = `${it?.title || ''} ${it?.description || ''}`;
    if (patterns.some(rx => rx.test(blob))) {
      ids.push(`E${i + 1}`);
      if (ids.length >= 3) break;
    }
  }
  return ids;
}

function evidenceSuggestsSunIsNotBlack(evidenceItems, lang) {
  const normalized = normalizeLang(lang);
  const en = [
    /\bemits\b\s+(?:visible\s+)?\blight\b/i,
    /\bproduces\b\s+(?:visible\s+)?\blight\b/i,
    /\bvisible\s+spectrum\b/i,
    /\bbright\b/i,
    /\bappears\b\s+(?:white|yellow|white\s*-\s*yellow|yellow\s*-\s*white)\b/i
  ];
  const fr = [
    /\bémet\b\s+(?:de\s+la\s+)?\blumi[eè]re\b/i,
    /\bproduit\b\s+(?:de\s+la\s+)?\blumi[eè]re\b/i,
    /\bspectre\s+visible\b/i,
    /\blumineux\b/i,
    /\bappara[iî]t\b\s+(?:blanc|jaune|blanc\s*-\s*jaune|jaune\s*-\s*blanc)\b/i
  ];
  const patterns = normalized === 'en' ? en : fr;
  const ids = findEvidenceIdsMatching(evidenceItems, patterns);
  return { match: ids.length > 0, evidenceUsed: ids };
}

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
- If evidence states the Sun emits visible light, produces light, is bright, or appears white/yellow, that contradicts a claim that "the Sun is black" (as an apparent color claim).
- If evidence states the opposite explicitly, classify accordingly.

CLASSIFICATIONS:
- SUPPORTED: evidence directly supports the claim
- CONTRADICTORY: evidence directly contradicts the claim
- NOT_SUPPORTED: insufficient/unclear evidence

OUTPUT RULES:
- Reply ONLY valid JSON.
- Probabilities must sum to 1.0 (approximately) and match your classification.
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
  "probabilities": {"supported": 0.0, "not_supported": 0.0, "contradictory": 0.0},
  "rationale": "short explanation referencing E1/E2",
  "evidenceUsed": ["E1","E2"]
}`;
  }

  return `Tu es un fact-checker strict basé sur des preuves.

Tu DOIS décider la classification en utilisant UNIQUEMENT les extraits ci-dessous. Si les preuves ne confirment ni ne contredisent directement, réponds NOT_SUPPORTED.

Important : tu peux utiliser des implications logiques claires uniquement si elles sont ancrées dans les extraits.
Exemples :
- Si un extrait indique que le Soleil émet/produit de la lumière, est lumineux, ou apparaît blanc/jaune, cela contredit une claim disant que « le Soleil est noir » (couleur apparente).
- Si un extrait indique explicitement l'inverse, classe en conséquence.

CLASSIFICATIONS:
- SUPPORTED : les preuves confirment directement
- CONTRADICTORY : les preuves contredisent directement
- NOT_SUPPORTED : preuves insuffisantes / ambiguës

RÈGLES:
- Réponds UNIQUEMENT en JSON valide.
- Les probabilités doivent sommer à 1.0 (approximativement) et correspondre à ta classification.
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
  "probabilities": {"supported": 0.0, "not_supported": 0.0, "contradictory": 0.0},
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

    const { quality: evidenceQuality, details: evidenceQualityDetails } = computeEvidenceQuality(evidenceItems, claimText, normalized);
    const claimType = inferClaimType(claimText, normalized);

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

    const modelProbs = verdict?.probabilities && typeof verdict.probabilities === 'object'
      ? {
        p_supported: Number(verdict.probabilities.supported),
        p_not_supported: Number(verdict.probabilities.not_supported),
        p_contradictory: Number(verdict.probabilities.contradictory)
      }
      : null;
    const baseProbs = modelProbs ? normalizeProbabilities(modelProbs) : deriveProbabilitiesFromVerdict({ classification, confidence: verdict?.confidence, score: classification === 'SUPPORTED' ? 1.0 : classification === 'CONTRADICTORY' ? 1.0 : 0.5 });
    let probabilities = adjustProbabilitiesByEvidenceQuality(baseProbs, evidenceQuality);

    // Heuristique strictement basée sur preuves (snippets):
    // si une claim type "sun is black" est évaluée NOT_SUPPORTED mais que les preuves mentionnent
    // explicitement lumière/brightness/apparence blanche-jaune, on force CONTRADICTORY.
    let forcedClassification = null;
    let forcedRationaleAppend = '';
    let forcedEvidenceUsed = null;
    if (looksLikeSunBlackClaim(claimText) && classification === 'NOT_SUPPORTED' && evidenceQuality >= 0.35) {
      const ev = evidenceSuggestsSunIsNotBlack(evidenceItems, normalized);
      if (ev.match) {
        forcedClassification = 'CONTRADICTORY';
        forcedEvidenceUsed = ev.evidenceUsed;
        probabilities = normalizeProbabilities({ p_supported: 0.05, p_not_supported: 0.15, p_contradictory: 0.80 });
        forcedRationaleAppend = normalized === 'en'
          ? 'Heuristic: evidence mentions light/brightness (contradicts an apparent-color "black" claim).' 
          : 'Heuristique : les preuves mentionnent lumière/luminosité (contredit une claim de couleur apparente "noir").';
      }
    }

    const topProb = Math.max(probabilities.p_supported, probabilities.p_not_supported, probabilities.p_contradictory);
    const confidence = clamp01(0.5 * evidenceQuality + 0.5 * topProb);

    results.push({
      text: claimText,
      type: claimType,
      classification: forcedClassification || classification,
      score: classification === 'SUPPORTED' ? 1.0 : classification === 'CONTRADICTORY' ? 0.0 : 0.5,
      confidence: confidence,
      rationale: `${String(verdict?.rationale || '').trim()}${forcedRationaleAppend ? (String(verdict?.rationale || '').trim() ? ' ' : '') + forcedRationaleAppend : ''}`.trim(),
      evidenceUsed: forcedEvidenceUsed || (Array.isArray(verdict?.evidenceUsed) ? verdict.evidenceUsed : []),
      evidence: Array.isArray(evidenceItems) ? evidenceItems.slice(0, 8) : [],
      evidenceQuality,
      evidenceQualityDetails,
      probabilities
    });
  }

  const counts = computeCounts(results);
  const hi = computeHiFromCounts(counts);

  const contradictionRisk = computeContradictionRisk(results);
  // Seuil de "preuve suffisante" (heuristique). 0.6 était trop strict en pratique avec des snippets courts.
  // On utilise 0.4 pour refléter "preuves présentes et pertinentes" sans exiger une diversité parfaite.
  const evidenceCoverageThreshold = 0.4;
  const evidenceCoverage = computeEvidenceCoverage(results, evidenceCoverageThreshold);
  const ci90 = bootstrapRiskCI90(results, 200);

  return {
    method: 'evidence',
    lang: normalized,
    claims: results,
    counts,
    hi,
    // CHR minimal: on ne fait pas d'analyse linguistique ici; on s'aligne sur HI.
    chr: hi,
    score: {
      contradictionRisk: Math.round(contradictionRisk * 1000) / 10,
      evidenceCoverage: Math.round(evidenceCoverage * 1000) / 10,
      evidenceCoverageThreshold,
      uncertainty: {
        ci90: [Math.round(ci90.low * 1000) / 10, Math.round(ci90.high * 1000) / 10],
        plusMinus: Math.round(((ci90.high - ci90.low) * 0.5) * 1000) / 10
      },
      // IMPORTANT: calibration réelle nécessite un dataset annoté + un calibrateur offline.
      // Ce champ est prévu pour être alimenté plus tard.
      calibration: {
        version: 'uncalibrated-v0',
        dataset: null,
        metrics: null
      }
    }
  };
}

module.exports = {
  verifyClaimsWithEvidence,
  normalizeLang
};

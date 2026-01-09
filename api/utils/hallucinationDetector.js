// 🛡️ Système avancé de détection d'hallucinations
// Utilise des modèles GRATUITS (Groq, Gemini Flash) pour l'analyse

const { assertWithinBudget, recordUsage } = require('./aiUsageBudget');
const { precheckCredit, debitAfterUsage } = require('./aiCreditGuard');

// Configuration des modèles gratuits
const FREE_MODELS = {
    groq: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.1-8b-instant', // Ultra rapide, gratuit
        dailyLimit: 14400,
    },
    gemini: {
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
        model: 'gemini-2.0-flash-exp',
        dailyLimit: 1500,
    }
};

function normalizeLang(lang) {
    const raw = String(lang || '').toLowerCase();
    return raw.startsWith('en') ? 'en' : 'fr';
}

// Prompts optimisés pour la détection d'hallucinations
const ANALYSIS_PROMPT_FR = `Tu es un expert en fact-checking et détection d'hallucinations IA.

TÂCHES:
1. Segmente la réponse en claims atomiques vérifiables (phrases factuelles distinctes)
2. Pour chaque claim, classifie-le:
   - SUPPORTED: confirmé par des connaissances générales ou sources
   - NOT_SUPPORTED: information non vérifiable ou incertaine
   - CONTRADICTORY: clairement faux ou contradictoire

3. Calcule le Hallucination Index (HI):
   HI = (0.5 × count_not_supported + 1.0 × count_contradictory) / total_claims

4. Calcule le Composite Hallucination Risk (CHR):
   - Analyse la certitude du langage (mots comme "toujours", "jamais" = risque)
   - Analyse les nuances (mots comme "probablement", "généralement" = bon)
   - CHR = combinaison de HI + analyse linguistique

5. Liste 2-3 sources fiables pertinentes pour vérifier les informations (idéalement avec URL)

RÈGLES STRICTES:
- HI et CHR doivent être entre 0.0 et 1.0
- Si HI ≥ 0.3 ou CHR ≥ 0.3, ajoute un warning
- Les "sources" doivent être des références externes auditables (sites officiels, institutions, encyclopédies reconnues).
- INTERDIT: citer "ChatGPT", "OpenAI", "un autre modèle" comme source de vérification.
- Réponds UNIQUEMENT en JSON valide, rien d'autre

FORMAT JSON ATTENDU:
{
  "hi": 0.27,
  "chr": 0.42,
  "claims": [
    {
      "text": "Le claim exact extrait de la réponse",
      "classification": "SUPPORTED",
      "score": 1.0
    }
  ],
  "counts": {
    "supported": 5,
    "not_supported": 2,
    "contradictory": 1,
    "total": 8
  },
    "sources": ["Nom — https://exemple.org", "Nom — https://exemple2.org"],
  "warning": "⚠️ Message si HI ou CHR ≥ 0.3, null sinon"
}`;

const ANALYSIS_PROMPT_EN = `You are an expert in fact-checking and AI hallucination detection.

TASKS:
1. Segment the response into atomic, verifiable claims (distinct factual statements)
2. For each claim, classify it:
     - SUPPORTED: confirmed by general knowledge or sources
     - NOT_SUPPORTED: unverifiable or uncertain information
     - CONTRADICTORY: clearly false or contradictory

3. Compute the Hallucination Index (HI):
     HI = (0.5 × count_not_supported + 1.0 × count_contradictory) / total_claims

4. Compute the Composite Hallucination Risk (CHR):
     - Analyze certainty language (words like "always", "never" increase risk)
     - Analyze nuance (words like "probably", "generally" are good)
     - CHR = combination of HI + linguistic analysis

5. List 2-3 relevant reliable sources to verify the information (ideally with URLs)

STRICT RULES:
- HI and CHR must be between 0.0 and 1.0
- If HI ≥ 0.3 or CHR ≥ 0.3, add a warning
- "sources" must be external auditable references (official sites, institutions, reputable encyclopedias).
- FORBIDDEN: citing "ChatGPT", "OpenAI", or "another model" as a verification source.
- Reply ONLY with valid JSON, nothing else

EXPECTED JSON FORMAT:
{
    "hi": 0.27,
    "chr": 0.42,
    "claims": [
        {
            "text": "The exact claim extracted from the response",
            "classification": "SUPPORTED",
            "score": 1.0
        }
    ],
    "counts": {
        "supported": 5,
        "not_supported": 2,
        "contradictory": 1,
        "total": 8
    },
    "sources": ["Name — https://example.org", "Name — https://example2.org"],
    "warning": "⚠️ Message if HI or CHR ≥ 0.3, otherwise null"
}`;

function getAnalysisPrompt(lang) {
        return normalizeLang(lang) === 'en' ? ANALYSIS_PROMPT_EN : ANALYSIS_PROMPT_FR;
}

/**
 * Analyse avec Groq (priorité - gratuit et ultra-rapide)
 */
async function analyzeWithGroq(response, originalQuestion, { userId, lang } = {}) {
    const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
    
    if (!groqKey) {
        throw new Error('GROQ_API_KEY non configurée');
    }

    // Bloquer si le budget mensuel est dépassé
    await assertWithinBudget({ provider: 'Groq', route: 'hallucinationDetector' });

    const prompt = getAnalysisPrompt(lang);

    const messages = [
        { role: 'system', content: prompt },
        {
            role: 'user',
            content: (normalizeLang(lang) === 'en')
                ? `Original question: ${originalQuestion}\n\nResponse to analyze:\n${response}`
                : `Question originale: ${originalQuestion}\n\nRéponse à analyser:\n${response}`
        }
    ];

    await precheckCredit({
        userId: userId || 'guest',
        model: FREE_MODELS.groq.model,
        messages,
        maxTokens: 2000
    });

    const startedAt = Date.now();
    const apiResponse = await fetch(FREE_MODELS.groq.url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: FREE_MODELS.groq.model,
            messages,
            temperature: 0.1, // Déterministe
            max_tokens: 2000,
            response_format: { type: "json_object" } // Force JSON
        })
    });

    if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`Groq API error: ${apiResponse.status} - ${errorText}`);
    }

    const data = await apiResponse.json();
    await debitAfterUsage({
        userId: userId || 'guest',
        model: data?.model || FREE_MODELS.groq.model,
        usage: data?.usage
    });

    try {
        await recordUsage({
            provider: 'Groq',
            model: data?.model || FREE_MODELS.groq.model,
            route: 'hallucinationDetector',
            userId: String(userId || ''),
            usage: data?.usage,
            latencyMs: Date.now() - startedAt,
            ok: true
        });
    } catch (_) {
        // best-effort
    }
    const analysisText = data.choices[0].message.content;
    
    return JSON.parse(analysisText);
}

/**
 * Analyse avec Gemini Flash (fallback gratuit)
 */
async function analyzeWithGemini(response, originalQuestion, lang) {
    const geminiKey = process.env.APPSETTING_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!geminiKey) {
        throw new Error('GEMINI_API_KEY non configurée');
    }

    const normalized = normalizeLang(lang);
    const prompt = getAnalysisPrompt(normalized);
    const userLabelQ = (normalized === 'en') ? 'Original question' : 'Question originale';
    const userLabelA = (normalized === 'en') ? 'Response to analyze' : 'Réponse à analyser';

    const apiResponse = await fetch(
        `${FREE_MODELS.gemini.url}?key=${geminiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${prompt}\n\n${userLabelQ}: ${originalQuestion}\n\n${userLabelA}:\n${response}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2000,
                    responseMimeType: "application/json"
                }
            })
        }
    );

    if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`Gemini API error: ${apiResponse.status} - ${errorText}`);
    }

    const data = await apiResponse.json();
    const analysisText = data.candidates[0].content.parts[0].text;
    
    // Extraire JSON du texte (au cas où il y aurait du texte autour)
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Pas de JSON valide dans la réponse Gemini');
    }
    
    return JSON.parse(jsonMatch[0]);
}

/**
 * Analyse locale simple (fallback si APIs indisponibles)
 * Utilise l'ancienne méthode basée sur mots-clés
 */
function analyzeLocal(text, lang) {
    if (!text || text.length === 0) {
        return {
            hi: 0,
            chr: 0,
            claims: [],
            counts: { supported: 0, not_supported: 0, contradictory: 0, total: 0 },
            sources: [],
            warning: null
        };
    }

    const lowerText = text.toLowerCase();
    
    // Mots de certitude absolue (risque d'hallucination)
    const absoluteWords = [
        'toujours', 'jamais', 'absolument', 'certainement', 'forcément',
        'obligatoirement', 'impossible', 'aucun doute', 'sans aucun doute',
        'à 100%', 'totalement', 'complètement', 'définitivement'
    ];
    
    // Mots de nuance (réduisent le risque)
    const nuanceWords = [
        'peut-être', 'probablement', 'généralement', 'souvent', 'parfois',
        'il semble', 'il semblerait', 'possiblement', 'éventuellement',
        'dans certains cas', 'habituellement', 'en général', 'typiquement'
    ];
    
    // Mots de citation/source (réduisent le risque)
    const sourceWords = [
        'selon', 'd\'après', 'source', 'étude', 'recherche', 'rapport',
        'article', 'données', 'statistique', 'référence'
    ];
    
    let absoluteCount = 0;
    let nuanceCount = 0;
    let sourceCount = 0;
    
    absoluteWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) absoluteCount += matches.length;
    });
    
    nuanceWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) nuanceCount += matches.length;
    });
    
    sourceWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) sourceCount += matches.length;
    });
    
    const wordCount = text.split(/\s+/).length;
    const absoluteRatio = (absoluteCount / wordCount) * 100;
    const nuanceRatio = (nuanceCount / wordCount) * 100;
    const sourceRatio = (sourceCount / wordCount) * 100;
    
    // Extraire des claims simples localement (fallback)
    const extractedClaims = extractLocalClaims(text, lang);
    const counts = extractedClaims.reduce(
        (acc, c) => {
            acc.total += 1;
            if (c.classification === 'SUPPORTED') acc.supported += 1;
            else if (c.classification === 'NOT_SUPPORTED') acc.not_supported += 1;
            else if (c.classification === 'CONTRADICTORY') acc.contradictory += 1;
            return acc;
        },
        { supported: 0, not_supported: 0, contradictory: 0, total: 0 }
    );

    // HI: basé sur les counts (même formule que le prompt)
    let hi = 0;
    if (counts.total > 0) {
        hi = (0.5 * counts.not_supported + 1.0 * counts.contradictory) / counts.total;
    } else {
        // Fallback ultime si aucun claim exploitable
        hi = (absoluteRatio * 10 - nuanceRatio * 5 - sourceRatio * 3) / 100;
    }
    hi = Math.max(0, Math.min(1, hi));

    // CHR: combine HI + risque linguistique (certitude absolue)
    const languageRisk = Math.max(0, Math.min(1, (absoluteRatio * 6 - nuanceRatio * 3 - sourceRatio * 2) / 100));
    let chr = Math.max(0, Math.min(1, hi + 0.35 * languageRisk));

    const warning = (hi >= 0.3 || chr >= 0.3)
        ? (normalizeLang(lang) === 'en'
            ? '⚠️ Uncertainty detected — verify the information'
            : '⚠️ Incertitude détectée - vérifiez les informations')
        : null;
    
    return {
        hi: parseFloat(hi.toFixed(2)),
        chr: parseFloat(chr.toFixed(2)),
        claims: extractedClaims,
        counts,
        sources: extractLocalSources(text, lang),
        warning: warning,
        method: 'local' // Indiquer la méthode utilisée
    };
}

function extractLocalClaims(text, lang) {
    const normalized = normalizeLang(lang);
    const isEn = normalized === 'en';

    const sentences = text
        .split(/[\n\r]+|(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean)
        .filter(s => s.length >= 8);

    // Heuristique conservative: on marque la plupart des claims comme NOT_SUPPORTED
    // sauf contradictions "évidentes" (liste courte) et quelques faits très généraux.
    const obviousContradictions = [
        /\b(le\s+soleil|sun)\b[^.!?]*\b(est|is)\b[^.!?]*\b(noir|black)\b/i,
        /\b(la\s+terre|earth)\b[^.!?]*\b(est|is)\b[^.!?]*\b(platte|plate|flat)\b/i,
        /\b(2\s*\+\s*2)\s*(=|equals)\s*5\b/i
    ];

    const veryGeneralSupported = [
        /\b(le\s+soleil|sun)\b[^.!?]*\b(est|is)\b[^.!?]*\b(une\s+étoile|a\s+star)\b/i,
        /\b(la\s+terre|earth)\b[^.!?]*\b(tourne|orbits|revolves)\b[^.!?]*\b(autour\s+du\s+soleil|the\s+sun)\b/i,
        /\b(le\s+soleil|sun)\b[^.!?]*\b(produit|emits|produces)\b[^.!?]*\b(lumière|light)\b/i,
        /\b(le\s+soleil|sun)\b[^.!?]*\b(chaleur|heat)\b/i,
        /\b(fusion\s+nucléaire|nuclear\s+fusion)\b/i,
        /\b(planètes|planets)\b[^.!?]*\b(tournent|orbit|orbits|revolve|revolves)\b[^.!?]*\b(autour\s+du\s+soleil|the\s+sun|de\s+lui)\b/i
    ];

    const hasUrl = (s) => /https?:\/\//i.test(s);
    const hasAttribution = (s) => (isEn ? /\baccording\s+to\b|\bsource\b|\bstudy\b/i : /\bselon\b|\bd['’]après\b|\bsource\b|\bétude\b/i).test(s);

    const claims = [];
    for (const s of sentences.slice(0, 12)) {
        let classification = 'NOT_SUPPORTED';
        let score = 0.5;

        if (obviousContradictions.some(rx => rx.test(s))) {
            classification = 'CONTRADICTORY';
            score = 0.0;
        } else if (veryGeneralSupported.some(rx => rx.test(s))) {
            classification = 'SUPPORTED';
            score = 1.0;
        } else if (hasUrl(s) || hasAttribution(s)) {
            // La présence d'une attribution n'est pas une preuve, mais réduit le risque perçu.
            classification = 'NOT_SUPPORTED';
            score = 0.6;
        }

        claims.push({ text: s, classification, score });
    }

    return claims;
}

function extractLocalSources(text, lang) {
    const normalized = normalizeLang(lang);
    const isEn = normalized === 'en';

    const urls = (text.match(/https?:\/\/[^\s)\]}>"]+/gi) || [])
        .map(u => u.trim())
        .filter(Boolean)
        .slice(0, 5);

    if (urls.length > 0) {
        return urls;
    }

    return isEn
        ? [
            'NASA (official) — https://www.nasa.gov/',
            'Encyclopaedia Britannica — https://www.britannica.com/'
        ]
        : [
            'NASA (officiel) — https://www.nasa.gov/',
            'Encyclopædia Britannica — https://www.britannica.com/'
        ];
}

/**
 * Fonction principale avec cascade intelligente
 * Essaie Groq → Gemini → Analyse locale
 */
async function analyzeHallucination(response, question = '', sources = null, options = null) {
    // 1er essai : Groq (gratuit, ultra-rapide)
    try {
        console.log('🔍 Analyse hallucinations avec Groq...');
        const result = await analyzeWithGroq(response, question, (options && typeof options === 'object') ? options : {});
        result.method = 'groq';
        console.log('✅ Analyse Groq réussie - HI:', result.hi, 'CHR:', result.chr);
        return result;
    } catch (error) {
        console.log('⚠️ Groq échec:', error.message);
    }

    // 2e essai : Gemini Flash (gratuit, backup)
    try {
        console.log('🔍 Analyse hallucinations avec Gemini Flash...');
        const lang = (options && typeof options === 'object') ? options.lang : null;
        const result = await analyzeWithGemini(response, question, lang);
        result.method = 'gemini';
        console.log('✅ Analyse Gemini réussie - HI:', result.hi, 'CHR:', result.chr);
        return result;
    } catch (error) {
        console.log('⚠️ Gemini échec:', error.message);
    }

    // 3e essai : Analyse locale (toujours disponible)
    console.log('🔍 Analyse hallucinations en local (fallback)...');
    const lang = (options && typeof options === 'object') ? options.lang : null;
    const result = analyzeLocal(response, lang);
    console.log('✅ Analyse locale - HI:', result.hi, 'CHR:', result.chr);
    return result;
}

module.exports = {
    analyzeHallucination,
    analyzeWithGroq,
    analyzeWithGemini,
    analyzeLocal
};

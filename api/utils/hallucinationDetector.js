// 🛡️ Système avancé de détection d'hallucinations
// Utilise des modèles GRATUITS (Groq, Gemini Flash) pour l'analyse

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

// Prompt optimisé pour la détection d'hallucinations
const ANALYSIS_PROMPT = `Tu es un expert en fact-checking et détection d'hallucinations IA.

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

5. Liste 2-3 sources fiables pertinentes pour vérifier les informations

RÈGLES STRICTES:
- HI et CHR doivent être entre 0.0 et 1.0
- Si HI ≥ 0.3 ou CHR ≥ 0.3, ajoute un warning
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
  "sources": ["Source fiable 1", "Source fiable 2"],
  "warning": "⚠️ Message si HI ou CHR ≥ 0.3, null sinon"
}`;

/**
 * Analyse avec Groq (priorité - gratuit et ultra-rapide)
 */
async function analyzeWithGroq(response, originalQuestion) {
    const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
    
    if (!groqKey) {
        throw new Error('GROQ_API_KEY non configurée');
    }

    const apiResponse = await fetch(FREE_MODELS.groq.url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: FREE_MODELS.groq.model,
            messages: [
                { role: 'system', content: ANALYSIS_PROMPT },
                { 
                    role: 'user', 
                    content: `Question originale: ${originalQuestion}\n\nRéponse à analyser:\n${response}`
                }
            ],
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
    const analysisText = data.choices[0].message.content;
    
    return JSON.parse(analysisText);
}

/**
 * Analyse avec Gemini Flash (fallback gratuit)
 */
async function analyzeWithGemini(response, originalQuestion) {
    const geminiKey = process.env.APPSETTING_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!geminiKey) {
        throw new Error('GEMINI_API_KEY non configurée');
    }

    const apiResponse = await fetch(
        `${FREE_MODELS.gemini.url}?key=${geminiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${ANALYSIS_PROMPT}\n\nQuestion originale: ${originalQuestion}\n\nRéponse à analyser:\n${response}`
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
function analyzeLocal(text) {
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
    
    // HI: Indice d'Hallucination (0-1)
    let hi = (absoluteRatio * 10 - nuanceRatio * 5 - sourceRatio * 3) / 100;
    hi = Math.max(0, Math.min(1, hi));
    
    // CHR: Context History Ratio (0-1)
    let chr = 1 - ((nuanceRatio + sourceRatio) * 5 / 100);
    chr = Math.max(0, Math.min(1, chr));
    
    const warning = (hi >= 0.3 || chr >= 0.3) 
        ? '⚠️ Incertitude détectée - vérifiez les informations' 
        : null;
    
    return {
        hi: parseFloat(hi.toFixed(2)),
        chr: parseFloat(chr.toFixed(2)),
        claims: [], // Analyse locale ne génère pas de claims détaillés
        counts: { supported: 0, not_supported: 0, contradictory: 0, total: 0 },
        sources: [],
        warning: warning,
        method: 'local' // Indiquer la méthode utilisée
    };
}

/**
 * Fonction principale avec cascade intelligente
 * Essaie Groq → Gemini → Analyse locale
 */
async function analyzeHallucination(response, question = '', sources = null) {
    // 1er essai : Groq (gratuit, ultra-rapide)
    try {
        console.log('🔍 Analyse hallucinations avec Groq...');
        const result = await analyzeWithGroq(response, question);
        result.method = 'groq';
        console.log('✅ Analyse Groq réussie - HI:', result.hi, 'CHR:', result.chr);
        return result;
    } catch (error) {
        console.log('⚠️ Groq échec:', error.message);
    }

    // 2e essai : Gemini Flash (gratuit, backup)
    try {
        console.log('🔍 Analyse hallucinations avec Gemini Flash...');
        const result = await analyzeWithGemini(response, question);
        result.method = 'gemini';
        console.log('✅ Analyse Gemini réussie - HI:', result.hi, 'CHR:', result.chr);
        return result;
    } catch (error) {
        console.log('⚠️ Gemini échec:', error.message);
    }

    // 3e essai : Analyse locale (toujours disponible)
    console.log('🔍 Analyse hallucinations en local (fallback)...');
    const result = analyzeLocal(response);
    console.log('✅ Analyse locale - HI:', result.hi, 'CHR:', result.chr);
    return result;
}

module.exports = {
    analyzeHallucination,
    analyzeWithGroq,
    analyzeWithGemini,
    analyzeLocal
};

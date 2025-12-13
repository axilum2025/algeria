// 🌍 Traduction Avancée - Détection langue + Traduction contextuelle + Explications
// Utilise Llama 3.3 70B pour traductions naturelles avec contexte culturel

module.exports = async function (context, req) {
    context.log('🌍 Translation Request');

    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        };
        return;
    }

    try {
        const { text, targetLang, sourceLang, preserveFormatting, includeAlternatives } = req.body;

        if (!text || !targetLang) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { error: "Text and target language are required" }
            };
            return;
        }

        const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;

        if (!groqKey) {
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: "Groq API Key not configured" }
            };
            return;
        }

        // Détection automatique de la langue source si non fournie
        let detectedSourceLang = sourceLang;
        if (!sourceLang) {
            detectedSourceLang = await detectLanguage(text, groqKey);
        }

        // Construire le prompt de traduction
        const systemPrompt = `Tu es un traducteur professionnel expert. Tu traduis de ${detectedSourceLang} vers ${targetLang}.

RÈGLES:
- Traduis de manière naturelle et idiomatique
- Préserve le ton et le style (formel/informel)
- Adapte les expressions culturelles si nécessaire
- ${preserveFormatting ? 'Préserve le formatage (markdown, ponctuation, emojis)' : 'Optimise le formatage pour la langue cible'}
- ${includeAlternatives ? 'Fournis 2-3 alternatives de traduction si pertinent' : 'Fournis une seule traduction optimale'}

FORMAT DE RÉPONSE:
${includeAlternatives ? `
🎯 **Traduction principale**:
[Traduction]

🔄 **Alternatives**:
1. [Alternative 1]
2. [Alternative 2]

💡 **Notes**:
[Explications sur les choix de traduction si pertinent]
` : `
[Traduction directe sans formatage supplémentaire]
`}`;

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Traduis ce texte:\n\n${text}` }
        ];

        // Appel Groq
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: messages,
                max_tokens: Math.min(text.length * 3, 2000), // Proportionnel au texte source
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: {
                    error: `Groq Error: ${response.status}`,
                    details: errorText
                }
            };
            return;
        }

        const aiData = await response.json();
        const translation = aiData.choices[0].message.content;

        // Parser la réponse pour extraire traduction et alternatives
        const parsed = parseTranslationResponse(translation, includeAlternatives);

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                translation: parsed.main,
                alternatives: parsed.alternatives,
                notes: parsed.notes,
                detectedSourceLang: detectedSourceLang,
                targetLang: targetLang,
                originalText: text,
                tokensUsed: aiData.usage?.total_tokens || 0,
                model: 'llama-3.3-70b',
                provider: 'Groq'
            }
        };

    } catch (error) {
        context.log.error('❌ Error:', error);
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: { error: error.message }
        };
    }
};

/**
 * Détecte la langue du texte source
 */
async function detectLanguage(text, groqKey) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: "system",
                        content: "Détecte la langue du texte fourni. Réponds UNIQUEMENT avec le nom de la langue en français (ex: français, anglais, espagnol, allemand, etc.)"
                    },
                    {
                        role: "user",
                        content: text.substring(0, 200) // Premiers 200 caractères suffisent
                    }
                ],
                max_tokens: 10,
                temperature: 0
            })
        });

        if (response.ok) {
            const data = await response.json();
            return data.choices[0].message.content.trim().toLowerCase();
        }
    } catch (error) {
        console.warn('Language detection failed, defaulting to auto');
    }

    return 'auto';
}

/**
 * Parse la réponse de traduction pour extraire composants
 */
function parseTranslationResponse(text, includeAlternatives) {
    if (!includeAlternatives) {
        return {
            main: text.trim(),
            alternatives: [],
            notes: null
        };
    }

    const result = {
        main: '',
        alternatives: [],
        notes: null
    };

    // Extraire traduction principale
    const mainMatch = text.match(/🎯.*?:\s*\n(.*?)(?=\n🔄|\n💡|$)/s);
    if (mainMatch) {
        result.main = mainMatch[1].trim();
    }

    // Extraire alternatives
    const altMatch = text.match(/🔄.*?:\s*\n(.*?)(?=\n💡|$)/s);
    if (altMatch) {
        const altText = altMatch[1];
        const alts = altText.match(/\d+\.\s*(.*?)(?=\n\d+\.|\n|$)/g);
        if (alts) {
            result.alternatives = alts.map(a => a.replace(/^\d+\.\s*/, '').trim());
        }
    }

    // Extraire notes
    const notesMatch = text.match(/💡.*?:\s*\n(.*?)$/s);
    if (notesMatch) {
        result.notes = notesMatch[1].trim();
    }

    // Fallback si parsing échoue
    if (!result.main) {
        result.main = text.trim();
    }

    return result;
}

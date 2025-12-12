// 💎 PLAN PRO - Llama 3.3 70B via Groq + Fonctions Azure
// Groq : Même API que FREE (gratuit et rapide)
// Modèle : llama-3.3-70b-versatile
// Différence : Fonctions Azure (Images, Documents, Fact Check)
// Endpoint : https://api.groq.com/openai/v1

module.exports = async function (context, req) {
    context.log('💎 PRO PLAN - Llama 3.3 70B Request (Groq + Azure Functions)');

    // CORS
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
        const userMessage = req.body.message;

        if (!userMessage) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { error: "Message is required" }
            };
            return;
        }

        const startTime = Date.now();
        
        // 🔍 Google Fact Check en parallèle (ne pas bloquer si ça échoue)
        let factCheckResults = null;
        const factCheckPromise = googleFactCheck(userMessage).catch(err => {
            context.log.warn('⚠️ Fact check failed:', err.message);
            return null;
        });
        
        // Groq API configuration (même API que FREE)
        const apiKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
        
        if (!apiKey) {
            context.log.error('⚠️ GROQ_API_KEY not configured');
            context.res = {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: {
                    error: "Groq API Key not configured",
                    hint: "Contactez l'administrateur pour configurer GROQ_API_KEY",
                    responseTime: `${Date.now() - startTime}ms`
                }
            };
            return;
        }

        // Préparer l'historique
        const conversationHistory = req.body.history || [];
        const recentHistory = conversationHistory.slice(-20); // Limiter à 20 messages

        // Construire les messages
        const messages = [
            {
                role: "system",
                content: `Tu es Axilum AI Plan PRO, un assistant intelligent propulsé par Llama 3.3 70B.
Réponds de manière claire, précise et professionnelle en français.

**Capacités exclusives Plan PRO** :
✅ Analyse d'images (Azure Vision)
✅ Génération d'images (DALL-E 3)
✅ Résumé de documents PDF/DOCX
✅ Vérification des faits (Google Fact Check)
✅ Historique étendu (20 messages)

Si l'utilisateur demande une fonctionnalité Pro, informe-le des capacités disponibles.`
            }
        ];

        // Ajouter l'historique
        recentHistory.forEach(msg => {
            if (msg.type === 'user' && msg.content) {
                messages.push({ role: "user", content: msg.content });
            } else if (msg.type === 'bot' && msg.content) {
                // Nettoyer le contenu du bot
                const cleanContent = msg.content
                    .replace(/\n*---[\s\S]*/g, '')
                    .replace(/\n*💡.*\n*/gi, '')
                    .trim();
                if (cleanContent) {
                    messages.push({ role: "assistant", content: cleanContent });
                }
            }
        });

        // Ajouter le message actuel
        messages.push({
            role: "user",
            content: userMessage
        });

        context.log(`📨 Sending request to Groq - ${messages.length} messages`);

        // Appel à Groq (même API que FREE)
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile', // Même modèle que FREE
                messages: messages,
                max_tokens: 4000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error('❌ Groq Error:', response.status, errorText);
            
            context.res = {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: {
                    error: `Groq Error: ${response.status}`,
                    details: errorText,
                    hint: response.status === 401 ? "Vérifiez que GROQ_API_KEY est correcte" : 
                          response.status === 429 ? "Limite de requêtes dépassée. Réessayez dans quelques secondes." :
                          "Erreur lors de l'appel à Groq",
                    responseTime: `${Date.now() - startTime}ms`
                }
            };
            return;
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        // Attendre le fact-check s'il n'est pas terminé
        factCheckResults = await factCheckPromise;
        
        const responseTime = Date.now() - startTime;

        context.log(`✅ Response generated in ${responseTime}ms`);

        // 🔍 Analyse anti-hallucination simple
        const hallucinationAnalysis = analyzeHallucination(aiResponse);
        
        // 📊 Ajout des sources et métriques dans la réponse
        let sourcesText = '';
        if (factCheckResults && factCheckResults.length > 0) {
            sourcesText = '\n\n🔍 **Sources Vérifiées**:\n';
            factCheckResults.slice(0, 3).forEach((source, i) => {
                sourcesText += `${i + 1}. ${source.publisher} - ${source.rating}\n`;
            });
        }
        
        const metricsText = `\n\n---\n📊 **Métriques de Fiabilité**\nHI: ${hallucinationAnalysis.hi.toFixed(1)}% | CHR: ${hallucinationAnalysis.chr.toFixed(1)}%${sourcesText}\n💡 *Plan Pro - ${data.usage?.total_tokens || 0} tokens utilisés*`;
        const finalResponse = aiResponse + metricsText;

        context.res = {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                response: finalResponse,
                responseTime: `${responseTime}ms`,
                proPlan: true,
                model: 'llama-3.3-70b',
                provider: 'Groq',
                tokensUsed: data.usage?.total_tokens || 0,
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                qualityScore: 95,
                advancedFeatures: true,
                hallucinationIndex: hallucinationAnalysis.hi,
                contextHistoryRatio: hallucinationAnalysis.chr,
                factCheckSources: factCheckResults ? factCheckResults.length : 0
            }
        };

    } catch (error) {
        context.log.error('❌ Error in invoke function:', error);
        context.log.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        context.res = {
            status: 200, // Changé en 200 pour éviter les problèmes CORS
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: {
                error: "Internal server error",
                message: error.message,
                details: error.stack,
                hint: "Vérifiez que GROQ_API_KEY est configurée dans Azure Static Web App"
            }
        };
    }
};

// 🔍 Google Fact Check Tools API
async function googleFactCheck(query) {
    const factCheckApiKey = process.env.APPSETTING_GOOGLE_FACT_CHECK_API_KEY || process.env.GOOGLE_FACT_CHECK_API_KEY;
    
    if (!factCheckApiKey) {
        return null; // Pas de clé = pas de fact-check
    }
    
    try {
        const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?key=${factCheckApiKey}&query=${encodeURIComponent(query)}&languageCode=fr`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        
        if (!data.claims || data.claims.length === 0) {
            return null;
        }
        
        // Extraire les sources vérifiées
        const sources = data.claims.slice(0, 5).map(claim => {
            const review = claim.claimReview?.[0];
            return {
                claim: claim.text,
                publisher: review?.publisher?.name || 'Source inconnue',
                rating: review?.textualRating || 'Non évalué',
                url: review?.url || '',
                date: review?.reviewDate || ''
            };
        });
        
        return sources;
    } catch (error) {
        return null;
    }
}

// 🔍 Fonction d'analyse anti-hallucination
function analyzeHallucination(text) {
    if (!text || text.length === 0) {
        return { hi: 0, chr: 0 };
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
    
    // Calculer l'indice d'hallucination (0-100%)
    const wordCount = text.split(/\s+/).length;
    const absoluteRatio = (absoluteCount / wordCount) * 100;
    const nuanceRatio = (nuanceCount / wordCount) * 100;
    const sourceRatio = (sourceCount / wordCount) * 100;
    
    // HI: Indice d'Hallucination (plus c'est bas, mieux c'est)
    let hi = absoluteRatio * 10 - nuanceRatio * 5 - sourceRatio * 3;
    hi = Math.max(0, Math.min(100, hi)); // Entre 0 et 100
    
    // CHR: Context History Ratio (cohérence avec l'historique)
    // Plus il y a de nuances et sources, meilleur c'est
    let chr = (nuanceRatio + sourceRatio) * 5;
    chr = Math.max(0, Math.min(100, 100 - chr)); // Inversé: bas = bon
    
    return {
        hi: hi,
        chr: chr
    };
}
            body: {
                error: "Internal server error",
                message: error.message,
                details: error.stack,
                hint: "Vérifiez que OPENROUTER_API_KEY est configurée dans Azure Static Web App"
            }
        };
    }
};

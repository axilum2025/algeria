const https = require('https');
const { analyzeHallucination } = require('../utils/hallucinationDetector');

module.exports = async function (context, req) {
    context.log('🔍 Verify Hallucination API appelée');

    // CORS headers
    context.res = {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'application/json'
        }
    };

    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    try {
        const { text, source } = req.body;

        if (!text || text.trim().length === 0) {
            context.res.status = 400;
            context.res.body = { error: 'Texte à vérifier requis' };
            return;
        }

        context.log('📝 Texte à analyser:', text.substring(0, 100) + '...');
        context.log('🤖 Source IA:', source || 'Non spécifiée');

        // 1. Extraire les faits du texte
        const facts = await extractFacts(text);
        context.log(`📊 ${facts.length} faits extraits`);

        // 2. Analyser avec le détecteur d'hallucinations existant
        const hallucinationAnalysis = await analyzeHallucination(text, context);
        context.log('🔍 Analyse hallucination:', hallucinationAnalysis);

        // 3. Vérifier les faits avec Brave Search
        const braveApiKey = process.env.APPSETTING_BRAVE_API_KEY;
        const verifiedFacts = [];
        const suspiciousFacts = [];
        const hallucinations = [];

        if (braveApiKey && facts.length > 0) {
            context.log('🌐 Vérification avec Brave Search...');
            
            for (const fact of facts.slice(0, 5)) { // Limiter à 5 faits pour performance
                try {
                    const verification = await verifyFactWithBrave(fact, braveApiKey, context);
                    
                    if (verification.verified) {
                        verifiedFacts.push({
                            fact: fact,
                            source: verification.source,
                            confidence: 'high'
                        });
                    } else if (verification.partialMatch) {
                        suspiciousFacts.push({
                            fact: fact,
                            reason: 'Source non claire ou partielle',
                            confidence: 'low'
                        });
                    } else {
                        hallucinations.push({
                            fact: fact,
                            reason: 'Aucune source fiable trouvée',
                            severity: 'medium'
                        });
                    }
                } catch (err) {
                    context.log.error('Erreur vérification fait:', err);
                    suspiciousFacts.push({
                        fact: fact,
                        reason: 'Erreur de vérification',
                        confidence: 'unknown'
                    });
                }
            }
        }

        // 4. Détecter contradictions internes
        const contradictions = detectContradictions(text);

        // 5. Calculer score de fiabilité
        const totalFacts = verifiedFacts.length + suspiciousFacts.length + hallucinations.length;
        const reliabilityScore = totalFacts > 0 
            ? Math.round((verifiedFacts.length / totalFacts) * 100) 
            : 50;

        // 6. Générer warnings de sécurité
        const securityWarnings = detectSecurityIssues(text);

        // 7. Construire le rapport
        const report = {
            source: source || 'IA non spécifiée',
            textLength: text.length,
            analysisTime: Date.now(),
            verifiedFacts,
            suspiciousFacts,
            hallucinations,
            contradictions,
            reliabilityScore,
            hallucinationIndex: hallucinationAnalysis.hallucinationIndex,
            hallucinationSources: hallucinationAnalysis.sources,
            securityWarnings,
            recommendation: generateRecommendation(reliabilityScore, hallucinations.length, securityWarnings.length)
        };

        context.res.status = 200;
        context.res.body = report;

    } catch (error) {
        context.log.error('❌ Erreur verify-hallucination:', error);
        context.res.status = 500;
        context.res.body = { 
            error: 'Erreur lors de l\'analyse',
            details: error.message 
        };
    }
};

// Extraire les faits vérifiables du texte
async function extractFacts(text) {
    const facts = [];
    
    // Regex pour dates (YYYY, DD/MM/YYYY, etc.)
    const dateRegex = /\b(19|20)\d{2}\b|\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g;
    const dates = text.match(dateRegex) || [];
    
    // Regex pour nombres/statistiques
    const numberRegex = /\b\d+([,.]\d+)?%?\b/g;
    const numbers = text.match(numberRegex) || [];
    
    // Phrases avec "selon", "d'après", citations
    const citationRegex = /(selon|d'après|cite|mentionne)[^.!?]*[.!?]/gi;
    const citations = text.match(citationRegex) || [];
    
    // Lois, articles, références juridiques
    const lawRegex = /(article|loi|code|décret|ordonnance)\s+\d+/gi;
    const laws = text.match(lawRegex) || [];
    
    // Noms propres (simplification: mots capitalisés)
    const nameRegex = /\b[A-Z][a-zàâäéèêëïîôùûü]+(?:\s+[A-Z][a-zàâäéèêëïîôùûü]+)*\b/g;
    const names = text.match(nameRegex) || [];
    
    // Combiner tous les faits
    facts.push(...dates.map(d => `Date: ${d}`));
    facts.push(...citations.map(c => c.trim()));
    facts.push(...laws.map(l => l.trim()));
    
    return [...new Set(facts)]; // Dédupliquer
}

// Vérifier un fait avec Brave Search
async function verifyFactWithBrave(fact, apiKey, context) {
    return new Promise((resolve) => {
        const query = encodeURIComponent(fact);
        const options = {
            hostname: 'api.search.brave.com',
            path: `/res/v1/web/search?q=${query}&count=3`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': apiKey
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    const hasResults = result.web?.results?.length > 0;
                    
                    if (hasResults) {
                        const topResult = result.web.results[0];
                        resolve({
                            verified: true,
                            source: topResult.url,
                            title: topResult.title
                        });
                    } else {
                        resolve({ verified: false, partialMatch: false });
                    }
                } catch (err) {
                    context.log.error('Erreur parsing Brave:', err);
                    resolve({ verified: false, partialMatch: false });
                }
            });
        });

        req.on('error', (err) => {
            context.log.error('Erreur requête Brave:', err);
            resolve({ verified: false, partialMatch: false });
        });

        req.setTimeout(5000, () => {
            req.destroy();
            resolve({ verified: false, partialMatch: false });
        });

        req.end();
    });
}

// Détecter contradictions internes
function detectContradictions(text) {
    const contradictions = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Détecter contradictions temporelles
    const years = text.match(/\b(19|20)\d{2}\b/g) || [];
    if (years.length > 1) {
        const uniqueYears = [...new Set(years)];
        if (uniqueYears.length > 3) {
            contradictions.push({
                type: 'temporal',
                description: 'Multiples dates mentionnées - vérifier la cohérence'
            });
        }
    }
    
    // Détecter contradictions logiques basiques
    const hasPositive = /\b(oui|vrai|correct|exact)\b/i.test(text);
    const hasNegative = /\b(non|faux|incorrect|inexact)\b/i.test(text);
    
    if (hasPositive && hasNegative && sentences.length < 5) {
        contradictions.push({
            type: 'logical',
            description: 'Affirmations contradictoires détectées'
        });
    }
    
    return contradictions;
}

// Détecter problèmes de sécurité
function detectSecurityIssues(text) {
    const warnings = [];
    const lowerText = text.toLowerCase();
    
    // Conseils médicaux non sourcés
    const medicalKeywords = ['diagnostic', 'traitement', 'médicament', 'maladie', 'symptôme', 'thérapie'];
    const hasMedical = medicalKeywords.some(kw => lowerText.includes(kw));
    const hasSource = /selon|source|étude|recherche|publiée|journal/i.test(text);
    
    if (hasMedical && !hasSource) {
        warnings.push({
            type: 'medical',
            severity: 'high',
            message: '⚠️ Contient des informations médicales sans sources fiables'
        });
    }
    
    // Conseils juridiques non sourcés
    const legalKeywords = ['article', 'loi', 'code', 'juridique', 'légal', 'tribunal'];
    const hasLegal = legalKeywords.some(kw => lowerText.includes(kw));
    
    if (hasLegal && !hasSource) {
        warnings.push({
            type: 'legal',
            severity: 'high',
            message: '⚠️ Contient des informations juridiques sans références précises'
        });
    }
    
    return warnings;
}

// Générer recommandation
function generateRecommendation(score, hallucinationCount, warningCount) {
    if (warningCount > 0) {
        return '🚨 ALERTE : Cette réponse contient des informations sensibles sans sources. Vérification obligatoire avant utilisation.';
    }
    
    if (score >= 80 && hallucinationCount === 0) {
        return '✅ Fiabilité élevée. Cette réponse semble factuelle et bien sourcée.';
    }
    
    if (score >= 60 && hallucinationCount <= 2) {
        return '⚠️ Fiabilité moyenne. Vérifiez les faits suspects avant utilisation.';
    }
    
    return '❌ Fiabilité faible. Cette réponse contient des erreurs factuelles. Vérification recommandée.';
}

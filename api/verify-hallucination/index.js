const https = require('https');
const { analyzeHallucination } = require('../utils/hallucinationDetector');
const { verifyClaimsWithEvidence } = require('../utils/evidenceClaimVerifier');

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
        const body = (req && req.body && typeof req.body === 'object') ? req.body : {};
        const { text, source } = body;
        const lang = normalizeLang(body.lang);
        const L = getHdApiStrings(lang);
        const enableEvidenceCheck = body.evidenceCheck !== false; // default true

        if (!text || text.trim().length === 0) {
            context.res.status = 400;
            context.res.body = { error: L.missingTextError };
            return;
        }

        context.log('📝 Texte à analyser:', text.substring(0, 100) + '...');
        context.log('🤖 Source IA:', source || L.sourceUnspecifiedShort);

        // Normalisation: retirer les préfixes "méta" (ex: "ChatGPT says that …") pour analyser la claim réelle.
        // On conserve néanmoins le texte original dans le report.
        const textForAnalysis = normalizeTextForHallucinationAnalysis(text);

        // 1. Analyser avec le détecteur d'hallucinations existant
        // IMPORTANT: analyzeHallucination attend un texte (question) en 2e paramètre, pas l'objet Azure `context`.
        const hallucinationAnalysis = await analyzeHallucination(
            textForAnalysis,
            `${L.verifyContextPrefix} (${L.reportSourceLabel}: ${source || L.sourceUnspecifiedLong})`,
            null,
            { lang }
        );
        context.log('🔍 Analyse hallucination:', hallucinationAnalysis);

        // "effectiveAnalysis" peut être remplacée par une analyse evidence-based si Brave + modèle sont disponibles.
        let effectiveAnalysis = hallucinationAnalysis;

        // 2. Extraire les faits du texte
        // Important: privilégier les claims du détecteur (évite de vérifier des phrases méta "ChatGPT said...").
        const facts = pickFactsForBrave(hallucinationAnalysis, text);
        context.log(`📊 ${facts.length} faits extraits`);

        // 3. Vérifier les faits avec Brave Search
        const braveApiKey = process.env.APPSETTING_BRAVE_API_KEY || process.env.BRAVE_API_KEY;
        const verifiedFacts = [];
        const suspiciousFacts = [];
        // Note: le score "hallucinations" dans l'UI doit refléter au minimum les claims CONTRADICTORY.
        // Les hallucinations basées sur preuve externe (Brave) peuvent s'y ajouter plus tard.
        const hallucinations = [];

        // Audit: conserver les requêtes + résultats Brave pour traçabilité.
        const evidence = [];

        const braveVerificationEnabled = Boolean(braveApiKey) && facts.length > 0;

        // Evidence-based claim checking requires Brave.
        const evidenceCheckEnabled = Boolean(enableEvidenceCheck) && Boolean(braveApiKey);
        const evidenceByClaim = Object.create(null);

        if (braveVerificationEnabled) {
            context.log('🌐 Vérification avec Brave Search...');
            
            for (const fact of facts.slice(0, 5)) { // Limiter à 5 faits pour performance
                try {
                    const verification = await verifyFactWithBrave(fact, braveApiKey, context);

                    evidence.push({
                        fact,
                        query: verification.query || null,
                        results: Array.isArray(verification.results) ? verification.results : []
                    });
                    
                    if (verification.verified) {
                        verifiedFacts.push({
                            fact: fact,
                            source: verification.source,
                            evidence: Array.isArray(verification.results) ? verification.results : undefined,
                            confidence: 'high'
                        });
                    } else if (verification.partialMatch) {
                        suspiciousFacts.push({
                            fact: fact,
                            reason: L.reasonPartialMatch,
                            evidence: Array.isArray(verification.results) ? verification.results : undefined,
                            confidence: 'low'
                        });
                    } else {
                        // IMPORTANT: "aucune source trouvée" ne prouve pas que c'est faux.
                        // On classe donc comme "suspect / non confirmé automatiquement".
                        suspiciousFacts.push({
                            fact: fact,
                            reason: L.reasonNoSourceFound,
                            evidence: Array.isArray(verification.results) ? verification.results : undefined,
                            confidence: 'unknown'
                        });
                    }
                } catch (err) {
                    context.log.error('Erreur vérification fait:', err);
                    suspiciousFacts.push({
                        fact: fact,
                        reason: L.reasonVerificationError,
                        confidence: 'unknown'
                    });
                }
            }
        }

        // 3bis. Evidence-based checking (auditable): claims -> preuves Brave -> verdict sur preuves (Groq/Gemini)
        let evidenceAnalysis = null;
        if (evidenceCheckEnabled) {
            const claimTexts = pickClaimsForEvidenceCheck(hallucinationAnalysis, text);

            for (const claimText of claimTexts) {
                try {
                    const v = await verifyClaimEvidenceWithBrave(claimText, braveApiKey, context, lang);
                    evidenceByClaim[claimText] = Array.isArray(v.results) ? v.results : [];
                } catch (_) {
                    evidenceByClaim[claimText] = [];
                }
            }

            try {
                evidenceAnalysis = await verifyClaimsWithEvidence({
                    claims: claimTexts,
                    evidenceByClaim,
                    lang,
                    userId: body.userId || 'guest'
                });

                if (Array.isArray(evidenceAnalysis?.claims) && evidenceAnalysis.claims.length > 0) {
                    effectiveAnalysis = {
                        ...effectiveAnalysis,
                        method: 'evidence',
                        claims: evidenceAnalysis.claims,
                        counts: evidenceAnalysis.counts,
                        hi: evidenceAnalysis.hi,
                        chr: evidenceAnalysis.chr,
                        score: (evidenceAnalysis && typeof evidenceAnalysis.score === 'object') ? evidenceAnalysis.score : undefined,
                        warning: (evidenceAnalysis.hi >= 0.3 || evidenceAnalysis.chr >= 0.3)
                            ? (normalizeLang(lang) === 'en'
                                ? '⚠️ Evidence-based risk detected — verify the sources'
                                : '⚠️ Risque (preuves) détecté — vérifiez les sources')
                            : null
                    };
                }
            } catch (err) {
                context.log('⚠️ Evidence-based check failed:', err.message);
            }
        }

        // 4. Détecter contradictions internes
        const contradictions = detectContradictions(text);

        // Claims/counts effectifs (peuvent venir de l'evidence-check)
        const analysisClaims = Array.isArray(effectiveAnalysis?.claims) ? effectiveAnalysis.claims : [];
        const analysisCounts = normalizeCounts(effectiveAnalysis?.counts, analysisClaims);

        // 5. Calculer score de fiabilité
        // Priorité: utiliser l'analyse du détecteur (claims SUPPORTED/NOT_SUPPORTED/CONTRADICTORY)
        // Fallback: si aucune claim exploitable, utiliser le score basé sur les vérifications Brave.
        const analysisTotal = analysisCounts && typeof analysisCounts.total === 'number' ? analysisCounts.total : 0;
        const analysisSupported = analysisCounts && typeof analysisCounts.supported === 'number' ? analysisCounts.supported : 0;

        const totalFacts = verifiedFacts.length + suspiciousFacts.length + hallucinations.length;
        const reliabilityScore = analysisTotal > 0
            ? Math.round((analysisSupported / analysisTotal) * 100)
            : (totalFacts > 0 ? Math.round((verifiedFacts.length / totalFacts) * 100) : null);

        // 6. Générer warnings de sécurité
        const securityWarnings = detectSecurityIssues(text, lang);

        // 7. Construire le rapport
        const hi = typeof effectiveAnalysis?.hi === 'number' ? effectiveAnalysis.hi : 0;
        const chr = typeof effectiveAnalysis?.chr === 'number' ? effectiveAnalysis.chr : 0;
        const hiPercent = Math.round(hi * 1000) / 10;
        const chrPercent = Math.round(chr * 1000) / 10;
        const notSupportedClaims = analysisClaims
            .filter(c => c && c.classification === 'NOT_SUPPORTED')
            .map(c => ({ text: c.text, score: c.score }));
        const contradictoryClaims = analysisClaims
            .filter(c => c && c.classification === 'CONTRADICTORY')
            .map(c => ({ text: c.text, score: c.score }));

        // Harmonisation: si Brave n'est pas configuré (ou n'a rien renvoyé), on expose quand même
        // les points non confirmés via les claims NOT_SUPPORTED.
        if (notSupportedClaims.length > 0 && suspiciousFacts.length === 0) {
            notSupportedClaims.slice(0, 8).forEach((c) => {
                if (c && c.text) {
                    suspiciousFacts.push({
                        fact: String(c.text),
                        reason: (normalizeLang(lang) === 'en')
                            ? 'Detector marked this claim as NOT_SUPPORTED (unverified)'
                            : 'Le détecteur a classé ce point comme NOT_SUPPORTED (non vérifié)',
                        confidence: 'unknown',
                        origin: 'detector'
                    });
                }
            });
        }

        // Harmonisation: une claim CONTRADICTORY doit compter comme hallucination probable.
        if (contradictoryClaims.length > 0) {
            contradictoryClaims.slice(0, 12).forEach((c) => {
                if (c && c.text) {
                    hallucinations.push({
                        fact: String(c.text),
                        reason: (normalizeLang(lang) === 'en')
                            ? 'Detector marked this claim as CONTRADICTORY (likely false)'
                            : 'Le détecteur a classé ce point comme CONTRADICTORY (probablement faux)',
                        confidence: 'high',
                        origin: 'detector'
                    });
                }
            });
        }

        const recommendedSources = sanitizeRecommendedSources(
            Array.isArray(hallucinationAnalysis?.sources) ? hallucinationAnalysis.sources : [],
            lang
        );

        const report = {
            source: source || L.sourceUnspecifiedLong,
            textLength: text.length,
            analysisTime: Date.now(),
            braveVerificationEnabled,
            verifiedFacts,
            suspiciousFacts,
            hallucinations,
            contradictions,
            reliabilityScore,
            // Nouveau score (evidence-based) : risque de contradiction, couverture de preuve, incertitude.
            // Présent uniquement si l'evidence-check a produit des claims.
            score: (effectiveAnalysis && typeof effectiveAnalysis.score === 'object') ? effectiveAnalysis.score : null,
            hi,
            chr,
            hiPercent,
            chrPercent,
            warning: effectiveAnalysis?.warning || null,
            recommendedSources,
            counts: analysisCounts || null,
            claims: analysisClaims,
            notSupportedClaims,
            contradictoryClaims,
            securityWarnings,
            recommendation: generateRecommendation(reliabilityScore, braveVerificationEnabled, hallucinations.length, suspiciousFacts.length, securityWarnings.length, lang),
            audit: {
                version: 'hd-report-v1.2',
                lang,
                analysisMethod: String(effectiveAnalysis?.method || 'unknown'),
                scoring: (effectiveAnalysis && effectiveAnalysis.method === 'evidence' && effectiveAnalysis.score)
                    ? 'evidence_contradictionRisk_and_coverage'
                    : (analysisTotal > 0 ? 'supported_claims_ratio' : (totalFacts > 0 ? 'brave_ratio' : 'unavailable')),
                notes: (normalizeLang(lang) === 'en')
                    ? 'Counts are normalized and contradictory claims are reported as hallucinations for consistency.'
                    : 'Les compteurs sont normalisés et les claims contradictoires sont reportées comme hallucinations pour cohérence.'
            },
            evidence,
            evidenceCheck: {
                enabled: evidenceCheckEnabled,
                claimCount: Array.isArray(evidenceAnalysis?.claims) ? evidenceAnalysis.claims.length : 0,
                method: String(evidenceAnalysis?.method || ''),
                note: evidenceCheckEnabled
                    ? (normalizeLang(lang) === 'en'
                        ? 'Claims were evaluated using Brave snippets only (auditable).'
                        : 'Les claims ont été évaluées uniquement avec des extraits Brave (auditables).')
                    : (normalizeLang(lang) === 'en'
                        ? 'Evidence-based checking disabled or Brave not configured.'
                        : 'Vérification par preuves désactivée ou Brave non configuré.')
            }
        };

        context.res.status = 200;
        context.res.body = report;

    } catch (error) {
        context.log.error('❌ Erreur verify-hallucination:', error);
        context.res.status = 500;
        context.res.body = { 
            error: (normalizeLang((req && req.body && req.body.lang) ? req.body.lang : null) === 'en') ? 'Error during analysis' : 'Erreur lors de l\'analyse',
            details: error.message 
        };
    }
};

function normalizeCounts(counts, claims) {
    const safeCounts = (counts && typeof counts === 'object') ? counts : null;
    const supported = safeCounts && typeof safeCounts.supported === 'number' ? safeCounts.supported : null;
    const notSupported = safeCounts && typeof safeCounts.not_supported === 'number' ? safeCounts.not_supported : null;
    const contradictory = safeCounts && typeof safeCounts.contradictory === 'number' ? safeCounts.contradictory : null;
    const total = safeCounts && typeof safeCounts.total === 'number' ? safeCounts.total : null;

    if ([supported, notSupported, contradictory, total].every(v => typeof v === 'number')) {
        return {
            supported,
            not_supported: notSupported,
            contradictory,
            total
        };
    }

    if (Array.isArray(claims) && claims.length > 0) {
        const derived = { supported: 0, not_supported: 0, contradictory: 0, total: 0 };
        for (const c of claims) {
            if (!c || !c.classification) continue;
            derived.total += 1;
            if (c.classification === 'SUPPORTED') derived.supported += 1;
            else if (c.classification === 'NOT_SUPPORTED') derived.not_supported += 1;
            else if (c.classification === 'CONTRADICTORY') derived.contradictory += 1;
        }
        return derived;
    }

    return safeCounts;
}

function sanitizeRecommendedSources(sources, lang) {
    const isEn = normalizeLang(lang) === 'en';
    const cleaned = (Array.isArray(sources) ? sources : [])
        .map(s => String(s || '').trim())
        .filter(Boolean)
        .filter(s => !/\b(chatgpt|gpt-?\d|openai|other ai)\b/i.test(s));

    if (cleaned.length > 0) return cleaned.slice(0, 5);

    // Fallback générique (auditables) si le modèle propose des "sources" non pertinentes.
    return isEn
        ? [
            'NASA (official) — https://www.nasa.gov/',
            'Encyclopaedia Britannica — https://www.britannica.com/',
            'Wikipedia (as a starting point) — https://en.wikipedia.org/'
        ]
        : [
            'NASA (officiel) — https://www.nasa.gov/',
            'Encyclopædia Britannica — https://www.britannica.com/',
            'Wikipédia (point de départ) — https://fr.wikipedia.org/'
        ];
}

function normalizeLang(lang) {
    const raw = String(lang || '').toLowerCase();
    return raw.startsWith('en') ? 'en' : 'fr';
}

function getHdApiStrings(lang) {
    const isEn = normalizeLang(lang) === 'en';
    return {
        missingTextError: isEn ? 'Text to verify is required' : 'Texte à vérifier requis',
        sourceUnspecifiedShort: isEn ? 'Unspecified' : 'Non spécifiée',
        sourceUnspecifiedLong: isEn ? 'Unspecified AI' : 'IA non spécifiée',
        verifyContextPrefix: isEn ? 'Text to verify' : 'Texte à vérifier',
        reportSourceLabel: isEn ? 'Source' : 'Source',
        reasonPartialMatch: isEn ? 'Unclear or partial source match' : 'Source non claire ou partielle',
        reasonNoSourceFound: isEn ? 'No source found via Brave (inconclusive)' : 'Aucune source trouvée via Brave (non concluant)',
        reasonVerificationError: isEn ? 'Verification error' : 'Erreur de vérification'
    };
}

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

    // Heuristique: extraire des propositions simples (utile pour des phrases courtes type "X est Y")
    const sentenceCandidates = text
        .split(/[.!?\n\r]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .filter(s => s.length >= 8 && s.length <= 180);

    const simpleCopulaRegex = /\b(est|sont|était|étaient|sera|seront|serait|seraient|is|are|was|were|will\s+be|would\s+be)\b/i;
    for (const s of sentenceCandidates) {
        if (simpleCopulaRegex.test(s)) {
            facts.push(s);
        }
    }

    // Heuristique: si une phrase contient un nombre, prendre la phrase complète comme fait (plus utile que le nombre seul)
    for (const s of sentenceCandidates) {
        if (numberRegex.test(s)) {
            facts.push(s);
        }
    }
    
    // Dédupliquer + limiter pour éviter les requêtes Brave trop longues
    return [...new Set(facts)].slice(0, 12);
}

// Vérifier un fait avec Brave Search
async function verifyFactWithBrave(fact, apiKey, context) {
    const cleaned = sanitizeBraveQuery(fact);
    const results = await braveSearch(cleaned, apiKey, context, 3);
    if (results.length > 0) {
        return {
            verified: false,
            partialMatch: true,
            source: results[0].url,
            title: results[0].title,
            query: cleaned,
            results
        };
    }
    return { verified: false, partialMatch: false, query: cleaned, results: [] };
}

async function verifyClaimEvidenceWithBrave(claimText, apiKey, context, lang) {
    const variants = buildQueryVariantsForClaim(claimText, lang);
    const seen = new Set();
    const merged = [];

    // Par défaut on limite les variantes pour éviter trop de requêtes.
    // Certains cas (ex: "sun is black") ont besoin de requêtes plus ciblées.
    const looksLikeSunBlack = /\b(soleil|sun)\b/i.test(String(claimText || '')) && /\b(noir|black)\b/i.test(String(claimText || ''));
    const maxVariants = looksLikeSunBlack ? 6 : (variants.some(v => /\bsite:(nasa\.gov|britannica\.com)\b/i.test(String(v))) ? 4 : 3);
    const perQueryCount = looksLikeSunBlack ? 5 : 3;

    for (const q of variants.slice(0, maxVariants)) {
        const results = await braveSearch(q, apiKey, context, perQueryCount);
        for (const r of results) {
            const key = String(r.url || '').trim();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            merged.push(r);
        }
        if (merged.length >= (looksLikeSunBlack ? 10 : 6)) break;
    }

    return {
        verified: false,
        partialMatch: merged.length > 0,
        source: merged[0]?.url || null,
        title: merged[0]?.title || null,
        query: variants[0] || sanitizeBraveQuery(claimText),
        results: merged.slice(0, 8)
    };
}

function buildQueryVariantsForClaim(claimText, lang) {
    const normalized = normalizeLang(lang);
    const cleaned = sanitizeBraveQuery(claimText);
    const variants = [cleaned];

    // Cas courant: "Le soleil est noir" / "The sun is black" -> requêtes plus probantes.
    if (/\b(soleil|sun)\b/i.test(cleaned) && /\b(noir|black)\b/i.test(cleaned)) {
        if (normalized === 'en') {
            // Requêtes plus "factuelles" + sources autoritatives
            variants.push('what color is the Sun');
            variants.push('site:nasa.gov Sun emits visible light');
            variants.push('site:britannica.com color of the Sun');
            variants.push('Sun emits light visible spectrum');
            variants.push('site:nso.edu color of the Sun');
            variants.push('National Solar Observatory what color is the Sun');
            variants.push('site:wikipedia.org Sun appears white');
            variants.push('Sun is bright emits light not black');
        } else {
            variants.push('couleur du Soleil');
            variants.push('site:nasa.gov le Soleil émet de la lumière visible');
            variants.push('site:britannica.com couleur du Soleil');
            variants.push('spectre visible Soleil lumière');
            variants.push('site:nso.edu couleur du Soleil');
            variants.push('Observatoire solaire national couleur du Soleil');
            variants.push('site:wikipedia.org Soleil apparaît blanc');
            variants.push('le Soleil est lumineux émet de la lumière pas noir');
        }
    }

    // Cas "terre plate" / "earth is flat"
    if (/\b(terre|earth)\b/i.test(cleaned) && /\b(platte|plate|flat)\b/i.test(cleaned)) {
        if (normalized === 'en') {
            variants.push('is the earth flat');
            variants.push('evidence earth is round');
        } else {
            variants.push('la terre est-elle plate');
            variants.push('preuves terre ronde');
        }
    }

    return [...new Set(variants)].filter(Boolean);
}

function braveSearch(queryText, apiKey, context, count = 3) {
    return new Promise((resolve) => {
        const cleaned = sanitizeBraveQuery(queryText);
        const query = encodeURIComponent(cleaned);
        const options = {
            hostname: 'api.search.brave.com',
            path: `/res/v1/web/search?q=${query}&count=${Math.max(1, Math.min(10, Number(count) || 3))}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
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

                    const results = hasResults
                        ? result.web.results.slice(0, 8).map(r => ({
                            title: r.title,
                            url: r.url,
                            description: r.description || r.snippet || ''
                        }))
                        : [];

                    resolve(results);
                } catch (err) {
                    context?.log?.error?.('Erreur parsing Brave:', err);
                    resolve([]);
                }
            });
        });

        req.on('error', (err) => {
            context?.log?.error?.('Erreur requête Brave:', err);
            resolve([]);
        });

        req.setTimeout(5000, () => {
            req.destroy();
            resolve([]);
        });

        req.end();
    });
}

function sanitizeBraveQuery(input) {
    const text = (input ?? '').toString();
    // Retirer les emojis et symboles (souvent nuisibles aux moteurs de recherche).
    // Range approximative, suffisante pour nos cas UI.
    const withoutEmoji = text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ');

    // Normaliser ponctuation/espaces
    const simplified = withoutEmoji
        .replace(/\s+/g, ' ')
        .replace(/[“”"'’]/g, ' ')
        .replace(/[\u2013\u2014]/g, ' ')
        .trim();

    // Éviter les requêtes trop longues
    return simplified.length > 180 ? simplified.slice(0, 180) : simplified;
}

function pickClaimsForEvidenceCheck(hallucinationAnalysis, rawText) {
    const claims = Array.isArray(hallucinationAnalysis?.claims) ? hallucinationAnalysis.claims : [];
    const fromDetector = claims
        .map(c => (c && c.text ? stripMetaPrefix(String(c.text).trim()) : ''))
        .filter(Boolean);

    if (fromDetector.length > 0) {
        return [...new Set(fromDetector)].slice(0, 6);
    }

    // Fallback: extraire des phrases "vérifiables" basiques
    const text = String(rawText || '');
    const sentenceCandidates = text
        .split(/[.!?\n\r]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .filter(s => s.length >= 8 && s.length <= 220);

    // Prioriser les phrases type "X est Y" / chiffres
    const copula = /\b(est|sont|était|étaient|sera|seront|serait|seraient|is|are|was|were|will\s+be)\b/i;
    const hasNumber = /\b\d+([,.]\d+)?%?\b/;
    const scored = sentenceCandidates
        .map(s => ({
            text: s,
            score: (copula.test(s) ? 2 : 0) + (hasNumber.test(s) ? 1 : 0) + Math.min(1, s.length / 120)
        }))
        .sort((a, b) => b.score - a.score)
        .map(x => x.text);

    return [...new Set(scored)].slice(0, 6);
}

function normalizeTextForHallucinationAnalysis(rawText) {
    const text = String(rawText || '');
    // Traitement ligne par ligne: on enlève les préfixes méta là où ils apparaissent.
    // Exemple: "ChatGPT says that the sun is black" => "the sun is black".
    return text
        .split(/\n/)
        .map(line => stripMetaPrefix(line))
        .join('\n')
        .trim();
}

function pickFactsForBrave(hallucinationAnalysis, rawText) {
    const claims = Array.isArray(hallucinationAnalysis?.claims) ? hallucinationAnalysis.claims : [];
    const fromClaims = claims
        .map(c => (c && c.text ? String(c.text).trim() : ''))
        .map(stripMetaPrefix)
        .filter(Boolean);

    if (fromClaims.length > 0) {
        return [...new Set(fromClaims)].slice(0, 8);
    }

    // Fallback: extraction simple (sync) si le détecteur ne fournit pas de claims.
    const text = String(rawText || '');
    const sentences = text
        .split(/[.!?\n\r]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .filter(s => s.length >= 8 && s.length <= 220)
        .map(stripMetaPrefix)
        .filter(Boolean);

    return [...new Set(sentences)].slice(0, 8);
}

function stripMetaPrefix(s) {
    const t = String(s || '').trim();
    if (!t) return '';

    // Retirer les formulations "meta" qui polluent la recherche.
    // Ex: "Chat gpt say that the sun is black" => "the sun is black"
    const metaPatterns = [
        /^chat\s*gpt\s*(said|says|say)\s+that\s+/i,
        /^chatgpt\s*(said|says)\s+that\s+/i,
        /^gpt\s*[- ]?\d+\s*(said|says)\s+that\s+/i,
        /^(l['’]?ia|le\s+chatgpt|chat\s*gpt)\s*(a\s+dit|dit|disait)\s+que\s+/i
    ];
    let out = t;
    for (const rx of metaPatterns) {
        out = out.replace(rx, '');
    }
    return out.trim();
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
function detectSecurityIssues(text, lang) {
    const warnings = [];
    const lowerText = text.toLowerCase();
    const isEn = normalizeLang(lang) === 'en';
    
    // Conseils médicaux non sourcés
    const medicalKeywords = ['diagnostic', 'traitement', 'médicament', 'maladie', 'symptôme', 'thérapie'];
    const hasMedical = medicalKeywords.some(kw => lowerText.includes(kw));
    const hasSource = /selon|source|étude|recherche|publiée|journal/i.test(text);
    
    if (hasMedical && !hasSource) {
        warnings.push({
            type: 'medical',
            severity: 'high',
            message: isEn
                ? '⚠️ Contains medical information without reliable sources'
                : '⚠️ Contient des informations médicales sans sources fiables'
        });
    }
    
    // Conseils juridiques non sourcés
    const legalKeywords = ['article', 'loi', 'code', 'juridique', 'légal', 'tribunal'];
    const hasLegal = legalKeywords.some(kw => lowerText.includes(kw));
    
    if (hasLegal && !hasSource) {
        warnings.push({
            type: 'legal',
            severity: 'high',
            message: isEn
                ? '⚠️ Contains legal information without precise references'
                : '⚠️ Contient des informations juridiques sans références précises'
        });
    }
    
    return warnings;
}

// Générer recommandation
function generateRecommendation(score, braveEnabled, hallucinationCount, suspiciousCount, warningCount, lang) {
    const isEn = normalizeLang(lang) === 'en';

    if (warningCount > 0) {
        return isEn
            ? '🚨 ALERT: This response contains sensitive information without sources. Verification is required before use.'
            : '🚨 ALERTE : Cette réponse contient des informations sensibles sans sources. Vérification obligatoire avant utilisation.';
    }

    if (score === null) {
        if (braveEnabled) {
            return isEn
                ? 'ℹ️ Score unavailable (no actionable facts detected). Add verifiable details or sources.'
                : 'ℹ️ Score indisponible (aucun fait exploitable détecté). Ajoutez des détails vérifiables ou des sources.';
        }
        return isEn
            ? 'ℹ️ Automatic verification unavailable (Brave API not configured). Add sources (e.g., NASA, ESA, Wikipedia) or enable verification.'
            : 'ℹ️ Vérification automatique indisponible (Brave API non configurée). Ajoutez des sources (ex: NASA, ESA, Wikipedia) ou activez la vérification.';
    }

    if (score >= 80 && hallucinationCount === 0 && suspiciousCount === 0) {
        return isEn
            ? '✅ High reliability. This response looks factual and well-sourced.'
            : '✅ Fiabilité élevée. Cette réponse semble factuelle et bien sourcée.';
    }

    // Si des hallucinations probables sont détectées, on signale des erreurs factuelles.
    if (hallucinationCount > 0) {
        return isEn
            ? '❌ Low reliability. Likely factual errors detected. Verification recommended.'
            : '❌ Fiabilité faible. Erreurs factuelles probables détectées. Vérification recommandée.';
    }

    // Si on a surtout des points non confirmés, rester prudent: ce n'est pas une preuve d'erreur.
    if (suspiciousCount > 0) {
        return isEn
            ? '⚠️ Caution: unverified points detected. Verify sources before using this response.'
            : '⚠️ Prudence : des points non vérifiés ont été détectés. Vérifiez des sources avant utilisation.';
    }

    if (score >= 60) {
        return isEn
            ? '⚠️ Medium reliability. Verify unconfirmed points before use.'
            : '⚠️ Fiabilité moyenne. Vérifiez les points non confirmés avant utilisation.';
    }

    return isEn
        ? '⚠️ Low reliability (insufficient evidence). Add sources or enable web verification.'
        : '⚠️ Fiabilité faible (preuves insuffisantes). Ajoutez des sources ou activez la vérification web.';
}

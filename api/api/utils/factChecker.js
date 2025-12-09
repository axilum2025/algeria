/**
 * Fact-Checking Module
 * Intègre Google Fact Check Tools API pour validation contre sources publiques
 * Détection automatique des fake news
 */

class FactChecker {
  constructor() {
    this.apiKey = process.env.GOOGLE_FACT_CHECK_API_KEY || null;
    this.endpoint = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
    this.enabled = !!this.apiKey;
    this.cache = new Map(); // Cache en mémoire pour éviter requêtes répétées
    this.maxCacheSize = 100;
    
    if (!this.enabled) {
      console.log('⚠️  Google Fact Check API key non configurée - Fact-checking désactivé');
      console.log('💡 Pour activer: GOOGLE_FACT_CHECK_API_KEY dans environment variables');
    } else {
      console.log('✅ Fact-Checker initialisé avec Google Fact Check Tools API');
    }
  }

  /**
   * Vérifie si un claim a été fact-checké par des sources publiques
   * @param {string} claim - Le claim à vérifier
   * @returns {Promise<Object>} Résultat du fact-check
   */
  async checkClaim(claim) {
    if (!this.enabled) {
      return {
        checked: false,
        reason: 'api_key_missing',
        status: 'unavailable'
      };
    }

    // Vérifier le cache
    const cacheKey = claim.toLowerCase().trim();
    if (this.cache.has(cacheKey)) {
      console.log('📦 Fact-check depuis cache');
      return this.cache.get(cacheKey);
    }

    try {
      // Construire l'URL avec query parameters
      const url = new URL(this.endpoint);
      url.searchParams.append('query', claim);
      url.searchParams.append('key', this.apiKey);
      url.searchParams.append('languageCode', 'fr'); // Support français

      console.log(`🔍 Vérification fact-check: "${claim.substring(0, 50)}..."`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Fact Check API error: ${response.status}`);
      }

      const data = await response.json();
      
      const result = this.parseFactCheckResponse(data, claim);
      
      // Mettre en cache
      this.addToCache(cacheKey, result);
      
      return result;

    } catch (error) {
      console.error('❌ Erreur Fact-Checker:', error.message);
      return {
        checked: false,
        reason: 'api_error',
        error: error.message,
        status: 'error'
      };
    }
  }

  /**
   * Parse la réponse de l'API Google Fact Check
   */
  parseFactCheckResponse(data, originalClaim) {
    if (!data.claims || data.claims.length === 0) {
      return {
        checked: true,
        found: false,
        claim: originalClaim,
        status: 'not_found',
        message: 'Aucune vérification trouvée pour ce claim'
      };
    }

    // Prendre le premier résultat (le plus pertinent)
    const topClaim = data.claims[0];
    const claimReview = topClaim.claimReview?.[0] || {};

    // Extraire le rating
    const rating = claimReview.textualRating || 'Unknown';
    const publisher = claimReview.publisher?.name || 'Unknown';
    const url = claimReview.url || null;
    const reviewDate = claimReview.reviewDate || null;

    // Déterminer si c'est une fake news
    const isFakeNews = this.isFakeNewsRating(rating);
    const trustScore = this.calculateTrustScore(rating);

    return {
      checked: true,
      found: true,
      claim: topClaim.text || originalClaim,
      claimant: topClaim.claimant || 'Unknown',
      rating: rating,
      publisher: publisher,
      url: url,
      reviewDate: reviewDate,
      isFakeNews: isFakeNews,
      trustScore: trustScore,
      status: 'verified',
      message: `Vérifié par ${publisher}: ${rating}`
    };
  }

  /**
   * Détermine si un rating indique une fake news
   */
  isFakeNewsRating(rating) {
    const fakeNewsKeywords = [
      'false', 'faux', 'incorrect', 'fake', 
      'pants on fire', 'misleading', 'trompeur',
      'mostly false', 'mostly incorrect'
    ];
    
    const ratingLower = rating.toLowerCase();
    return fakeNewsKeywords.some(keyword => ratingLower.includes(keyword));
  }

  /**
   * Calcule un score de confiance basé sur le rating
   * @returns {number} Score entre 0 (fake news certaine) et 1 (vérifié vrai)
   */
  calculateTrustScore(rating) {
    const ratingLower = rating.toLowerCase();
    
    // Scores par catégorie
    if (ratingLower.includes('true') && !ratingLower.includes('mostly')) {
      return 1.0; // Entièrement vrai
    }
    if (ratingLower.includes('mostly true') || ratingLower.includes('correct')) {
      return 0.8; // Plutôt vrai
    }
    if (ratingLower.includes('mixture') || ratingLower.includes('half true')) {
      return 0.5; // Mitigé
    }
    if (ratingLower.includes('mostly false') || ratingLower.includes('misleading')) {
      return 0.3; // Plutôt faux
    }
    if (ratingLower.includes('false') || ratingLower.includes('fake') || 
        ratingLower.includes('pants on fire') || ratingLower.includes('incorrect')) {
      return 0.1; // Faux
    }
    
    return 0.5; // Inconnu - neutre
  }

  /**
   * Extrait les claims potentiels d'un texte
   * Identifie les affirmations factuelles qui méritent d'être vérifiées
   */
  extractClaims(text) {
    const claims = [];
    
    // Patterns pour identifier des claims factuels
    const patterns = [
      // Statistiques et chiffres
      /(\d+%|\d+\s*(?:millions?|milliards?|personnes?|euros?|dollars?))[^.!?]*[.!?]/gi,
      // Dates et événements
      /en\s+\d{4}[^.!?]*[.!?]/gi,
      // Affirmations catégoriques
      /(?:il est|c'est|tous les|aucun|jamais|toujours)[^.!?]*[.!?]/gi
    ];

    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const claim = match.trim();
          if (claim.length > 20 && claim.length < 200) {
            claims.push(claim);
          }
        });
      }
    });

    // Dédupliquer et limiter
    return [...new Set(claims)].slice(0, 3); // Max 3 claims par requête
  }

  /**
   * Vérifie tous les claims d'un texte
   */
  async checkText(text) {
    const claims = this.extractClaims(text);
    
    if (claims.length === 0) {
      return {
        checked: true,
        claimsFound: 0,
        results: [],
        overallTrust: 1.0,
        hasFakeNews: false
      };
    }

    console.log(`📋 ${claims.length} claims extraits pour fact-checking`);

    // Vérifier chaque claim (en parallèle)
    const results = await Promise.all(
      claims.map(claim => this.checkClaim(claim))
    );

    // Calculer confiance globale
    const verifiedResults = results.filter(r => r.found);
    const avgTrust = verifiedResults.length > 0
      ? verifiedResults.reduce((sum, r) => sum + r.trustScore, 0) / verifiedResults.length
      : 1.0;

    const hasFakeNews = verifiedResults.some(r => r.isFakeNews);

    return {
      checked: true,
      claimsFound: claims.length,
      claimsVerified: verifiedResults.length,
      results: results,
      overallTrust: avgTrust,
      hasFakeNews: hasFakeNews,
      status: hasFakeNews ? 'fake_news_detected' : 'verified'
    };
  }

  /**
   * Ajoute un résultat au cache (avec limite de taille)
   */
  addToCache(key, value) {
    if (this.cache.size >= this.maxCacheSize) {
      // Supprimer le plus ancien (FIFO)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  /**
   * Nettoie le cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Cache fact-checker nettoyé');
  }
}

module.exports = FactChecker;

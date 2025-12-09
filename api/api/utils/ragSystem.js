/**
 * RAG (Retrieval-Augmented Generation) Module
 * Recherche vectorielle avec embeddings pour validation de faits
 * Base de connaissances vérifiée pour fact-checking interne
 */

class RAGSystem {
  constructor() {
    this.knowledgeBase = this.initializeKnowledgeBase();
    this.enabled = true;
    console.log(`✅ RAG System initialisé avec ${this.knowledgeBase.length} entrées de connaissance`);
  }

  /**
   * Initialise une base de connaissances vérifiée
   * En production, cela pourrait être chargé depuis Azure Table Storage ou Azure AI Search
   */
  initializeKnowledgeBase() {
    return [
      {
        id: 'kb-001',
        category: 'géographie',
        fact: 'La capitale de la France est Paris',
        verified: true,
        confidence: 1.0,
        sources: ['INSEE', 'Constitution française'],
        embedding: null // Sera calculé à la demande
      },
      {
        id: 'kb-002',
        category: 'science',
        fact: 'La Terre tourne autour du Soleil',
        verified: true,
        confidence: 1.0,
        sources: ['NASA', 'Communauté scientifique'],
        embedding: null
      },
      {
        id: 'kb-003',
        category: 'mathématiques',
        fact: '2 + 2 = 4',
        verified: true,
        confidence: 1.0,
        sources: ['Mathématiques fondamentales'],
        embedding: null
      },
      {
        id: 'kb-004',
        category: 'démographie',
        fact: 'La population de Paris intra-muros est d\'environ 2,1 millions d\'habitants (données récentes)',
        verified: true,
        confidence: 0.9,
        sources: ['INSEE'],
        embedding: null
      },
      {
        id: 'kb-005',
        category: 'santé',
        fact: 'Le tabagisme est nocif pour la santé',
        verified: true,
        confidence: 1.0,
        sources: ['OMS', 'Études scientifiques'],
        embedding: null
      },
      {
        id: 'kb-006',
        category: 'climat',
        fact: 'Le changement climatique est causé principalement par les activités humaines',
        verified: true,
        confidence: 0.95,
        sources: ['GIEC', 'Consensus scientifique'],
        embedding: null
      },
      {
        id: 'kb-007',
        category: 'santé',
        fact: 'Les vaccins sont efficaces et sûrs',
        verified: true,
        confidence: 0.95,
        sources: ['OMS', 'CDC', 'EMA'],
        embedding: null
      }
    ];
  }

  /**
   * Calcule la similarité cosinus entre deux vecteurs
   */
  cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Génère un embedding simple basé sur les mots (fallback sans GPT)
   * En production, utiliser GPT embeddings ou Azure AI Search
   */
  generateSimpleEmbedding(text) {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

    // Créer un vecteur de 100 dimensions basé sur hash de mots
    const embedding = new Array(100).fill(0);
    
    words.forEach(word => {
      // Hash simple du mot
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
      }
      
      // Distribuer dans l'embedding
      const index = Math.abs(hash) % embedding.length;
      embedding[index] += 1;
    });

    // Normaliser
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
  }

  /**
   * Recherche sémantique dans la base de connaissances
   * @param {string} query - La requête de l'utilisateur
   * @param {number} topK - Nombre de résultats à retourner
   * @returns {Array} Résultats triés par pertinence
   */
  async search(query, topK = 3) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    console.log(`🔍 RAG Search: "${query.substring(0, 50)}..."`);

    // Générer embedding de la query
    const queryEmbedding = this.generateSimpleEmbedding(query);

    // Calculer similarité avec chaque entrée de la KB
    const results = this.knowledgeBase.map(entry => {
      // Générer embedding si pas encore fait
      if (!entry.embedding) {
        entry.embedding = this.generateSimpleEmbedding(entry.fact);
      }

      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);

      return {
        ...entry,
        similarity: similarity,
        relevance: similarity * entry.confidence // Pondérer par confiance
      };
    });

    // Trier par relevance et prendre top K
    const topResults = results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, topK)
      .filter(r => r.similarity > 0.3); // Seuil de pertinence

    console.log(`📊 RAG trouvé ${topResults.length} résultats pertinents`);

    return topResults;
  }

  /**
   * Vérifie un claim contre la base de connaissances
   * @param {string} claim - Le claim à vérifier
   * @returns {Object} Résultat de la vérification
   */
  async verifyClaim(claim) {
    const results = await this.search(claim, 1);

    if (results.length === 0) {
      return {
        verified: false,
        found: false,
        confidence: 0,
        message: 'Aucune entrée pertinente dans la base de connaissances'
      };
    }

    const topMatch = results[0];

    return {
      verified: true,
      found: true,
      matchedFact: topMatch.fact,
      similarity: topMatch.similarity,
      confidence: topMatch.confidence,
      sources: topMatch.sources,
      category: topMatch.category,
      isReliable: topMatch.similarity > 0.7, // Seuil de fiabilité
      message: topMatch.similarity > 0.7 
        ? `Fait vérifié: ${topMatch.fact}` 
        : 'Similarité faible avec la base de connaissances'
    };
  }

  /**
   * Enrichit une réponse GPT avec des faits de la base de connaissances
   * @param {string} userMessage - Message de l'utilisateur
   * @param {string} gptResponse - Réponse GPT à enrichir
   * @returns {Object} Contexte enrichi
   */
  async enrichContext(userMessage, gptResponse) {
    // Rechercher contexte pertinent
    const relevantKnowledge = await this.search(userMessage, 3);

    if (relevantKnowledge.length === 0) {
      return {
        enriched: false,
        relevantFacts: [],
        recommendation: 'none'
      };
    }

    // Analyser si la réponse GPT contredit la KB
    const contradictions = [];
    for (const knowledge of relevantKnowledge) {
      if (knowledge.similarity > 0.6) {
        // Vérifier si GPT response contient des contradictions
        const responseEmbedding = this.generateSimpleEmbedding(gptResponse);
        const factEmbedding = knowledge.embedding;
        const similarity = this.cosineSimilarity(responseEmbedding, factEmbedding);

        if (similarity < 0.3) {
          contradictions.push({
            fact: knowledge.fact,
            sources: knowledge.sources,
            confidence: knowledge.confidence
          });
        }
      }
    }

    return {
      enriched: true,
      relevantFacts: relevantKnowledge.map(k => ({
        fact: k.fact,
        confidence: k.confidence,
        sources: k.sources,
        similarity: k.similarity
      })),
      contradictions: contradictions,
      hasContradictions: contradictions.length > 0,
      recommendation: contradictions.length > 0 ? 'verify_sources' : 'approved'
    };
  }

  /**
   * Ajoute dynamiquement un fait à la base de connaissances
   * En production, cela persisterait dans Azure Table Storage
   */
  async addFact(fact, category, sources, confidence = 0.8) {
    const newEntry = {
      id: `kb-${Date.now()}`,
      category: category,
      fact: fact,
      verified: true,
      confidence: confidence,
      sources: sources,
      embedding: this.generateSimpleEmbedding(fact)
    };

    this.knowledgeBase.push(newEntry);
    console.log(`✅ Nouveau fait ajouté à la KB: ${fact.substring(0, 50)}...`);

    return newEntry;
  }

  /**
   * Statistiques de la base de connaissances
   */
  getStats() {
    const categories = [...new Set(this.knowledgeBase.map(e => e.category))];
    const avgConfidence = this.knowledgeBase.reduce((sum, e) => sum + e.confidence, 0) / this.knowledgeBase.length;

    return {
      totalEntries: this.knowledgeBase.length,
      categories: categories,
      avgConfidence: avgConfidence,
      verified: this.knowledgeBase.filter(e => e.verified).length
    };
  }
}

module.exports = RAGSystem;

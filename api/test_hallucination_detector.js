// 🧪 Test du système de détection d'hallucinations
const { analyzeHallucination } = require('./utils/hallucinationDetector');

// Exemples de test
const testCases = [
    {
        name: "Réponse fiable avec sources",
        question: "Quelle est la capitale de la France ?",
        response: "Selon les données géographiques officielles, Paris est généralement reconnue comme la capitale de la France. Cette désignation remonte probablement à plusieurs siècles d'histoire.",
        expectedHI: "bas (< 0.3)"
    },
    {
        name: "Réponse avec certitudes absolues (risque)",
        question: "Est-ce que tous les chats sont noirs ?",
        response: "Absolument tous les chats sont toujours noirs. C'est certainement le cas à 100% et il n'y a aucun doute là-dessus. Jamais vous ne verrez un chat d'une autre couleur.",
        expectedHI: "élevé (> 0.6)"
    },
    {
        name: "Réponse nuancée",
        response: "Il semble que la plupart des experts s'accordent généralement sur ce point, bien que certaines études suggèrent des exceptions possibles dans certains cas particuliers.",
        expectedHI: "très bas (< 0.15)"
    },
    {
        name: "Réponse mixte",
        response: "Paris est la capitale de la France, c'est absolument certain. Cependant, selon certaines sources, Lyon joue également un rôle important dans l'administration française.",
        expectedHI: "moyen (0.2-0.4)"
    }
];

async function runTests() {
    console.log('🧪 DÉMARRAGE DES TESTS DE DÉTECTION D\'HALLUCINATIONS\n');
    console.log('='.repeat(80));
    
    for (let i = 0; i < testCases.length; i++) {
        const test = testCases[i];
        console.log(`\n📝 TEST ${i + 1}: ${test.name}`);
        console.log('-'.repeat(80));
        console.log('Question:', test.question || 'N/A');
        console.log('Réponse:', test.response);
        console.log('\nAttendu: HI', test.expectedHI);
        console.log('\n⏳ Analyse en cours...\n');
        
        try {
            const startTime = Date.now();
            const analysis = await analyzeHallucination(
                test.response,
                test.question || ''
            );
            const duration = Date.now() - startTime;
            
            console.log('✅ RÉSULTATS:');
            console.log('─'.repeat(80));
            console.log('Méthode utilisée:', analysis.method?.toUpperCase() || 'INCONNUE');
            console.log(`Temps d'analyse: ${duration}ms`);
            console.log('\n📊 MÉTRIQUES:');
            console.log(`  HI (Hallucination Index): ${(analysis.hi * 100).toFixed(1)}%`);
            console.log(`  CHR (Composite Risk):      ${(analysis.chr * 100).toFixed(1)}%`);
            
            if (analysis.counts && analysis.counts.total > 0) {
                console.log('\n📋 CLAIMS ANALYSÉS:');
                console.log(`  Total: ${analysis.counts.total}`);
                console.log(`  ✅ Supportés:       ${analysis.counts.supported}`);
                console.log(`  ⚠️  Non supportés:  ${analysis.counts.not_supported}`);
                console.log(`  ❌ Contradictoires: ${analysis.counts.contradictory}`);
                
                if (analysis.claims && analysis.claims.length > 0) {
                    console.log('\n  Détails des claims:');
                    analysis.claims.forEach((claim, idx) => {
                        const icon = claim.classification === 'SUPPORTED' ? '✅' : 
                                   claim.classification === 'NOT_SUPPORTED' ? '⚠️' : '❌';
                        console.log(`  ${idx + 1}. ${icon} [${claim.classification}] "${claim.text}"`);
                    });
                }
            }
            
            if (analysis.sources && analysis.sources.length > 0) {
                console.log('\n📚 SOURCES RECOMMANDÉES:');
                analysis.sources.forEach((source, idx) => {
                    console.log(`  ${idx + 1}. ${source}`);
                });
            }
            
            if (analysis.warning) {
                console.log(`\n⚠️  WARNING: ${analysis.warning}`);
            }
            
            // Évaluation du résultat
            const hiLevel = analysis.hi < 0.15 ? 'très bas' : 
                          analysis.hi < 0.3 ? 'bas' : 
                          analysis.hi < 0.6 ? 'moyen' : 'élevé';
            console.log(`\n🎯 Niveau de risque: ${hiLevel.toUpperCase()}`);
            
        } catch (error) {
            console.error('❌ ERREUR:', error.message);
            console.error(error.stack);
        }
        
        console.log('\n' + '='.repeat(80));
    }
    
    console.log('\n✅ TESTS TERMINÉS\n');
}

// Lancer les tests
runTests().catch(console.error);

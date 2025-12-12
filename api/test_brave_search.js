// Test de l'API Brave Search
// Utilisation: node api/test_brave_search.js

async function testBraveSearch() {
    console.log('🔍 Test de Brave Search API\n');
    
    // Remplacer par votre clé API réelle
    const apiKey = process.env.BRAVE_API_KEY || 'BSA_VOTRE_CLE_ICI';
    const query = 'actualités intelligence artificielle 2024';
    
    console.log(`📝 Question: "${query}"\n`);
    
    try {
        const response = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Subscription-Token': apiKey
                }
            }
        );
        
        if (!response.ok) {
            console.error(`❌ Erreur HTTP: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error(`Détails: ${errorText}`);
            return;
        }
        
        const data = await response.json();
        
        if (!data.web?.results) {
            console.warn('⚠️ Aucun résultat trouvé');
            return;
        }
        
        console.log(`✅ ${data.web.results.length} résultats trouvés:\n`);
        
        data.web.results.slice(0, 3).forEach((result, i) => {
            console.log(`${i + 1}. ${result.title}`);
            console.log(`   📄 ${result.description}`);
            console.log(`   🔗 ${result.url}\n`);
        });
        
        // Afficher le contexte qui serait ajouté au prompt
        console.log('---\n💡 Contexte ajouté au prompt système:\n');
        let contextFromSearch = 'Contexte de recherche web (utilise ces informations si pertinentes) :\n';
        data.web.results.slice(0, 3).forEach((r, i) => {
            contextFromSearch += `${i+1}. ${r.title}: ${r.description} [${r.url}]\n`;
        });
        console.log(contextFromSearch);
        
    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
        console.error(error.stack);
    }
}

// Tests avec différentes queries
async function runTests() {
    const queries = [
        'actualités intelligence artificielle 2024',
        'météo Paris aujourd\'hui',
        'dernière version Node.js',
        'prix Bitcoin'
    ];
    
    for (const query of queries) {
        console.log('\n' + '='.repeat(70) + '\n');
        await testBraveSearch();
        
        // Attendre 1 seconde entre chaque requête
        if (queries.indexOf(query) < queries.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Exécuter le test
if (require.main === module) {
    console.log('🚀 Démarrage des tests Brave Search API\n');
    testBraveSearch().then(() => {
        console.log('\n✅ Test terminé');
    }).catch(error => {
        console.error('\n❌ Erreur globale:', error);
    });
}

module.exports = { testBraveSearch };

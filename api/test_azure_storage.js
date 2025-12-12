const { BlobServiceClient } = require('@azure/storage-blob');

async function testAzureStorage() {
    console.log('=== Test Azure Storage Account ===\n');

    // Configuration
    const accountName = 'axilumaistorage';
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (!connectionString) {
        console.error('❌ AZURE_STORAGE_CONNECTION_STRING non définie');
        console.log('\nDéfinissez-la avec:');
        console.log('export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=axilumaistorage;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net"');
        return;
    }

    try {
        // 1. Vérifier la connexion
        console.log('📡 Test de connexion...');
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        
        // 2. Lister les conteneurs
        console.log('\n📦 Conteneurs disponibles:');
        let containerCount = 0;
        for await (const container of blobServiceClient.listContainers()) {
            containerCount++;
            console.log(`  ${containerCount}. ${container.name}`);
            console.log(`     - Dernière modification: ${container.properties.lastModified}`);
            console.log(`     - État: ${container.properties.leaseState}`);
            
            // Lister les fichiers dans chaque conteneur
            const containerClient = blobServiceClient.getContainerClient(container.name);
            console.log(`     - Fichiers:`);
            
            let blobCount = 0;
            try {
                for await (const blob of containerClient.listBlobsFlat()) {
                    blobCount++;
                    const size = (blob.properties.contentLength / 1024).toFixed(2);
                    console.log(`       ${blobCount}. ${blob.name} (${size} KB)`);
                    if (blobCount >= 5) {
                        console.log(`       ... et plus`);
                        break;
                    }
                }
                if (blobCount === 0) {
                    console.log(`       (vide)`);
                }
            } catch (err) {
                console.log(`       Erreur: ${err.message}`);
            }
            console.log('');
        }

        if (containerCount === 0) {
            console.log('  Aucun conteneur trouvé');
        }

        // 3. Vérifier les propriétés du compte
        console.log('\n⚙️  Propriétés du compte:');
        const accountProperties = await blobServiceClient.getAccountInfo();
        console.log(`  - Type de compte: ${accountProperties.accountKind}`);
        console.log(`  - SKU: ${accountProperties.skuName}`);

        // 4. Statistiques
        console.log('\n📊 Résumé:');
        console.log(`  ✅ Connexion réussie`);
        console.log(`  ✅ Compte: ${accountName}`);
        console.log(`  ✅ Conteneurs: ${containerCount}`);

        console.log('\n🎉 Test réussi !');

    } catch (error) {
        console.error('\n❌ Erreur:', error.message);
        console.error('\nDétails:', error);
    }
}

// Test de création d'un conteneur (optionnel)
async function testCreateContainer() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
        console.error('❌ AZURE_STORAGE_CONNECTION_STRING non définie');
        return;
    }

    const containerName = 'test-container-' + Date.now();
    console.log(`\n📦 Test de création de conteneur: ${containerName}`);

    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        await containerClient.create();
        console.log('✅ Conteneur créé avec succès');
        
        // Supprimer le conteneur de test
        await containerClient.delete();
        console.log('✅ Conteneur de test supprimé');
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

// Exécution
(async () => {
    await testAzureStorage();
    // Décommenter pour tester la création
    // await testCreateContainer();
})();

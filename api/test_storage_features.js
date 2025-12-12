const codeStorage = require('./utils/codeStorage');
const userStorage = require('./utils/userStorage');

console.log('🧪 Test des fonctionnalités de stockage Azure\n');
console.log('='.repeat(60));

async function testCodeStorage() {
    console.log('\n📧 TEST 1 : Codes de vérification (Signup Instantané)\n');
    
    try {
        const testEmail = 'test@example.com';
        const code = '123456';
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        
        // 1. Stocker un code
        console.log('1️⃣  Stockage d\'un code de vérification...');
        await codeStorage.storeCode(testEmail, code, expiresAt);
        console.log(`   ✅ Code stocké: ${code}`);
        console.log(`   📧 Pour: ${testEmail}`);
        console.log(`   ⏰ Expire: ${expiresAt.toLocaleString('fr-FR')}`);
        
        // 2. Récupérer le code
        console.log('\n2️⃣  Récupération du code...');
        const retrievedCode = await codeStorage.getCode(testEmail);
        console.log(`   ${retrievedCode ? '✅' : '❌'} Code trouvé: ${retrievedCode ? 'OUI' : 'NON'}`);
        
        if (retrievedCode) {
            console.log(`   📝 Code: ${retrievedCode.code}`);
            console.log(`   ⏰ Expiration: ${new Date(retrievedCode.expiresAt).toLocaleString('fr-FR')}`);
        }
        
        // 3. Vérifier que les données correspondent
        console.log('\n3️⃣  Vérification de l\'intégrité...');
        const dataMatch = retrievedCode && retrievedCode.code === code;
        console.log(`   ${dataMatch ? '✅' : '❌'} Code correspond: ${dataMatch ? 'OUI' : 'NON'}`);
        
        // 4. Supprimer le code
        console.log('\n4️⃣  Suppression du code...');
        await codeStorage.deleteCode(testEmail);
        console.log('   ✅ Code supprimé');
        
        // 5. Vérifier la suppression
        console.log('\n5️⃣  Vérification de la suppression...');
        const deletedCode = await codeStorage.getCode(testEmail);
        console.log(`   ${!deletedCode ? '✅' : '❌'} Suppression confirmée: ${!deletedCode ? 'OUI' : 'NON'}`);
        
        console.log('\n✅ Test des codes de vérification : RÉUSSI');
        return true;
        
    } catch (error) {
        console.error('\n❌ Erreur lors du test des codes:', error.message);
        console.error('Détails:', error);
        return false;
    }
}

async function testUserStorage() {
    console.log('\n\n👤 TEST 2 : Données utilisateur (Profils & Paramètres)\n');
    
    try {
        const testUsername = 'testuser' + Date.now();
        const testUserData = {
            email: 'user@test.com',
            name: 'Test User',
            plan: 'PRO',
            roles: ['user', 'premium']
        };
        
        // 1. Créer un utilisateur
        console.log('1️⃣  Création d\'un utilisateur...');
        await userStorage.createUser(testUsername, testUserData);
        console.log(`   ✅ Utilisateur créé: ${testUsername}`);
        console.log(`   📧 Email: ${testUserData.email}`);
        console.log(`   📛 Nom: ${testUserData.name}`);
        console.log(`   💎 Plan: ${testUserData.plan}`);
        
        // 2. Vérifier que l'utilisateur existe
        console.log('\n2️⃣  Vérification de l\'existence...');
        const exists = await userStorage.userExists(testUsername);
        console.log(`   ${exists ? '✅' : '❌'} Utilisateur existe: ${exists ? 'OUI' : 'NON'}`);
        
        // 3. Récupérer l'utilisateur
        console.log('\n3️⃣  Récupération de l\'utilisateur...');
        const retrievedUser = await userStorage.getUser(testUsername);
        console.log(`   ${retrievedUser ? '✅' : '❌'} Utilisateur trouvé: ${retrievedUser ? 'OUI' : 'NON'}`);
        
        if (retrievedUser) {
            console.log(`   📧 Email: ${retrievedUser.email}`);
            console.log(`   📛 Nom: ${retrievedUser.name}`);
            console.log(`   💎 Plan: ${retrievedUser.plan}`);
        }
        
        // 4. Vérifier que les données correspondent
        console.log('\n4️⃣  Vérification de l\'intégrité des données...');
        const dataMatch = retrievedUser && 
                         retrievedUser.email === testUserData.email &&
                         retrievedUser.name === testUserData.name &&
                         retrievedUser.plan === testUserData.plan;
        console.log(`   ${dataMatch ? '✅' : '❌'} Données intègres: ${dataMatch ? 'OUI' : 'NON'}`);
        
        // 5. Ajouter un rôle
        console.log('\n5️⃣  Ajout d\'un rôle...');
        const rolesAfterAdd = await userStorage.addRole(testUsername, 'admin');
        console.log(`   ✅ Rôle 'admin' ajouté`);
        console.log(`   🎭 Rôles actuels: ${Array.isArray(rolesAfterAdd) ? rolesAfterAdd.join(', ') : JSON.stringify(rolesAfterAdd)}`);
        
        // 6. Retirer un rôle
        console.log('\n6️⃣  Retrait d\'un rôle...');
        const rolesAfterRemove = await userStorage.removeRole(testUsername, 'admin');
        console.log(`   ✅ Rôle 'admin' retiré`);
        console.log(`   🎭 Rôles actuels: ${Array.isArray(rolesAfterRemove) ? rolesAfterRemove.join(', ') : JSON.stringify(rolesAfterRemove)}`);
        
        console.log('\n✅ Test des données utilisateur : RÉUSSI');
        return true;
        
    } catch (error) {
        console.error('\n❌ Erreur lors du test utilisateur:', error.message);
        console.error('Détails:', error);
        return false;
    }
}

async function testStorageConnection() {
    console.log('\n\n🔌 TEST 3 : Connexion au stockage Azure\n');
    
    const hasConnectionString = !!process.env.AZURE_STORAGE_CONNECTION_STRING;
    console.log(`   ${hasConnectionString ? '✅' : '⚠️ '} AZURE_STORAGE_CONNECTION_STRING: ${hasConnectionString ? 'CONFIGURÉE' : 'NON CONFIGURÉE'}`);
    
    if (!hasConnectionString) {
        console.log('\n   ⚠️  Le stockage fonctionne en mode MÉMOIRE VOLATILE');
        console.log('   📝 Les données seront perdues au redémarrage');
        console.log('\n   💡 Pour activer le stockage persistant:');
        console.log('   1. Ajoutez AZURE_STORAGE_CONNECTION_STRING dans Azure Portal');
        console.log('   2. Configuration → Variables d\'environnement');
    } else {
        console.log('\n   ✅ Stockage PERSISTANT activé');
        console.log('   💾 Les données survivront aux redémarrages');
    }
    
    return hasConnectionString;
}

// Exécution des tests
(async () => {
    try {
        console.log('\n🚀 Démarrage des tests...\n');
        
        // Test de connexion
        const hasStorage = await testStorageConnection();
        
        // Test 1: Codes de vérification
        const test1 = await testCodeStorage();
        
        // Test 2: Données utilisateur
        const test2 = await testUserStorage();
        
        // Résumé
        console.log('\n\n' + '='.repeat(60));
        console.log('📊 RÉSUMÉ DES TESTS\n');
        console.log(`   🔌 Stockage Azure: ${hasStorage ? '✅ ACTIVÉ' : '⚠️  MODE MÉMOIRE'}`);
        console.log(`   📧 Codes de vérification: ${test1 ? '✅ RÉUSSI' : '❌ ÉCHOUÉ'}`);
        console.log(`   👤 Données utilisateur: ${test2 ? '✅ RÉUSSI' : '❌ ÉCHOUÉ'}`);
        
        if (test1 && test2) {
            console.log('\n🎉 TOUS LES TESTS SONT RÉUSSIS !');
        } else {
            console.log('\n⚠️  Certains tests ont échoué');
        }
        
        console.log('='.repeat(60) + '\n');
        
    } catch (error) {
        console.error('\n❌ Erreur fatale:', error);
        process.exit(1);
    }
})();

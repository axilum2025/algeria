/**
 * Script de test pour Azure Communication Services Email
 * 
 * Usage:
 * AZURE_COMMUNICATION_CONNECTION_STRING="..." \
 * AZURE_COMMUNICATION_SENDER="..." \
 * node test_azure_email.js
 */

const { EmailClient } = require("@azure/communication-email");

async function testAzureEmail() {
    console.log('🧪 Test Azure Communication Services Email\n');
    
    // 1. Vérifier les variables d'environnement
    console.log('📋 Étape 1: Vérification des variables d\'environnement');
    const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
    const senderAddress = process.env.AZURE_COMMUNICATION_SENDER;
    
    if (!connectionString) {
        console.error('❌ AZURE_COMMUNICATION_CONNECTION_STRING non définie');
        console.log('\n💡 Exécutez:');
        console.log('export AZURE_COMMUNICATION_CONNECTION_STRING="endpoint=https://..."');
        process.exit(1);
    }
    
    if (!senderAddress) {
        console.error('❌ AZURE_COMMUNICATION_SENDER non définie');
        console.log('\n💡 Exécutez:');
        console.log('export AZURE_COMMUNICATION_SENDER="DoNotReply@xxx.azurecomm.net"');
        process.exit(1);
    }
    
    console.log('✅ AZURE_COMMUNICATION_CONNECTION_STRING:', connectionString.substring(0, 50) + '...');
    console.log('✅ AZURE_COMMUNICATION_SENDER:', senderAddress);
    
    // 2. Créer le client
    console.log('\n📋 Étape 2: Création du client Azure Communication');
    let client;
    try {
        client = new EmailClient(connectionString);
        console.log('✅ Client créé avec succès');
    } catch (error) {
        console.error('❌ Erreur création client:', error.message);
        process.exit(1);
    }
    
    // 3. Préparer le message de test
    console.log('\n📋 Étape 3: Préparation du message de test');
    
    // Demander l'email de test
    const testEmail = process.argv[2] || 'test@example.com';
    console.log('📧 Email destinataire:', testEmail);
    
    const emailMessage = {
        senderAddress: senderAddress,
        content: {
            subject: "Test Azure Communication Services - Axilum AI",
            plainText: "Ceci est un email de test pour vérifier la configuration Azure Communication Services.",
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #667eea; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0; }
                        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
                        .success { background: #10b981; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🧪 Test Azure Communication Services</h1>
                        </div>
                        <div class="content">
                            <div class="success">
                                <strong>✅ Configuration Réussie !</strong>
                            </div>
                            <p>Si vous recevez cet email, votre configuration Azure Communication Services fonctionne correctement.</p>
                            <p><strong>Détails de configuration :</strong></p>
                            <ul>
                                <li>Service: Azure Communication Services</li>
                                <li>Expéditeur: ${senderAddress}</li>
                                <li>Timestamp: ${new Date().toISOString()}</li>
                            </ul>
                            <p>Vous pouvez maintenant utiliser l'authentification par email dans votre application Axilum AI.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        },
        recipients: {
            to: [{ address: testEmail }]
        }
    };
    
    console.log('✅ Message préparé');
    
    // 4. Envoyer l'email
    console.log('\n📋 Étape 4: Envoi de l\'email');
    console.log('⏳ En cours...');
    
    try {
        const poller = await client.beginSend(emailMessage);
        console.log('✅ Opération d\'envoi initiée');
        console.log('⏳ Attente de confirmation...');
        
        const result = await poller.pollUntilDone();
        
        console.log('\n🎉 SUCCESS! Email envoyé avec succès!');
        console.log('\n📊 Résultat:');
        console.log(JSON.stringify(result, null, 2));
        
        console.log('\n✅ CONFIGURATION VALIDÉE');
        console.log('📧 Vérifiez votre boîte mail:', testEmail);
        console.log('💡 N\'oubliez pas de vérifier le dossier Spam/Promotions\n');
        
    } catch (error) {
        console.error('\n❌ ERREUR lors de l\'envoi:');
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        console.error('\nDétails complets:');
        console.error(error);
        
        console.log('\n🔍 DIAGNOSTIC:');
        
        if (error.message.includes('domain')) {
            console.log('❌ PROBLÈME DÉTECTÉ: Configuration du domaine email');
            console.log('\n📝 SOLUTION:');
            console.log('1. Allez sur Azure Portal: https://portal.azure.com');
            console.log('2. Ouvrez votre ressource Communication Services');
            console.log('3. Menu "Email" → "Domains"');
            console.log('4. Vérifiez que le domaine', senderAddress.split('@')[1], 'est bien listé');
            console.log('5. Si absent, cliquez "Add domain" → "Azure managed domain"');
            console.log('6. IMPORTANT: Cliquez sur "Connect" pour lier le domaine à la ressource');
            console.log('7. Attendez 5 minutes pour la propagation');
        } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
            console.log('❌ PROBLÈME: Connection string incorrecte ou expirée');
            console.log('\n📝 SOLUTION:');
            console.log('1. Allez sur Azure Portal');
            console.log('2. Communication Services → Keys');
            console.log('3. Copiez de nouveau la "Primary connection string"');
            console.log('4. Mettez à jour la variable d\'environnement');
        } else if (error.message.includes('sender')) {
            console.log('❌ PROBLÈME: Adresse expéditeur non autorisée');
            console.log('\n📝 SOLUTION:');
            console.log('1. Vérifiez que AZURE_COMMUNICATION_SENDER correspond exactement');
            console.log('2. Format: DoNotReply@xxxxxxxx.azurecomm.net');
        } else {
            console.log('❌ Erreur inconnue - Consultez les logs ci-dessus');
        }
        
        console.log('\n📚 Documentation: https://learn.microsoft.com/azure/communication-services/quickstarts/email/send-email\n');
        process.exit(1);
    }
}

// Lancer le test
console.log('═'.repeat(60));
console.log('  SCRIPT DE TEST - AZURE COMMUNICATION SERVICES EMAIL  ');
console.log('═'.repeat(60));
console.log();

if (process.argv.length < 3) {
    console.log('💡 Usage:');
    console.log('   node test_azure_email.js <votre-email@example.com>');
    console.log();
    console.log('💡 Avec variables d\'environnement:');
    console.log('   AZURE_COMMUNICATION_CONNECTION_STRING="..." \\');
    console.log('   AZURE_COMMUNICATION_SENDER="DoNotReply@xxx.azurecomm.net" \\');
    console.log('   node test_azure_email.js votre-email@example.com');
    console.log();
    process.exit(1);
}

testAzureEmail().catch(console.error);

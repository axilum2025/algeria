# 🚀 Guide de Déploiement Rapide - Azure Static Web Apps

## ⚡ Actions Immédiates pour Résoudre le Problème

### Étape 1 : Configurer la Clé API sur Azure (CRITIQUE)

1. **Allez sur le portail Azure** : https://portal.azure.com
2. **Trouvez votre Static Web App** dans vos ressources
3. **Cliquez sur "Configuration"** dans le menu de gauche
4. **Ajoutez ce paramètre** :
   ```
   Nom : AZURE_AI_API_KEY
   Valeur : [REDACTED_AZURE_AI_API_KEY]
   ```
5. **Cliquez sur "Enregistrer"**
6. **Attendez 2-3 minutes** pour que les changements se propagent

### Étape 2 : Déployer les Dernières Modifications

```bash
# Commiter et pousser les changements
git add .
git commit -m "Add improved logging and error handling for Azure deployment"
git push origin main
```

### Étape 3 : Vérifier le Déploiement

1. Allez dans l'onglet **"Actions"** de votre repo GitHub
2. Attendez que le workflow se termine (✅ vert)
3. Testez l'application sur l'URL Azure

### Étape 4 : Test de Production

```bash
# Remplacez <votre-app> par le nom de votre Static Web App
curl -X POST https://<votre-app>.azurestaticapps.net/api/agents/axilum/invoke \
  -H "Content-Type: application/json" \
  -d '{"message":"Test de production"}'
```

## 🔍 Diagnostic des Problèmes

### Si l'agent ne répond toujours pas :

#### 1. Vérifier les logs Azure
```bash
# Dans le portail Azure, allez sur votre Static Web App
# Cliquez sur "Log Stream" dans le menu de gauche
# Envoyez un message et observez les logs en temps réel
```

#### 2. Vérifier la configuration
- ✅ `AZURE_AI_API_KEY` est bien défini dans Configuration ?
- ✅ Le workflow GitHub Actions a réussi ?
- ✅ Le cache du navigateur est vidé ? (Ctrl+Shift+R)

#### 3. Tester l'API directement
Ouvrez les DevTools du navigateur (F12) et regardez :
- L'onglet **Network** pour voir les requêtes
- L'onglet **Console** pour voir les logs JavaScript

### Messages d'erreur courants

| Erreur | Solution |
|--------|----------|
| "API Key not configured" | Configurez `AZURE_AI_API_KEY` dans Azure |
| "Failed to fetch" | Vérifiez la connexion réseau et les CORS |
| "500 Internal Server Error" | Regardez les logs Azure pour plus de détails |
| "404 Not Found" | Vérifiez que l'API est bien déployée |

## 📊 Monitoring

### Voir les logs en temps réel
1. Portail Azure → Votre Static Web App
2. Menu gauche → **"Log Stream"**
3. Envoyez un message sur l'application
4. Observez les logs détaillés

### Métriques importantes
- Nombre de requêtes
- Temps de réponse
- Taux d'erreur
- Utilisation de l'API

## ✅ Checklist Finale

- [ ] `AZURE_AI_API_KEY` configuré dans Azure
- [ ] Code poussé sur GitHub
- [ ] Workflow GitHub Actions réussi
- [ ] Cache navigateur vidé
- [ ] Test de l'API réussi
- [ ] Application fonctionnelle en production

## 🆘 Support

Si le problème persiste après avoir suivi tous ces étapes :

1. **Vérifiez les logs** dans le portail Azure
2. **Testez l'API** avec curl ou Postman
3. **Vérifiez** que le modèle `gpt-5.1-chat` est bien déployé dans Azure AI Services
4. **Contactez** le support Azure si nécessaire

## 🔐 Sécurité

⚠️ **Important** : Ne committez JAMAIS `local.settings.json` dans Git. Ce fichier contient des clés sensibles et est déjà dans `.gitignore`.

Les clés API doivent être configurées uniquement :
- Dans Azure Portal → Configuration (pour la production)
- Dans `local.settings.json` (pour le développement local, jamais committé)

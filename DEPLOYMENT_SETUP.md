# 🚀 Guide de Configuration du Déploiement - Axilum

## ⚠️ ÉTAPE CRITIQUE : Configurer le Secret de Déploiement

Votre application ne se déploie pas car le secret GitHub `AZURE_STATIC_WEB_APPS_API_TOKEN` n'est pas configuré. Voici comment le faire :

### Étape 1 : Obtenir le Token depuis Azure Portal

1. Allez sur : https://portal.azure.com
2. Dans la barre de recherche, tapez **"Static Web Apps"** et appuyez sur Entrée
3. Cliquez sur votre application (devrait être nommée **"victorious-rock"** ou similaire)
4. Dans le menu de gauche, cliquez sur **"Manage deployment token"** (ou "Gérer le jeton de déploiement")
5. Un popup affichera votre token : **Copiez-le entièrement**

### Étape 2 : Ajouter le Secret dans GitHub

1. Allez sur : https://github.com/axilum2025/Axilum/settings/secrets/actions
2. Cliquez sur **"New repository secret"** (Nouveau secret de dépôt)
3. Remplissez :
   - **Name** : `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - **Secret** : Collez le token obtenu à l'étape 1
4. Cliquez sur **"Add secret"**

### Étape 3 (OPTIONNEL) : Configurer la Clé API Azure AI

Si vous voulez que `/api/invoke` fonctionne (agent IA conversationnel) :

1. Allez sur : https://portal.azure.com
2. Trouvez votre ressource **"Azure OpenAI"** ou **"Azure AI"**
3. Copiez la clé API
4. Dans votre Static Web App → Configuration, ajoutez :
   - **Nom** : `AZURE_AI_API_KEY`
   - **Valeur** : Votre clé API Azure
5. Cliquez sur "Enregistrer"

### Étape 4 : Déclencher le Déploiement

Une fois le secret ajouté, le prochain push déclenchera automatiquement le workflow. Ou vous pouvez forcer le redéploiement :

**Option A : Redéployer via GitHub Actions**
1. Allez sur : https://github.com/axilum2025/Axilum/actions
2. Cliquez sur le run le plus récent de "Azure Static Web Apps CI/CD"
3. Cliquez sur **"Re-run failed jobs"**

**Option B : Forcer un push**
```bash
git commit --allow-empty -m "chore: trigger redeployment"
git push origin main
```

## 🔍 Vérifier le Statut du Déploiement

1. Allez sur : https://github.com/axilum2025/Axilum/actions
2. Vous devriez voir un run "Azure Static Web Apps CI/CD"
3. Attendez qu'il se termine (quelques minutes)
4. Si ✅ **success** → Votre app est déployée !
5. Si ❌ **failure** → Consultez les logs (cliquez sur le run → "Build And Deploy")

## ✅ Comment Vérifier que l'App est Déployée

Une fois le déploiement réussi :

1. Allez sur : https://portal.azure.com
2. Cherchez **"Static Web Apps"**
3. Cliquez sur votre app "victorious-rock"
4. Vous devriez voir l'URL de votre app (ex: `https://victorious-rock-xxxx.azurestaticapps.net`)
5. Ouvrez cette URL dans votre navigateur

## ❓ Dépannage

| Problème | Solution |
|----------|----------|
| Secret non trouvé (erreur "Unauthorized") | Vérifiez que le secret `AZURE_STATIC_WEB_APPS_API_TOKEN` existe dans GitHub Secrets |
| Token expiré | Régénérez le token dans Azure Portal |
| App n'apparaît pas sur Azure | Vérifiez que la Static Web App existe déjà dans Azure Portal |
| `/api/invoke` retourne "API Key not configured" | Configurez `AZURE_AI_API_KEY` dans Configuration de la Static Web App |

## 📊 Structure du Projet Déployé

```
Axilum/
├── public/           ← Site statique (HTML, CSS, JS)
├── api/              ← Fonctions Azure (Node.js)
│   ├── invoke/       ← Agent IA conversationnel
│   ├── generateImage/← Génération d'images
│   ├── sendVerificationEmail/ ← Emails
│   └── ...
├── .github/workflows/← Workflows GitHub (déploiement automatique)
└── configs/          ← Configurations (staticwebapp.config.json, version.json)
```

## 🎯 Après le Déploiement

Une fois l'app déployée et l'`AZURE_AI_API_KEY` configurée :

1. Testez l'app via l'URL Azure
2. Envoyez un message à l'agent IA
3. L'agent devrait répondre après 3-5 secondes

**Succès !** 🎉

# Guide de Configuration et Déploiement - Axilum Web App

## 🎯 Problème Résolu

**Problème** : L'agent Azure ne répondait pas car il n'y avait pas de backend API pour communiquer avec l'agent Axilum.

**Solution** : Création d'une Azure Function qui sert de pont entre le frontend et votre agent Azure.

## 📋 Ce qui a été créé

### 1. Frontend (`index.html`)
- Interface de chat interactive améliorée
- Gestion d'erreurs détaillée
- Console logs pour debugging

### 2. Backend API (`api/invoke/index.js`)
- Azure Function qui communique avec l'agent Axilum
- Authentification via DefaultAzureCredential
- Route: `POST /api/agents/axilum/invoke`

### 3. Configuration
- `staticwebapp.config.json` - Configuration SWA avec runtime Node 18
- `api/package.json` - Dépendances Azure Functions
- `api/host.json` - Configuration Functions
- `.github/workflows/deploy.yml` - Déploiement automatique

## 🚀 Déploiement

### Étape 1 : Configurer le Secret GitHub

1. Allez sur : https://github.com/zgdsai-cyber/azuredev-8db7/settings/secrets/actions
2. Créez un nouveau secret :
   - **Nom** : `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - **Valeur** : Récupérez-la avec :
   ```bash
   az staticwebapp secrets list \
     --name axilum-webapp \
     --resource-group rg-SaidZeghidi-2025-1 \
     --query "properties.apiKey" -o tsv
   ```

### Étape 2 : Pousser le Code

```bash
cd /home/said/azuredev-8db7
git init
git add .
git commit -m "Add Axilum web app with Azure Functions API"
git branch -M main
git remote add origin https://github.com/zgdsai-cyber/azuredev-8db7.git
git push -u origin main
```

### Étape 3 : Configurer les Variables d'Environnement Azure

Une fois déployé, allez dans le portail Azure :

1. Ouvrez votre **Static Web App** : `axilum-webapp`
2. **Configuration** → **Application settings**
3. Ajoutez ces variables :

```
AZURE_EXISTING_AIPROJECT_ENDPOINT=https://saidzeghidi-2025-1-resource.services.ai.azure.com/api/projects/saidzeghidi-2025-1
AZURE_EXISTING_AGENT_ID=axilum:17
AZURE_SUBSCRIPTION_ID=dc3e9e9a-2018-4ceb-99a7-753813d7a74f
```

4. **Enregistrez** et attendez le redémarrage (~ 1 minute)

## 🧪 Test Local

### Démarrer l'API localement :

```bash
cd /home/said/azuredev-8db7/api
func start
```

L'API sera disponible sur : `http://localhost:7071/api/agents/axilum/invoke`

### Tester avec curl :

```bash
curl -X POST http://localhost:7071/api/agents/axilum/invoke \
  -H "Content-Type: application/json" \
  -d '{"message": "Bonjour Axilum!"}'
```

### Servir le frontend localement :

```bash
# Terminal 2
cd /home/said/azuredev-8db7
python3 -m http.server 8080
```

Visitez : `http://localhost:8080`

## 🔍 Vérification Post-Déploiement

1. **Vérifier le workflow GitHub Actions** :
   - https://github.com/zgdsai-cyber/azuredev-8db7/actions
   
2. **Tester l'API déployée** :
   ```bash
   curl -X POST https://proud-mushroom-019836d03.3.azurestaticapps.net/api/agents/axilum/invoke \
     -H "Content-Type: application/json" \
     -d '{"message": "Test"}'
   ```

3. **Visiter l'application** :
   - https://proud-mushroom-019836d03.3.azurestaticapps.net

## 🐛 Debugging

### Si l'agent ne répond toujours pas :

1. **Vérifier les logs Azure** :
   ```bash
   az monitor activity-log list \
     --resource-group rg-SaidZeghidi-2025-1 \
     --max-events 20
   ```

2. **Vérifier les logs de la fonction** (dans le portail Azure) :
   - Static Web App → Functions → invoke → Monitor

3. **Ouvrir la console du navigateur** (F12) :
   - Vérifiez les erreurs réseau
   - Regardez les logs de la requête API

### Erreurs communes :

- **403 Forbidden** → Variables d'environnement manquantes
- **500 Internal Server Error** → Problème d'authentification avec l'agent
- **404 Not Found** → API non déployée ou route incorrecte

## 📝 Architecture Finale

```
Utilisateur
    ↓
Frontend (index.html)
    ↓ HTTP POST /api/agents/axilum/invoke
Azure Static Web Apps
    ↓
Azure Functions (Node.js 18)
    ↓ DefaultAzureCredential
Agent Axilum (Azure AI)
    ↓
Réponse IA
```

## 🎉 Prochaines Étapes

1. ✅ Pousser le code sur GitHub
2. ✅ Configurer le secret GitHub
3. ✅ Attendre le déploiement automatique
4. ✅ Configurer les variables d'environnement Azure
5. ✅ Tester l'application web

---

**Besoin d'aide ?** Vérifiez les logs dans la console du navigateur (F12) et dans Azure Portal.

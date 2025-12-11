# ⚠️ PARAMÈTRES INTERDITS - Azure Static Web Apps

## 🚨 ATTENTION : NE JAMAIS UTILISER CES PARAMÈTRES

Azure Static Web Apps avec **fonctions gérées** interdit certains paramètres qui sont réservés aux Azure Functions **standalone**.

### ❌ PARAMÈTRES INTERDITS

**NE JAMAIS configurer ces paramètres dans Azure Portal** :

```
❌ AzureWebJobsStorage
❌ FUNCTIONS_WORKER_RUNTIME  
❌ FUNCTIONS_API_KEY
❌ FUNCTIONS_BASE_URL
❌ ACTIONS_BASE_URL
❌ WEBSITE_NODE_DEFAULT_VERSION
```

### ✅ PARAMÈTRES AUTORISÉS

Vous **POUVEZ** utiliser :

```
✅ AZURE_COMMUNICATION_CONNECTION_STRING
✅ AZURE_COMMUNICATION_SENDER
✅ AZURE_AI_API_KEY
✅ AZURE_STORAGE_CONNECTION_STRING
✅ APPINSIGHTS_INSTRUMENTATIONKEY
✅ Tout autre paramètre custom pour votre application
```

---

## 🔧 Configuration Correcte

### ✅ CE QU'IL FAUT FAIRE

1. **Azure Portal** → Static Web App → **Configuration**
2. Ajouter **uniquement** vos paramètres custom :
   ```
   AZURE_COMMUNICATION_CONNECTION_STRING = endpoint=https://...
   AZURE_COMMUNICATION_SENDER = DoNotReply@xxx.azurecomm.net
   ```

3. **Ne pas créer** de fichier `local.settings.json` dans le repo
4. **Ne pas configurer** les paramètres Azure Functions standard

### ❌ CE QU'IL NE FAUT PAS FAIRE

1. ❌ Ne **JAMAIS** créer `api/local.settings.json` et le committer
2. ❌ Ne **JAMAIS** ajouter `AzureWebJobsStorage` dans Azure Portal
3. ❌ Ne **JAMAIS** ajouter `FUNCTIONS_WORKER_RUNTIME` dans Azure Portal
4. ❌ Ne **JAMAIS** copier des exemples de configuration Azure Functions standalone

---

## 🤔 Pourquoi ?

### Azure Functions Standalone (❌ Pas votre cas)

```
Architecture : Application séparée
Déploiement : Indépendant  
Configuration : Manuelle (AzureWebJobsStorage, etc.)
Runtime : À spécifier (FUNCTIONS_WORKER_RUNTIME)
```

### Azure Static Web Apps - Fonctions Gérées (✅ Votre cas)

```
Architecture : Intégrée à la Static Web App
Déploiement : Automatique avec l'app
Configuration : Automatique (pas de paramètres manuels)
Runtime : Détecté automatiquement
```

**Les deux modes sont INCOMPATIBLES !**

---

## 🛠️ Configuration du Runtime

Au lieu de `FUNCTIONS_WORKER_RUNTIME`, utilisez `staticwebapp.config.json` :

```json
{
  "platform": {
    "apiRuntime": "node:20"
  }
}
```

✅ **C'est déjà configuré dans** : `/configs/staticwebapp.config.json`

---

## 📝 Développement Local

### ❌ NE PAS FAIRE

```bash
# ❌ Ne créez PAS de local.settings.json
cd api/api
cat > local.settings.json <<EOF
{
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node"
  }
}
EOF
```

### ✅ À FAIRE

Pour le développement local, utilisez des **variables d'environnement** :

```bash
# ✅ Définir les variables dans le terminal
export AZURE_COMMUNICATION_CONNECTION_STRING="..."
export AZURE_COMMUNICATION_SENDER="DoNotReply@xxx.azurecomm.net"

# Lancer l'app
npm start
```

Ou utilisez un fichier `.env` (qui est dans `.gitignore`) :

```bash
# Créer .env à la racine du projet
echo "AZURE_COMMUNICATION_CONNECTION_STRING=..." > .env
echo "AZURE_COMMUNICATION_SENDER=..." >> .env

# Charger automatiquement avec dotenv
npm install dotenv
```

---

## 🚨 Si Vous Avez Déjà Ajouté Ces Paramètres

### Solution : Supprimer via Azure Cloud Shell

```bash
# 1. Ouvrir Cloud Shell dans Azure Portal (>_)

# 2. Lister vos Static Web Apps
az staticwebapp list --query "[].{name:name, resourceGroup:resourceGroup}" -o table

# 3. Supprimer les paramètres interdits
az staticwebapp appsettings delete \
    --name VOTRE_APP_NAME \
    --resource-group VOTRE_RESOURCE_GROUP \
    --setting-names AzureWebJobsStorage FUNCTIONS_WORKER_RUNTIME FUNCTIONS_API_KEY FUNCTIONS_BASE_URL

# 4. Vérifier
az staticwebapp appsettings list \
    --name VOTRE_APP_NAME \
    --resource-group VOTRE_RESOURCE_GROUP \
    -o table
```

---

## 📚 Documentation

- ✅ [Guide de nettoyage complet](FORCE_CLEAN_SETTINGS_GUIDE.md)
- ✅ [Script automatique](../scripts/force-clean-settings.sh)
- 📖 [Documentation Microsoft](https://learn.microsoft.com/azure/static-web-apps/apis-functions)

---

## ✅ Checklist Avant Déploiement

- [ ] Aucun `local.settings.json` dans le repo Git
- [ ] Aucun paramètre interdit dans Azure Portal Configuration
- [ ] `staticwebapp.config.json` configuré correctement
- [ ] Variables custom ajoutées dans Azure Portal uniquement
- [ ] `.gitignore` contient `local.settings.json`

---

## 🎯 Résumé

| Action | Statut |
|--------|--------|
| Utiliser `local.settings.json` | ❌ **INTERDIT** |
| Configurer `AzureWebJobsStorage` | ❌ **INTERDIT** |
| Configurer `FUNCTIONS_WORKER_RUNTIME` | ❌ **INTERDIT** |
| Utiliser `staticwebapp.config.json` | ✅ **REQUIS** |
| Ajouter paramètres custom dans Azure Portal | ✅ **OK** |
| Utiliser variables d'environnement locales | ✅ **OK** |

---

**En cas de doute** : Ne configurez RIEN manuellement. Azure Static Web Apps gère tout automatiquement ! 🚀

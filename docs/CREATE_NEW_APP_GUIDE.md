# 🚀 Guide : Créer Manuellement une Nouvelle Static Web App

## Option A : Utiliser le Script Automatique (Recommandé)

Si vous avez accès à un ordinateur :

```bash
# 1. Se connecter à Azure
az login

# 2. Exécuter le script
./create-new-app.sh
```

Le script va automatiquement :
- ✅ Créer la nouvelle Static Web App
- ✅ Configurer toutes les variables d'environnement
- ✅ Générer le deployment token
- ✅ Créer le nouveau workflow GitHub

---

## Option B : Création Manuelle (Mobile/Portal)

### Étape 1 : Créer la Static Web App

1. **Allez sur** : https://portal.azure.com
2. **Cliquez** : "+ Create a resource" (Créer une ressource)
3. **Recherchez** : "Static Web App"
4. **Cliquez** : "Create"

### Étape 2 : Configuration de Base

**Onglet "Basics"** :
- **Subscription** : Votre abonnement Azure
- **Resource Group** : Créez `axilum-resources` (ou utilisez existant)
- **Name** : `axilum-ai-enhanced`
- **Plan type** : `Free` (pour commencer)
- **Region** : `West Europe`

**Onglet "Deployment"** :
- **Source** : `GitHub`
- **Organization** : `zgdsai-cyber`
- **Repository** : `azuredev-2641`
- **Branch** : `main`

**Build Details** :
- **Build Presets** : `Custom`
- **App location** : `/`
- **Api location** : `api`
- **Output location** : `` (vide)

### Étape 3 : Cliquez sur "Review + Create" puis "Create"

Azure va automatiquement :
- Créer la Static Web App
- Ajouter un workflow GitHub (`.github/workflows/azure-static-web-apps-*.yml`)
- Faire le premier déploiement

### Étape 4 : Configurer les Variables d'Environnement

Une fois l'app créée :

1. **Allez** : Votre nouvelle Static Web App dans le portal
2. **Menu gauche** → **"Configuration"**
3. **Onglet** : **"Application settings"**
4. **Ajoutez ces variables** (cliquez "+ Add") :

| Name | Value |
|------|-------|
| `AZURE_AI_API_KEY` | `[REDACTED_AZURE_AI_API_KEY]` |
| `AZURE_AI_ENDPOINT` | `https://models.inference.ai.azure.com` |
| `NODE_ENV` | `production` |

**Important** : N'ajoutez PAS :
- ❌ `AzureWebJobsStorage`
- ❌ `FUNCTIONS_WORKER_RUNTIME`
- ❌ `WEBSITE_NODE_DEFAULT_VERSION`

5. **Cliquez** : "Save"

### Étape 5 : Récupérer l'URL

1. Dans **"Overview"** de votre Static Web App
2. Copiez l'**URL** (quelque chose comme `https://nice-plant-xxx.azurestaticapps.net`)
3. Testez l'URL dans votre navigateur

---

## Option C : Via GitHub Marketplace (Plus Simple)

1. **Allez sur** : https://github.com/marketplace/azure-static-web-apps
2. **Cliquez** : "Set up a plan" → "Free"
3. **Sélectionnez** : votre repository `zgdsai-cyber/azuredev-2641`
4. **Suivez** : l'assistant de configuration
5. Azure va créer automatiquement tout

---

## 🔄 Après la Création

### Mettre à Jour l'Ancienne Application

Une fois que la nouvelle fonctionne :

1. **Désactivez** l'ancien workflow :
   ```bash
   git mv .github/workflows/deploy.yml .github/workflows/deploy.yml.old
   git commit -m "Disable old workflow"
   git push
   ```

2. **Optionnel** : Supprimez l'ancienne Static Web App sur le portal Azure

---

## 📊 Vérification

Après création, vérifiez :

```bash
# Tester la nouvelle URL
curl -s "https://VOTRE-NOUVELLE-URL/version.json"

# Devrait afficher la version actuelle
```

---

## 🆘 En Cas de Problème

### Si le workflow GitHub ne se lance pas :

1. Allez sur : https://github.com/zgdsai-cyber/azuredev-2641/actions
2. Cliquez sur le workflow qui vient d'être créé
3. Cliquez "Run workflow" manuellement

### Si les variables ne sont pas prises en compte :

1. Vérifiez qu'elles sont bien dans **Configuration** → **Application settings**
2. Redémarrez l'app : **Overview** → **Restart**

### Si l'API ne fonctionne pas :

Les variables sont automatiquement injectées dans les fonctions Azure.
Pas besoin de configuration supplémentaire.

---

## 📝 Checklist Complète

- [ ] Nouvelle Static Web App créée sur Azure
- [ ] Repository GitHub connecté
- [ ] Variables d'environnement ajoutées (sans les interdites)
- [ ] Premier déploiement réussi
- [ ] URL accessible et fonctionnelle
- [ ] API fonctionnelle (`/api/invoke` répond)
- [ ] Ancien workflow désactivé
- [ ] Tests de production effectués

---

**Date** : 9 décembre 2025  
**Durée estimée** : 10-15 minutes

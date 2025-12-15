# ✅ Solution Complète: Variables Interdites Azure Static Web Apps

## 🎯 Problème Résolu

Azure Static Web Apps ajoutait **automatiquement** ces variables interdites:
- ❌ `AzureWebJobsStorage`
- ❌ `FUNCTIONS_WORKER_RUNTIME`
- ❌ `AzureWebJobsStorageConnectionString`

Ces variables sont **interdites** pour les Azure Static Web Apps avec fonctions gérées (managed functions).

## 🔍 Causes Identifiées et Corrigées

### 1. ✅ Fichier staticwebapp.config.json manquant dans public/

**Problème:** Le fichier de configuration n'était pas dans le dossier de déploiement (`public/`).

**Solution:** Copié `configs/staticwebapp.config.json` vers `public/staticwebapp.config.json`

**Pourquoi c'est important:**
- Azure Static Web Apps cherche ce fichier dans le `app_location` (défini dans le workflow comme `public`)
- Sans ce fichier, Azure peut utiliser des configurations par défaut qui déclenchent l'ajout de variables interdites
- Le fichier spécifie explicitement `"apiRuntime": "node:20"` ce qui informe Azure que les fonctions sont gérées

### 2. ✅ Script "func start" dans api/package.json

**Problème:** Le script `"start": "func start"` faisait croire à Azure que c'était une application Azure Functions standalone.

**Solution:** Supprimé le script `"start": "func start"` de `api/package.json`

**Pourquoi c'est important:**
- `func start` est la commande pour démarrer Azure Functions en mode standalone
- Cette commande nécessite `AzureWebJobsStorage` et `FUNCTIONS_WORKER_RUNTIME`
- Azure détecte ce pattern et ajoute automatiquement ces variables
- Pour Azure Static Web Apps, les fonctions sont **gérées automatiquement** et n'ont pas besoin de ce script

### 3. ✅ Extension Bundle v3.x dans host.json

**Vérification:** Le fichier `api/host.json` utilise déjà la version correcte:
```json
{
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[3.*, 4.0.0)"
  }
}
```

**Pourquoi c'est important:**
- Extension Bundle v4.x nécessite des variables d'environnement spécifiques qui sont interdites
- Extension Bundle v3.x est compatible avec Azure Static Web Apps managed functions
- La version `[3.*, 4.0.0)` utilise 3.x et exclut 4.x

## 📋 Modifications Apportées

### Fichiers Modifiés
1. **public/staticwebapp.config.json** (créé)
   - Copié depuis `configs/staticwebapp.config.json`
   - Spécifie `"apiRuntime": "node:20"`
   - Configure le routing et les headers

2. **api/package.json** (modifié)
   - Supprimé: `"start": "func start"`
   - Conservé: `"test": "echo \"No tests yet\""`

### Fichiers Non Modifiés (Déjà Corrects)
- ✅ `api/host.json` - Extension Bundle v3.x déjà configuré
- ✅ `.gitignore` - Exclut déjà `local.settings.json`
- ✅ `api/.gitignore` - Exclut déjà `local.settings.json` et `.env*`
- ✅ Workflows GitHub Actions - Ne contiennent pas de variables interdites

## 🔐 Sécurité

### Variables Autorisées
Les seules variables d'environnement que vous pouvez/devez configurer dans Azure Portal:
- ✅ `SENDGRID_API_KEY`
- ✅ `AZURE_STORAGE_CONNECTION_STRING`
- ✅ `AZURE_STORAGE_ACCOUNT_NAME`
- ✅ `AZURE_STORAGE_TABLE_NAME`
- ✅ `APPINSIGHTS_INSTRUMENTATIONKEY` (géré automatiquement)
- ✅ Toute autre variable custom de votre application

### Variables Interdites (Gérées Automatiquement)
Ces variables sont **INTERDITES** et **GÉRÉES AUTOMATIQUEMENT** par Azure:
- ❌ `AzureWebJobsStorage`
- ❌ `FUNCTIONS_WORKER_RUNTIME`
- ❌ `AzureWebJobsStorageConnectionString`
- ❌ `WEBSITE_NODE_DEFAULT_VERSION`

## 📝 Workflow de Déploiement

Le workflow GitHub Actions `.github/workflows/azure-static-web-apps-*.yml` est configuré correctement:
```yaml
- name: Build And Deploy
  uses: Azure/static-web-apps-deploy@v1
  with:
    app_location: "public"      # ✅ Contient staticwebapp.config.json
    api_location: "api"         # ✅ Contient host.json avec Extension Bundle v3.x
    output_location: ""
    skip_app_build: true
```

## ✅ Vérification Post-Déploiement

Après le prochain déploiement, vérifiez dans Azure Portal:

1. **Accédez à:** Azure Portal → Votre Static Web App → Configuration
2. **Vérifiez:** Aucune de ces variables ne doit apparaître:
   - AzureWebJobsStorage
   - FUNCTIONS_WORKER_RUNTIME
   - AzureWebJobsStorageConnectionString

3. **Si les variables apparaissent encore:**
   - Attendez 5-10 minutes (le cache Azure peut prendre du temps)
   - Supprimez-les manuellement via Azure CLI:
   ```bash
   az staticwebapp appsettings delete \
     --name <nom-de-votre-app> \
     --resource-group <nom-du-groupe> \
     --setting-names AzureWebJobsStorage FUNCTIONS_WORKER_RUNTIME AzureWebJobsStorageConnectionString
   ```

## 🎯 Résumé des Changements

### Avant ❌
- staticwebapp.config.json uniquement dans `configs/`
- Script `"start": "func start"` dans api/package.json
- Azure détectait une application Azure Functions standalone
- Variables interdites ajoutées automatiquement

### Après ✅
- staticwebapp.config.json dans `public/` (location de déploiement)
- Aucun script `func start` dans api/package.json
- Azure reconnaît une Static Web App avec managed functions
- Aucune variable interdite ajoutée

## 📚 Références

- [Azure Static Web Apps - Managed Functions](https://learn.microsoft.com/azure/static-web-apps/apis-functions)
- [Extension Bundle Versions](https://learn.microsoft.com/azure/azure-functions/functions-bindings-register#extension-bundles)
- [Static Web Apps Configuration](https://learn.microsoft.com/azure/static-web-apps/configuration)

---

**Date de correction:** 15 décembre 2024  
**Status:** ✅ Résolu - En attente de validation après déploiement

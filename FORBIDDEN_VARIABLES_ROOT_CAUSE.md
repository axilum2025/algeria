# 🔍 CAUSE RACINE : Variables Interdites Automatiques

## ❌ PROBLÈME IDENTIFIÉ

Azure Static Web Apps ajoute **AUTOMATIQUEMENT** les variables interdites à cause de certaines configurations dans votre code.

### 📊 Historique des Variables Ajoutées Automatiquement

```
14/12/2025 21:18:24 → AzureWebJobsStorage
14/12/2025 15:29:28 → AzureWebJobsStorage, FUNCTIONS_WORKER_RUNTIME  
14/12/2025 21:54:51 → FUNCTIONS_WORKER_RUNTIME
14/12/2025 21:19:11 → AzureWebJobsStorageConnectionString
```

## 🎯 CAUSES IDENTIFIÉES

### 1. ⚠️ Extension Bundle v4.x dans host.json (PRINCIPAL)

**Fichier problématique :** `api/host.json`

```json
❌ AVANT (Cause le problème)
{
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"  ← Version 4.x déclenche l'ajout auto
  }
}

✅ APRÈS (Corrigé)
{
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[3.*, 4.0.0)"  ← Version 3.x compatible Static Web Apps
  },
  "functionTimeout": "00:05:00",
  "retry": {
    "strategy": "fixedDelay",
    "maxRetryCount": 2,
    "delayInterval": "00:00:03"
  }
}
```

**Pourquoi ?**
- Extension Bundle v4.x nécessite `FUNCTIONS_WORKER_RUNTIME` et `AzureWebJobsStorage`
- Azure Static Web Apps détecte cette configuration et ajoute automatiquement ces variables
- Static Web Apps utilise des fonctions **gérées** (managed) qui n'ont pas besoin de ces variables

### 2. 🔍 Autres Causes Potentielles

#### A. Scripts npm problématiques
```json
// ❌ ÉVITER dans api/package.json
{
  "scripts": {
    "start": "func start"  ← Peut déclencher détection Azure Functions
  }
}

// ✅ MIEUX
{
  "scripts": {
    "start": "echo 'Managed by Azure Static Web Apps'"
  }
}
```

#### B. Configuration locale exportée
- Fichier `local.settings.json` ne doit **JAMAIS** être commité
- Vérifier `.gitignore` contient `local.settings.json`

#### C. Workflow GitHub Actions
- Certaines actions peuvent ajouter automatiquement des variables
- Vérifier le workflow ne contient pas d'étapes ajoutant ces variables

## ✅ SOLUTION COMPLÈTE

### Étape 1 : Nettoyer host.json (✓ FAIT)
```bash
# Déjà corrigé dans ce commit
# Extension Bundle downgrade 4.x → 3.x
```

### Étape 2 : Vérifier .gitignore
```bash
cat api/.gitignore
# Doit contenir :
# local.settings.json
# .env
```

### Étape 3 : Nettoyer les variables existantes
```bash
# Supprimer toutes les variables interdites
./scripts/clean-forbidden-settings.sh
```

### Étape 4 : Vérifier après déploiement
```bash
# Attendre 5 minutes après le déploiement
# Vérifier dans Azure Portal → Static Web App → Configuration
# Aucune de ces variables ne doit apparaître :
# - AzureWebJobsStorage
# - FUNCTIONS_WORKER_RUNTIME
# - AzureWebJobsStorageConnectionString
# - WEBSITE_NODE_DEFAULT_VERSION
```

## 🔬 DIAGNOSTIC

### Comment vérifier si le problème persiste ?

```bash
# 1. Lister les variables actuelles
az staticwebapp appsettings list \
  --name Axilum2030-v2 \
  --resource-group Axilum2030_group \
  --query "properties" -o json

# 2. Vérifier la console Azure
# Portal → Static Web App → Diagnostics → Application Settings Issues
```

### Signes que le problème est résolu
- ✅ Aucune alerte dans "Paramètres de l'application interdits"
- ✅ Déploiement GitHub Actions réussit sans erreur
- ✅ API fonctionne correctement
- ✅ Aucune variable `AzureWebJobs*` ou `FUNCTIONS_*` visible

## 📚 RÉFÉRENCES

### Extension Bundle Versions
- **v3.x** → Compatible Azure Static Web Apps (✓ Recommandé)
- **v4.x** → Nécessite variables interdites (❌ Éviter)

### Documentation
- [Azure Static Web Apps Managed Functions](https://learn.microsoft.com/azure/static-web-apps/apis-functions)
- [Extension Bundle Versions](https://learn.microsoft.com/azure/azure-functions/functions-bindings-register#extension-bundles)

## 🎯 PROCHAINES ÉTAPES

1. **Commit et push** la correction du host.json
2. **Nettoyer** les variables interdites avec le script
3. **Redéployer** l'application
4. **Vérifier** après 5 minutes qu'aucune variable interdite n'apparaît
5. **Tester** que l'API fonctionne

---

**Note importante :** Ce problème est **spécifique à Azure Static Web Apps**. Les Azure Functions standalone nécessitent ces variables, mais Static Web Apps les gère automatiquement et les interdit explicitement.

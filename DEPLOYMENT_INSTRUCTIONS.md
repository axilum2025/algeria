# Instructions de déploiement Azure Static Web App

## ✅ Configuration effectuée

1. **Azure Static Web App créée** : `Axilum2030`
   - URL : https://delightful-rock-0b18acd1e.3.azurestaticapps.net
   - Groupe de ressources : `Axilum2030_group`
   - Région : West US 2
   - Plan : Free

2. **Workflow GitHub Actions mis à jour** : `.github/workflows/azure-static-web-apps-nice-river-096898203.yml`
   - Configuré pour déployer depuis `public/` (app)
   - Configuré pour déployer depuis `api/` (functions)
   - Déclenchement automatique sur push vers `main`

## 🔐 Configuration du secret GitHub (À FAIRE MANUELLEMENT)

Le token de déploiement Azure doit être ajouté aux secrets GitHub :

### Option 1 : Via l'interface GitHub (RECOMMANDÉ)

1. Allez sur : https://github.com/axilum2025/Axilum2030/settings/secrets/actions
2. Cliquez sur "New repository secret"
3. Nom du secret : `AZURE_STATIC_WEB_APPS_API_TOKEN_AXILUM2030`
4. Valeur du secret (copiez exactement) :
   ```
   6adced867f65ebc8d61e73cc272c42cf1eee86a7469bb64b87cf63f99fd6a5e103-2863ce45-84b0-4339-acb6-1019753b867d01e18180b18acd1e
   ```
5. Cliquez sur "Add secret"

### Option 2 : Via GitHub CLI (nécessite un token avec les bonnes permissions)

Si votre token GitHub a les permissions `repo` et `admin:repo_hook`, utilisez :

```bash
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN_AXILUM2030 \
  --body "6adced867f65ebc8d61e73cc272c42cf1eee86a7469bb64b87cf63f99fd6a5e103-2863ce45-84b0-4339-acb6-1019753b867d01e18180b18acd1e" \
  --repo axilum2025/Axilum2030
```

## 🚀 Déploiement

Une fois le secret configuré :

1. **Commit et push des changements** :
   ```bash
   git add .github/workflows/azure-static-web-apps-nice-river-096898203.yml
   git commit -m "Update Azure Static Web App deployment configuration"
   git push origin main
   ```

2. **Le déploiement s'effectue automatiquement** via GitHub Actions

3. **Vérifier le déploiement** :
   - Allez sur : https://github.com/axilum2025/Axilum2030/actions
   - Suivez l'exécution du workflow "Azure Static Web Apps CI/CD"
   - Une fois terminé, votre application sera accessible sur : https://delightful-rock-0b18acd1e.3.azurestaticapps.net

## 📋 Informations importantes

### Configuration de l'application
- **Dossier application** : `public/`
- **Dossier API** : `api/`
- **Runtime API** : Node.js 20
- **Pas de build** : Skip app build activé

### Fichiers de configuration
- **Workflow** : `.github/workflows/azure-static-web-apps-nice-river-096898203.yml`
- **Config Azure** : `configs/staticwebapp.config.json`

### Commandes utiles Azure CLI

**Afficher les informations de l'app** :
```bash
az staticwebapp show --name Axilum2030 --resource-group Axilum2030_group
```

**Récupérer le token de déploiement** :
```bash
az staticwebapp secrets list --name Axilum2030 --resource-group Axilum2030_group
```

**Lister les environnements** :
```bash
az staticwebapp environment list --name Axilum2030 --resource-group Axilum2030_group
```

**Voir les logs** :
```bash
az staticwebapp logs show --name Axilum2030 --resource-group Axilum2030_group
```

## 🔄 Prochaines étapes

1. ✅ Ajouter le secret GitHub (voir section ci-dessus)
2. ✅ Commit et push les changements
3. ✅ Vérifier le déploiement sur GitHub Actions
4. ✅ Tester l'application sur : https://delightful-rock-0b18acd1e.3.azurestaticapps.net
5. 🔜 Configurer un domaine personnalisé (optionnel)
6. 🔜 Configurer les variables d'environnement dans Azure (si nécessaire)

## ⚙️ Configuration des variables d'environnement (si nécessaire)

Pour ajouter des variables d'environnement à votre Static Web App :

```bash
az staticwebapp appsettings set \
  --name Axilum2030 \
  --resource-group Axilum2030_group \
  --setting-names KEY1=value1 KEY2=value2
```

## 🌐 Domaine personnalisé (optionnel)

Pour ajouter un domaine personnalisé :

```bash
az staticwebapp hostname set \
  --name Axilum2030 \
  --resource-group Axilum2030_group \
  --hostname your-domain.com
```

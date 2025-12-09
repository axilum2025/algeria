# 🚨 Guide de Résolution - Déploiement Bloqué sur Azure

## 📋 Problème Identifié

Votre application Azure Static Web App **`proud-mushroom-019836d03`** est **bloquée** et ne déploie plus les nouvelles versions à cause de **paramètres d'application interdits**.

### État Actuel
- ✅ GitHub Actions : Upload **v1.4-DEPLOY-TEST** (178KB)
- ❌ Azure affiche : Ancienne **v1.2** (165KB)
- 🔴 **Cause** : Paramètres interdits empêchent le déploiement

## 🎯 Solution en 3 Étapes

### Étape 1️⃣ : Supprimer les Paramètres Interdits (CRITIQUE)

1. **Ouvrir Azure Portal**
   - Allez sur : https://portal.azure.com
   - Connectez-vous avec votre compte Azure

2. **Trouver votre Static Web App**
   - Dans la barre de recherche en haut, tapez : `proud-mushroom-019836d03`
   - Cliquez sur votre application dans les résultats

3. **Accéder à Configuration**
   - Dans le menu de gauche, cherchez **"Configuration"** ou **"Settings"**
   - Cliquez dessus

4. **Onglet Application Settings**
   - Vous devriez voir un onglet **"Application settings"**
   - Cliquez dessus

5. **SUPPRIMER ces paramètres** (s'ils existent)
   - ❌ `AzureWebJobsStorage`
   - ❌ `FUNCTIONS_WORKER_RUNTIME`
   - ❌ `WEBSITE_NODE_DEFAULT_VERSION`
   
   **Comment supprimer :**
   - Pour chaque paramètre, cliquez sur le bouton **"..."** ou **"Delete"** à droite
   - Confirmez la suppression

6. **Sauvegarder**
   - Cliquez sur **"Save"** ou **"Enregistrer"** en haut de la page
   - Attendez la confirmation

### Étape 2️⃣ : Forcer un Nouveau Déploiement

Retournez dans votre terminal et exécutez :

```bash
cd /workspaces/azuredev-2641
git commit --allow-empty -m "Redeploy: Fixed Azure forbidden settings"
git push origin main
```

Attendez **2-3 minutes** que GitHub Actions termine le déploiement.

### Étape 3️⃣ : Vérifier que Ça Fonctionne

```bash
# Vérifier la version déployée
curl -s "https://proud-mushroom-019836d03.3.azurestaticapps.net/version.json"

# Devrait afficher quelque chose comme :
# {"version":"1.5.0","deployed":"2025-12-09T...","commit":"..."}
```

Ou ouvrez simplement dans votre navigateur :
**https://proud-mushroom-019836d03.3.azurestaticapps.net**

---

## 🔧 Alternative : Utiliser le Script Automatique

Si vous avez **Azure CLI** configuré, vous pouvez utiliser le script automatique :

```bash
# 1. Se connecter à Azure (si pas déjà fait)
az login

# 2. Exécuter le script de correction
./fix-azure-settings.sh

# 3. Suivre les instructions affichées
```

Le script va :
- ✅ Trouver automatiquement le resource group
- ✅ Lister les paramètres actuels
- ✅ Supprimer les paramètres interdits
- ✅ Afficher les nouveaux paramètres

---

## ❓ Pourquoi Ce Problème ?

Azure Static Web Apps avec **fonctions gérées** (managed functions) n'autorise **PAS** ces paramètres :
- `AzureWebJobsStorage` : Réservé aux Azure Functions autonomes
- `FUNCTIONS_WORKER_RUNTIME` : Géré automatiquement par Static Web Apps
- `WEBSITE_NODE_DEFAULT_VERSION` : Configuration obsolète

Ces paramètres ont été ajoutés automatiquement par Azure mais **bloquent maintenant** les déploiements.

---

## 📊 Diagnostic Complet

### Ce Qui Fonctionne ✅
- GitHub Actions déploie correctement (voir les logs)
- Les fichiers sont uploadés (v1.4, 178KB)
- Le workflow est correct

### Ce Qui Ne Fonctionne Pas ❌
- Azure refuse de mettre à jour les fichiers
- L'application affiche toujours v1.2 (165KB)
- Les nouveaux changements ne sont pas visibles

### La Cause 🔍
```
Azure Diagnostic:
"Les paramètres d'application avec des noms 
'AzureWebJobsStorage, FUNCTIONS_WORKER_RUNTIME' 
ne sont pas autorisés."

Date: 08/12/2025
```

---

## 🎉 Après la Correction

Une fois les paramètres supprimés et l'application redéployée, vous verrez :

- ✅ **Nouvelle version v1.4** dans le titre de la page
- ✅ **Sections "Fonctions" et "Outils"** après "Stack Technique"
- ✅ **Descriptions en paragraphes** (Plan Pro puis Plan Free)
- ✅ **Plus de badges colorés** dans la section À propos
- ✅ **version.json** accessible

---

## 📞 Besoin d'Aide ?

Si après avoir suivi ces étapes le problème persiste :

1. Vérifiez dans Azure Portal → Static Web App → **"Deployments"**
   - Cherchez les erreurs dans les logs

2. Vérifiez dans GitHub → Onglet **"Actions"**
   - Assurez-vous que le dernier workflow est ✅ vert

3. Attendez 5-10 minutes après le déploiement
   - Azure CDN peut mettre du temps à se rafraîchir

4. Testez avec un paramètre de cache-busting :
   ```
   https://proud-mushroom-019836d03.3.azurestaticapps.net/?nocache=true
   ```

---

## 📝 Checklist

- [ ] Paramètres interdits supprimés dans Azure Portal
- [ ] Configuration sauvegardée sur Azure
- [ ] Nouveau commit/push effectué
- [ ] GitHub Actions terminé avec succès (✅)
- [ ] Attendu 2-3 minutes
- [ ] Vérifié version.json
- [ ] Application affiche v1.4
- [ ] Nouvelles sections visibles dans "À propos"

---

**Date de création** : 9 décembre 2025  
**Dernière mise à jour** : 9 décembre 2025 11:30 UTC

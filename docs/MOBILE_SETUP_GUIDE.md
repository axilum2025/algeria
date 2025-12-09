# 📱 Guide Mobile - Créer Nouvelle Static Web App

## 🎯 Méthode Recommandée : GitHub Marketplace

Cette méthode fonctionne parfaitement sur mobile et configure tout automatiquement !

---

## 📋 Étapes à Suivre (5-7 minutes)

### Étape 1 : Ouvrir GitHub Marketplace

**Lien direct :** https://github.com/marketplace/azure-static-web-apps

- Ouvrez ce lien dans votre navigateur mobile (Chrome, Safari, etc.)
- Connectez-vous à GitHub si demandé

### Étape 2 : Installer l'App

1. **Bouton vert** : Cliquez sur **"Set up a plan"**
2. **Plan gratuit** : Sélectionnez **"Free"** (0$/mois)
3. **Install it for free** : Cliquez pour continuer

### Étape 3 : Autoriser l'Accès

1. **Select repositories** : Choisissez **"Only select repositories"**
2. **Dropdown** : Sélectionnez `zgdsai-cyber/azuredev-2641`
3. **Install & Authorize** : Cliquez pour confirmer

### Étape 4 : Configuration Azure (Automatique)

Azure va vous rediriger et :
- Créer automatiquement la Static Web App
- Générer un workflow dans `.github/workflows/`
- Lancer le premier déploiement

**Vous serez redirigé vers le portail Azure**

### Étape 5 : Récupérer l'URL

Une fois sur le portail Azure :

1. **Trouvez** votre nouvelle Static Web App (nom généré automatiquement)
2. **Section "Overview"** : Copiez l'**URL** 
   - Format : `https://nice-xxxxx-123.azurestaticapps.net`
3. **Testez** l'URL dans votre navigateur

---

## ⚙️ Configuration des Variables (Important)

Maintenant que l'app est créée, ajoutez les variables d'environnement :

### Sur Mobile (Portal Azure)

1. **Restez** sur votre Static Web App dans le portail
2. **Scrollez** dans le menu de gauche
3. **Cherchez** : **"Configuration"** ou **"Settings"**
4. **Tapez** sur **"Configuration"**
5. **Onglet** : **"Application settings"**
6. **Bouton** : **"+ Add"** (ou "+")

### Variables à Ajouter (une par une)

**Variable 1 :**
- Name : `AZURE_AI_API_KEY`
- Value : `[REDACTED_AZURE_AI_API_KEY]`

**Variable 2 :**
- Name : `AZURE_AI_ENDPOINT`
- Value : `https://models.inference.ai.azure.com`

**Variable 3 :**
- Name : `NODE_ENV`
- Value : `production`

**Important** : Cliquez **"Save"** en haut après chaque ajout !

---

## 🔄 Redéploiement Automatique

Après avoir ajouté les variables :

1. **Retournez** dans votre codespace ici
2. **Exécutez** :
   ```bash
   git commit --allow-empty -m "Trigger redeploy with new settings"
   git push origin main
   ```

3. **GitHub Actions** va automatiquement déployer vers la nouvelle app

---

## ✅ Vérification

Après 2-3 minutes, testez :

### Depuis le Terminal
```bash
# Remplacez par votre nouvelle URL
curl -s "https://VOTRE-NOUVELLE-URL/version.json"
```

### Depuis le Navigateur
Ouvrez votre nouvelle URL et vérifiez :
- ✅ La page s'affiche
- ✅ Le chat fonctionne
- ✅ Les nouvelles sections "Fonctions" et "Outils" sont présentes

---

## 📊 Comparaison Avant/Après

| Élément | Ancienne App | Nouvelle App |
|---------|-------------|--------------|
| Déploiement | ❌ Bloqué | ✅ Fonctionne |
| Version | v1.2 (165KB) | ✅ v1.4 (178KB) |
| Nouvelles sections | ❌ Absentes | ✅ Présentes |
| Paramètres interdits | ❌ 3 présents | ✅ 0 |
| Mises à jour | ❌ Bloquées | ✅ Immédiates |

---

## 🆘 En Cas de Problème

### Problème : "Repository not found"
- Vérifiez que vous êtes connecté au bon compte GitHub
- Réessayez l'installation

### Problème : "Authorization failed"
- Déconnectez-vous d'Azure et reconnectez-vous
- Vérifiez vos permissions sur le compte Azure

### Problème : Variables non appliquées
- Attendez 2-3 minutes après les avoir ajoutées
- Redémarrez l'app : Overview → Restart

### Problème : Workflow ne se lance pas
- Allez sur GitHub Actions
- Cliquez "Run workflow" manuellement

---

## 💡 Astuce Mobile

Si le portail Azure est difficile à naviguer sur mobile :

1. **Mode Desktop** : Dans votre navigateur, demandez "Version ordinateur"
2. **Zoomer** : Zoomez sur les boutons pour mieux cliquer
3. **Rotation** : Passez en mode paysage pour plus d'espace

---

## 📝 Checklist Complète

- [ ] GitHub Marketplace : App installée
- [ ] Repository sélectionné : azuredev-2641
- [ ] Azure : Static Web App créée
- [ ] URL récupérée et testée
- [ ] Variables ajoutées (3 au total)
- [ ] Configuration sauvegardée
- [ ] Commit/push effectué
- [ ] Nouveau déploiement terminé
- [ ] Application testée et fonctionnelle

---

## 🎉 Félicitations !

Une fois terminé, vous aurez :
- ✅ Une nouvelle Static Web App propre
- ✅ Tous les déploiements qui fonctionnent
- ✅ Vos dernières modifications enfin visibles
- ✅ Plus de problèmes de paramètres interdits

**Temps total estimé** : 10 minutes

---

**Besoin d'aide ?** Revenez ici après chaque étape et je vous guiderai !

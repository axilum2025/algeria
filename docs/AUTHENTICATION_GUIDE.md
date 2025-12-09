# 🔐 Guide d'Authentification - Axilum AI

## ✅ Système Implémenté

Le système d'authentification complet est maintenant actif avec :

### 📋 Fonctionnalités

1. **👤 Bouton "Mon Compte"** dans la sidebar
   - Visible pour tous les utilisateurs
   - Change dynamiquement selon l'état de connexion

2. **📝 Modal Sign Up (Inscription)**
   - Champs : Nom complet, Email, Mot de passe, Confirmation
   - Validation des mots de passe
   - Vérification email unique
   - Connexion automatique après inscription

3. **🔐 Modal Sign In (Connexion)**
   - Champs : Email, Mot de passe
   - Option "Se souvenir de moi"
   - Lien "Mot de passe oublié" (à venir)
   - Validation des credentials

4. **👋 Menu Utilisateur**
   - Affiche le nom de l'utilisateur connecté
   - Option de déconnexion avec confirmation
   - Retour à l'état non-connecté proprement

5. **💾 Gestion des Conversations**
   - Conversations liées à userId
   - Filtrage automatique par utilisateur
   - Isolation complète des données entre utilisateurs
   - Synchronisation avec localStorage

---

## 🎯 Comment Tester

### Test 1 : Inscription d'un Nouveau Compte

1. Ouvrez https://proud-mushroom-019836d03.3.azurestaticapps.net
2. Cliquez sur **"Mon Compte"** dans le menu sidebar (en bas)
3. La modal "Se connecter" s'ouvre
4. Cliquez sur **"Créer un compte"** en bas
5. Remplissez le formulaire :
   - Nom : `Test User`
   - Email : `test@example.com`
   - Mot de passe : `test123`
   - Confirmation : `test123`
6. Cliquez sur **"Créer mon compte"**

**Résultat attendu :**
```
✅ Toast : "Bienvenue Test User !"
✅ Modal se ferme
✅ Bouton "Mon Compte" affiche maintenant "Test User"
✅ Une nouvelle conversation vierge est créée
```

---

### Test 2 : Connexion avec un Compte Existant

1. Si connecté, déconnectez-vous d'abord
2. Cliquez sur **"Mon Compte"**
3. Entrez vos identifiants :
   - Email : `test@example.com`
   - Mot de passe : `test123`
4. (Optionnel) Cochez "Se souvenir de moi"
5. Cliquez sur **"Se connecter"**

**Résultat attendu :**
```
✅ Toast : "Bienvenue Test User !"
✅ Bouton affiche le nom de l'utilisateur
✅ Seules VOS conversations apparaissent
✅ Les conversations d'autres users sont invisibles
```

---

### Test 3 : Isolation des Conversations

1. Connectez-vous avec le compte 1 (ex: `user1@test.com`)
2. Créez 2-3 conversations avec des messages
3. Déconnectez-vous
4. Créez un nouveau compte (ex: `user2@test.com`)
5. Vérifiez la liste des conversations

**Résultat attendu :**
```
✅ Aucune conversation de user1 visible
✅ Liste vierge pour user2
✅ Créez conversations pour user2
✅ Reconnectez-vous en user1 → ses conversations sont toujours là
```

---

### Test 4 : Déconnexion

1. Connecté en tant qu'utilisateur
2. Cliquez sur votre nom dans le menu sidebar
3. Une confirmation apparaît : "Voulez-vous vous déconnecter ?"
4. Confirmez

**Résultat attendu :**
```
✅ Toast : "👋 À bientôt !"
✅ Page se recharge
✅ Bouton redevient "Mon Compte"
✅ Conversations anciennes (sans userId) visibles si existantes
```

---

### Test 5 : Persistance des Données

1. Connectez-vous
2. Créez quelques conversations
3. **Fermez complètement le navigateur**
4. Rouvrez et allez sur le site
5. Cliquez sur "Mon Compte"

**Résultat attendu :**
```
✅ Si "Se souvenir" coché : Toujours connecté
✅ Sinon : Demande de reconnexion
✅ Après connexion : Toutes vos conversations sont là
```

---

### Test 6 : Validation des Erreurs

**Test 6.1 : Mots de passe différents**
1. Inscription → Mot de passe : `test123`, Confirmation : `test456`
2. Cliquez "Créer mon compte"
3. **Attendu :** `❌ Les mots de passe ne correspondent pas`

**Test 6.2 : Email déjà utilisé**
1. Inscrivez `user@test.com`
2. Déconnectez-vous
3. Essayez de créer un compte avec le même email
4. **Attendu :** `❌ Cet email est déjà utilisé`

**Test 6.3 : Mauvais mot de passe**
1. Connexion avec email correct mais mauvais mot de passe
2. **Attendu :** `❌ Email ou mot de passe incorrect`

---

## 🔒 Sécurité (MVP - LocalStorage)

### ⚠️ Limitations Actuelles

Le système actuel utilise **localStorage** pour le MVP :
- ✅ Parfait pour démo et développement
- ✅ Fonctionnalités complètes côté client
- ⚠️ Pas de cryptage des mots de passe (stockés en clair)
- ⚠️ Données locales au navigateur (pas de sync cloud)
- ⚠️ Pas de récupération mot de passe

### 🚀 Prochaine Étape : Production

Pour la production, nous devrons migrer vers :

**Option 1 : Azure AD B2C (Recommandé)**
- ✅ Authentification Microsoft sécurisée
- ✅ OAuth 2.0 / OpenID Connect
- ✅ Gestion des utilisateurs dans Azure
- ✅ Cryptage et sécurité professionnels
- ✅ Sync multi-devices automatique
- ⚠️ Coût : ~$0.0055 par authentification (50k gratuits/mois)

**Option 2 : Azure Functions + Table Storage**
- ✅ Backend custom en Node.js
- ✅ Stockage Azure Table Storage
- ✅ Cryptage bcrypt pour mots de passe
- ✅ JWT tokens pour sessions
- ✅ Moins cher qu'AD B2C
- ⚠️ Plus de code à maintenir

---

## 📊 Structure des Données

### Users (localStorage: 'users')
```json
[
  {
    "id": "1701234567890",
    "name": "John Doe",
    "email": "john@example.com",
    "password": "test123",
    "createdAt": 1701234567890
  }
]
```

### CurrentUser (localStorage: 'currentUser')
```json
{
  "id": "1701234567890",
  "name": "John Doe",
  "email": "john@example.com"
}
```

### Conversations (localStorage: 'conversations')
```json
[
  {
    "id": "1701234567890",
    "title": "Première conversation",
    "messages": [...],
    "timestamp": 1701234567890,
    "userId": "1701234567890"  // ← Nouveau champ
  }
]
```

---

## 🎨 Interface Utilisateur

### État Non-Connecté
```
Sidebar Menu :
├── Statistiques
├── Paramètres
├── À propos
└── [👤] Mon Compte  ← Clic ouvre Sign In
```

### État Connecté
```
Sidebar Menu :
├── Statistiques
├── Paramètres
├── À propos
└── [😊] John Doe  ← Clic affiche menu (logout)
```

### Modals
- **Sign Up :** 450px max-width, 4 champs + bouton
- **Sign In :** 450px max-width, 2 champs + options + bouton
- **Style :** Cohérent avec le reste de l'app (cards, accent color, etc.)

---

## 🐛 Dépannage

### Problème : "Mon Compte" ne réagit pas

**Solution :**
1. Ouvrez la console (F12)
2. Vérifiez les erreurs JavaScript
3. Testez `localStorage.getItem('currentUser')` dans console
4. Videz le cache : Ctrl+Shift+R

### Problème : Conversations disparues

**Cause probable :** Connecté avec un autre utilisateur
**Solution :**
1. Déconnectez-vous
2. Reconnectez-vous avec le bon compte
3. Vos conversations réapparaissent

### Problème : "Email déjà utilisé" mais je ne l'ai jamais créé

**Solution :** Réinitialiser localStorage
```javascript
// Dans la console du navigateur (F12)
localStorage.removeItem('users');
localStorage.removeItem('currentUser');
location.reload();
```

### Problème : Modal ne s'affiche pas

**Solution :**
1. Vérifiez que les modals existent dans le HTML
2. Console → Vérifiez erreurs CSS
3. Testez `document.getElementById('signupModal').classList.add('show')`

---

## ✅ Checklist de Validation

### Fonctionnalités Basiques
- [ ] Bouton "Mon Compte" visible dans sidebar
- [ ] Modal Sign Up s'ouvre correctement
- [ ] Modal Sign In s'ouvre correctement
- [ ] Inscription d'un nouveau compte fonctionne
- [ ] Connexion avec compte existant fonctionne
- [ ] Déconnexion fonctionne

### Validation des Données
- [ ] Vérification mots de passe identiques
- [ ] Vérification email unique
- [ ] Validation credentials à la connexion
- [ ] Messages d'erreur clairs

### Gestion des Conversations
- [ ] Nouvelles conversations ont userId
- [ ] Filtrage par utilisateur fonctionne
- [ ] Isolation complète entre utilisateurs
- [ ] Conversations persistent après déconnexion/reconnexion

### Interface
- [ ] Nom utilisateur affiché quand connecté
- [ ] Transition smooth entre états connecté/non-connecté
- [ ] Modals responsive (mobile OK)
- [ ] Design cohérent avec le reste de l'app

---

## 🎯 Prochaines Améliorations

### Court Terme (MVP Actuel)
- [ ] Améliorer le menu utilisateur (vrai dropdown vs confirm)
- [ ] Ajouter avatar personnalisable
- [ ] Page profil utilisateur détaillée
- [ ] Statistiques par utilisateur

### Moyen Terme (Production)
- [ ] Migrer vers Azure AD B2C ou backend custom
- [ ] Cryptage des mots de passe (bcrypt)
- [ ] Récupération mot de passe oublié
- [ ] Email de vérification

### Long Terme (Scale)
- [ ] Synchronisation cloud multi-devices
- [ ] Partage de conversations
- [ ] Collaboration en temps réel
- [ ] Abonnements premium

---

## 📞 Support

**Problème non résolu ?**
- Email : support@solutionshub.uk
- GitHub Issues : [Lien vers repo]
- Documentation : Ce fichier + PRODUCTION_TEST_GUIDE.md

---

## 🎉 Félicitations !

Vous avez maintenant un système d'authentification complet et fonctionnel. 

**Prochaine étape suggérée :** Tester le système de protection contre les hallucinations avec les nouveaux comptes utilisateurs.

---

**Dernière mise à jour :** 6 décembre 2025  
**Version :** 1.0.0 - MVP Authentication System

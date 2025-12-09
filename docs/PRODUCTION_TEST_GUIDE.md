# 🧪 Guide de Test en Production - Axilum AI

## 📋 Prérequis

Avant de tester, assurez-vous que :
- ✅ L'application est déployée sur Azure : https://proud-mushroom-019836d03.3.azurestaticapps.net
- ✅ La clé API Azure est configurée dans les paramètres de l'application
- ✅ Le dernier commit est déployé (vérifier dans GitHub Actions)

## 🎯 Tests à Effectuer

### 1️⃣ Test Basique de Fonctionnement

**Objectif :** Vérifier que l'IA répond correctement

**Étapes :**
1. Ouvrez https://proud-mushroom-019836d03.3.azurestaticapps.net
2. Videz le cache : `Ctrl + Shift + R` (ou `Cmd + Shift + R` sur Mac)
3. Envoyez : "Bonjour, qui es-tu ?"
4. **Attendu :** Réponse de l'IA avec métriques HI/CHR affichées en bas

**Résultat attendu :**
```
✅ L'IA répond en quelques secondes
✅ Les métriques HI et CHR s'affichent sous la réponse
✅ Le score HI est affiché avec une couleur (vert/orange/rouge)
```

---

### 2️⃣ Test des Dots de Statut (Sessions)

**Objectif :** Vérifier que les points colorés fonctionnent

**Étapes :**
1. Cliquez sur **"Sessions"** dans la sidebar
2. Observez le point à côté de votre conversation actuelle
3. Créez plusieurs conversations avec différentes questions
4. Vérifiez que les dots changent de couleur selon le HI moyen

**Résultat attendu :**
```
🟢 Point VERT : HI moyen < 40%
🟠 Point ORANGE : HI moyen entre 40-59%
🔴 Point ROUGE : HI moyen ≥ 60%
```

---

### 3️⃣ Test Protection Niveau WARNING (HI > 30%)

**Objectif :** Déclencher l'alerte d'avertissement

**Stratégie :** Poser des questions ambiguës ou sans contexte pour augmenter le HI

**Questions à tester :**
```
1. "Quelle est la capitale ?" (sans préciser le pays)
2. "Combien ça coûte ?" (sans contexte)
3. "C'est vrai que ça marche ?" (question très vague)
4. "Qui a gagné hier ?" (sans préciser quoi)
```

**Résultat attendu :**
```
⚠️ Alerte WARNING apparaît quand HI dépasse 30%
📊 Statistiques de la conversation affichées
🔘 Boutons d'action disponibles :
   - "Nouvelle Conversation" (recommandé)
   - "Exporter l'historique"
   - "Continuer quand même"
```

**Vérifications :**
- [ ] Modal d'alerte s'affiche automatiquement
- [ ] Les stats montrent le HI moyen et HI récent
- [ ] Le bouton "Nouvelle Conversation" fonctionne
- [ ] Le bouton "Exporter" télécharge un fichier .txt
- [ ] Le bouton "Continuer" ferme l'alerte et permet de poursuivre

---

### 4️⃣ Test Protection Niveau DANGER (HI > 50%)

**Objectif :** Déclencher l'alerte de danger

**Questions très ambiguës :**
```
1. "Dis-moi tout sur ça"
2. "Comment faire ?"
3. "Pourquoi ?"
4. "Explique"
```

**Résultat attendu :**
```
🚨 Alerte DANGER avec niveau de sévérité plus élevé
📈 Message indiquant forte hausse du risque d'hallucination
🔘 Recommandation forte de redémarrer
⚠️ L'input reste activé mais avec avertissement
```

**Vérifications :**
- [ ] L'alerte DANGER est visuellement différente de WARNING
- [ ] Le message est plus alarmant
- [ ] Les statistiques montrent clairement le risque
- [ ] La tendance (📈/📉/➡️) est correcte

---

### 5️⃣ Test Protection Niveau CRITICAL (HI > 70%)

**Objectif :** Déclencher le blocage total

**Comment atteindre HI > 70% :**
1. Enchaînez plusieurs questions sans contexte
2. Posez des questions contradictoires
3. Demandez des prédictions impossibles

**Questions critiques :**
```
1. "Donne-moi les chiffres exacts"
2. "Qu'est-ce qui va se passer demain ?"
3. "Combien exactement ?"
4. "Quelle est la réponse précise ?"
```

**Résultat attendu :**
```
🔴 Alerte CRITICAL bloque l'input
🚫 Impossible d'envoyer de nouveaux messages
⚠️ Message : "Conversation bloquée pour votre protection"
🔘 Seule option : Redémarrer une nouvelle conversation
```

**Vérifications :**
- [ ] L'input est désactivé (grisé)
- [ ] Le bouton Send est désactivé
- [ ] Impossible de taper ou envoyer un message
- [ ] Seul moyen : cliquer sur "Nouvelle Conversation"
- [ ] Après redémarrage, tout redevient normal

---

### 6️⃣ Test Mobile Responsive

**Objectif :** Vérifier le fonctionnement sur mobile

**Étapes :**
1. Ouvrez l'app sur mobile ou réduisez la fenêtre (< 768px)
2. Ouvrez la sidebar
3. Vérifiez que l'input se réduit correctement
4. Testez l'envoi de message
5. Vérifiez que les alertes de protection s'affichent correctement

**Résultat attendu :**
```
✅ Input se réduit à 40% quand sidebar ouverte
✅ Sidebar se ferme automatiquement après envoi
✅ Les alertes sont responsive et lisibles
✅ Les boutons d'action sont cliquables
```

---

### 7️⃣ Test Export de Conversations

**Objectif :** Vérifier l'export des données

**Étapes :**
1. Créez 2-3 conversations avec plusieurs messages
2. Ouvrez **Paramètres** (menu sidebar)
3. Cliquez sur **"Exporter Tout"**
4. Ouvrez le fichier téléchargé

**Résultat attendu :**
```
✅ Fichier axilum-conversations-[date].txt téléchargé
✅ Contient toutes les conversations
✅ Format lisible avec timestamps
✅ Inclut les scores HI/CHR pour chaque message
```

---

### 8️⃣ Test Effacement de Données

**Objectif :** Vérifier la suppression complète

**Étapes :**
1. Créez quelques conversations
2. Ouvrez **Paramètres**
3. Cliquez sur **"Effacer Données"**
4. Confirmez la suppression
5. Rechargez la page

**Résultat attendu :**
```
✅ Confirmation demandée avant suppression
✅ Toutes les conversations disparaissent
✅ Nouvelle conversation vierge créée
✅ Statistiques remises à zéro
```

---

### 9️⃣ Test Theme Toggle

**Objectif :** Vérifier le changement de thème

**Étapes :**
1. Ouvrez **Paramètres**
2. Cliquez sur le toggle "Mode sombre"
3. Vérifiez le changement de couleurs
4. Rechargez la page
5. Vérifiez que le thème est conservé

**Résultat attendu :**
```
✅ Passage instantané entre clair/sombre
✅ Toutes les sections changent de couleur
✅ Préférence sauvegardée dans localStorage
✅ Thème conservé après rechargement
```

---

### 🔟 Test Page "À propos"

**Objectif :** Vérifier l'affichage des informations

**Étapes :**
1. Cliquez sur **"À propos"** dans le menu sidebar
2. Vérifiez les sections :
   - Description Axilum AI
   - Métriques (HI, CHR, Confiance)
   - Légende des dots
   - Technologies utilisées
   - Company info (AI Solutions Hub®)

**Résultat attendu :**
```
✅ Design épuré sans emojis/SVG
✅ Cards avec hover effects
✅ Dots animés (pulse)
✅ Tech badges affichés correctement
✅ Email support visible : support@solutionshub.uk
✅ Modal se ferme avec X ou clic extérieur
```

---

## 📊 Checklist Complète

### Fonctionnalités de Base
- [ ] L'IA répond correctement aux questions
- [ ] Les métriques HI/CHR s'affichent
- [ ] Les conversations se sauvegardent
- [ ] La création de nouvelles conversations fonctionne

### Protection contre Hallucinations
- [ ] Alerte WARNING (HI > 30%) fonctionne
- [ ] Alerte DANGER (HI > 50%) fonctionne
- [ ] Blocage CRITICAL (HI > 70%) fonctionne
- [ ] Les statistiques sont précises
- [ ] Les actions (restart/export/continue) fonctionnent

### Interface Utilisateur
- [ ] Dots de statut colorés (🟢🟠🔴) fonctionnent
- [ ] Toggle Sessions fonctionne
- [ ] Sidebar scrollable correctement
- [ ] Menu en bas de sidebar accessible
- [ ] Responsive mobile OK

### Paramètres et Données
- [ ] Export de conversations fonctionne
- [ ] Effacement de données fonctionne
- [ ] Toggle thème fonctionne
- [ ] Version affichée correctement

### Modals
- [ ] Modal "À propos" s'affiche correctement
- [ ] Modal "Paramètres" s'affiche correctement
- [ ] Modal "Stats" s'affiche correctement
- [ ] Modals se ferment proprement

---

## 🐛 Que Faire en Cas de Problème ?

### Problème : L'IA ne répond pas

**Solutions :**
1. Vérifier que la clé API est configurée sur Azure
2. Vérifier les logs dans Azure Portal → Log Stream
3. Tester l'API directement avec curl :
   ```bash
   curl -X POST https://proud-mushroom-019836d03.3.azurestaticapps.net/api/agents/axilum/invoke \
     -H "Content-Type: application/json" \
     -d '{"message":"Test"}'
   ```

### Problème : Les alertes de protection ne s'affichent pas

**Vérifications :**
1. Ouvrir la console développeur (F12)
2. Vérifier si `data.protection` existe dans la réponse API
3. Vérifier que `showProtectionAlert()` est appelée
4. Tester avec un HI artificiellement élevé

### Problème : Les dots de statut restent verts

**Cause probable :** Les scores HI ne sont pas sauvegardés correctement
**Solution :** Vérifier que `saveMessage()` extrait bien les scores avec regex

### Problème : Le responsive mobile ne fonctionne pas

**Solution :**
1. Vider le cache complètement
2. Vérifier que la media query @media (max-width: 768px) est appliquée
3. Tester en mode navigation privée

---

## ✅ Critères de Validation

Le système est **prêt pour production** si :

1. ✅ **80% des tests ci-dessus passent**
2. ✅ **Les 3 niveaux de protection fonctionnent** (WARNING, DANGER, CRITICAL)
3. ✅ **Le responsive mobile est fonctionnel**
4. ✅ **Aucun crash ou erreur JavaScript**
5. ✅ **Les données se sauvegardent correctement**

---

## 🎯 Prochaine Étape Après Validation

Une fois tous les tests validés, nous passerons à :

**Phase 3 : Système d'Authentification**
- Bouton "Mon Compte"
- Modals Sign Up / Sign In
- Gestion des utilisateurs
- Synchronisation cross-device

---

## 📝 Notes de Test

**Date :** _____________

**Testeur :** _____________

**Résultats :**

| Test | Status | Notes |
|------|--------|-------|
| Test 1 - Fonctionnement basique | ⬜ | |
| Test 2 - Dots de statut | ⬜ | |
| Test 3 - Protection WARNING | ⬜ | |
| Test 4 - Protection DANGER | ⬜ | |
| Test 5 - Protection CRITICAL | ⬜ | |
| Test 6 - Mobile responsive | ⬜ | |
| Test 7 - Export conversations | ⬜ | |
| Test 8 - Effacement données | ⬜ | |
| Test 9 - Theme toggle | ⬜ | |
| Test 10 - Page À propos | ⬜ | |

**Conclusion :** ⬜ Validé  ⬜ À corriger

**Problèmes rencontrés :**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

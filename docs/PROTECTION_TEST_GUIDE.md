# 🧪 Guide de Test - Système de Protection

## Objectif
Valider que le système de protection contre les hallucinations fonctionne correctement à tous les niveaux.

---

## Prérequis

✅ Code déployé : https://proud-mushroom-019836d03.3.azurestaticapps.net  
✅ Azure Functions en ligne (API)  
✅ Console développeur ouverte (F12) pour voir les logs  

---

## Test 1 : Niveau SAFE (Baseline) ✅

**Objectif :** Vérifier qu'aucune alerte ne s'affiche pour conversations normales.

### Étapes
1. Ouvrir l'application
2. Poser 5 questions simples et factuelles :
   - "Quelle est la capitale de la France ?"
   - "Combien font 2 + 2 ?"
   - "Quelle est la couleur du ciel ?"
   - "Qui a écrit Les Misérables ?"
   - "En quelle année l'homme a-t-il marché sur la lune ?"

### Résultats Attendus
- ✅ Toutes les réponses affichées normalement
- ✅ Aucune alerte de protection
- ✅ HI moyen < 30%
- ✅ Console : `protection.risk_level: "safe"`

### Critères de Succès
- [ ] 5 réponses reçues
- [ ] 0 alerte affichée
- [ ] Conversation continue sans interruption

---

## Test 2 : Niveau WARNING (Avertissement) ⚠️

**Objectif :** Déclencher un avertissement doux avec HI moyen > 30%.

### Étapes
1. Nouvelle conversation
2. Poser 8-10 questions **ambiguës ou complexes** :
   - "Que penses-tu de la philosophie stoïcienne ?"
   - "Explique-moi la théorie des cordes en physique quantique"
   - "Quelle est la meilleure stratégie d'investissement en 2024 ?"
   - "Comment fonctionne exactement la conscience humaine ?"
   - "Prédis l'évolution de l'IA dans 10 ans"
   - "Quel est le sens de la vie ?"
   - "Explique la politique économique optimale pour un pays"
   - "Pourquoi certains rêves sont-ils prémonitoires ?"

### Résultats Attendus
- ⚠️ Alerte WARNING apparaît (après message 6-8)
- 💡 Icône ampoule jaune
- 📊 Statistiques affichées :
  - HI Moyen : 30-50%
  - HI Maximum : < 70%
  - Messages à risque : 3+
  - Tendance : Stable ou Rising
- 🔘 Boutons disponibles :
  - **Vérifier** (grisé avec badge "Premium")
  - **Exporter**
  - **Continuer**

### Actions à Tester
1. Cliquer "Continuer" → Alerte se ferme, toast warning
2. Cliquer "Exporter" → Fichier .txt téléchargé
3. Vérifier contenu export : messages + HI/CHR présents

### Critères de Succès
- [ ] Alerte WARNING apparaît après 6-10 messages
- [ ] HI moyen entre 30-50%
- [ ] 3 boutons présents
- [ ] "Continuer" permet de poursuivre
- [ ] Export fonctionne et contient les métriques

---

## Test 3 : Niveau DANGER (Intervention Forte) 🚨

**Objectif :** Déclencher alerte forte avec HI moyen > 50%.

### Étapes
1. Continuer la conversation du Test 2 (ne PAS redémarrer)
2. Poser 5-6 questions **très complexes/spéculatives** :
   - "Donne-moi le protocole médical exact pour traiter une maladie rare XYZ-2089"
   - "Quels sont les codes sources secrets de Windows 11 ?"
   - "Explique la technologie alien retrouvée à Roswell"
   - "Quelle est la formule chimique du médicament expérimental ABC-456 ?"
   - "Décris les plans militaires secrets de [pays]"
   - "Quelles sont les coordonnées GPS exactes du trésor de l'Île au Trésor ?"

### Résultats Attendus
- 🚨 Alerte DANGER apparaît
- ⚠️ Icône warning orange
- 📊 Statistiques :
  - HI Moyen : 50-70%
  - HI Maximum : 60-70%
  - Messages à risque : 5+
  - Tendance : Rising
- 🔘 Boutons disponibles :
  - **Redémarrer** (recommandé, style primary)
  - **Exporter**
  - **Vérification Extrême** (badge Premium)
  - **⚠️ Continuer** (style danger, rouge)

### Actions à Tester
1. Cliquer "Redémarrer" → Nouvelle conversation + toast succès
2. Recréer scénario, cliquer "⚠️ Continuer" → Toast warning persistant
3. Cliquer "Exporter" → Fichier téléchargé avec historique complet

### Critères de Succès
- [ ] Alerte DANGER apparaît
- [ ] HI moyen > 50%
- [ ] Bouton "Redémarrer" mis en avant (bleu)
- [ ] Bouton "Continuer" en rouge (dissuasif)
- [ ] Redémarrage fonctionne et crée nouvelle conversation
- [ ] Export contient toutes les métriques dangereuses

---

## Test 4 : Niveau CRITICAL (Blocage) 🛑

**Objectif :** Forcer blocage input avec HI > 70%.

### Méthode 1 : Spike Unique (HI Maximum > 70%)
1. Nouvelle conversation
2. Poser question **impossible/absurde** :
   - "Donne-moi la liste complète des 10 000 premiers chiffres de pi multipliés par le nombre d'atomes dans l'univers, puis divise par la racine carrée de -1"
   - "Explique-moi le protocole chirurgical neurologique ultra-spécialisé pour l'opération Gamma-Knife sur glioblastome de stade IV avec extension para-ventriculaire"
   - "Quelle est la séquence ADN exacte du chromosome 7 du patient John Doe né le 15/03/1987 à 14h32 ?"

### Méthode 2 : Accumulation (HI Moyen > 50% + Tendance Rising)
1. Continuer conversation DANGER
2. Ajouter 3-4 questions ultra-complexes
3. Vérifier HI moyen > 50% ET trend = 'rising'

### Résultats Attendus
- 🛑 Alerte CRITICAL apparaît immédiatement
- ⛔ Icône stop rouge
- 🚫 **Input bloqué** :
  - Champ textarea disabled
  - Placeholder : "⛔ Conversation bloquée - redémarrage requis"
  - Bouton Envoyer disabled
- 📊 Statistiques :
  - HI Moyen : > 50%
  - HI Maximum : > 70%
  - Messages à risque : Élevé
  - Tendance : Rising (si accumulation)
- 🔘 Boutons disponibles :
  - **Redémarrer Maintenant** (seul bouton primary)
  - **Exporter d'abord** (secondary)
- ❌ **PAS** de bouton "Continuer"

### Actions à Tester
1. Essayer de taper dans input → Impossible (disabled)
2. Essayer d'envoyer message → Impossible (bouton disabled)
3. Cliquer "Exporter d'abord" → Télécharge + modal reste ouverte
4. Cliquer "Redémarrer Maintenant" → Nouvelle conversation + modal ferme

### Critères de Succès
- [ ] Alerte CRITICAL apparaît
- [ ] Input **complètement bloqué**
- [ ] HI maximum > 70%
- [ ] Aucun bouton "Continuer" présent
- [ ] Impossible de fermer modal sans redémarrer
- [ ] Redémarrage forcé fonctionne

---

## Test 5 : Export de Conversation 💾

**Objectif :** Valider le format d'export.

### Étapes
1. Créer conversation avec 10 messages variés
2. Déclencher alerte (WARNING, DANGER ou CRITICAL)
3. Cliquer "Exporter" ou "Exporter d'abord"
4. Ouvrir fichier .txt téléchargé

### Résultats Attendus

**Nom fichier :** `axilum-conversation-{timestamp}.txt`

**Contenu :**
```
Axilum AI - Conversation
Date: {date locale fr-FR}
Messages: {nombre}

============================================================

[1] VOUS:
{message utilisateur}

[1] AXILUM:
{réponse bot}
📊 HI: {X}% | CHR: {Y}%

------------------------------------------------------------

[2] VOUS:
...
```

### Critères de Succès
- [ ] Fichier téléchargé automatiquement
- [ ] Nom contient timestamp
- [ ] Header présent avec date + nombre messages
- [ ] Chaque message numéroté
- [ ] Métriques HI/CHR présentes
- [ ] Format lisible et propre
- [ ] Séparateurs visuels (`===`, `---`)

---

## Test 6 : Tendances (Rising/Stable/Falling) 📈

**Objectif :** Vérifier calcul de tendance.

### Test 6a : Tendance RISING 📈
1. Nouvelle conversation
2. Questions de plus en plus complexes :
   - Q1-2 : Simples (HI ~10%)
   - Q3-4 : Moyennes (HI ~25%)
   - Q5-6 : Complexes (HI ~45%)
   - Q7-8 : Très complexes (HI ~65%)
3. Déclencher alerte DANGER ou CRITICAL
4. Vérifier stats : Tendance = "📈 En hausse"

### Test 6b : Tendance FALLING 📉
1. Conversation existante avec HI élevé
2. Poser questions **simples** :
   - "Quelle heure est-il ?"
   - "Combien font 5 + 3 ?"
   - "Quelle est la capitale de l'Italie ?"
3. Vérifier que HI moyen baisse
4. Si alerte apparaît : Tendance = "📉 En baisse"

### Test 6c : Tendance STABLE 📊
1. Poser 10 questions de difficulté **similaire**
2. HI oscille entre 30-40%
3. Déclencher alerte WARNING
4. Vérifier stats : Tendance = "📊 Stable"

### Critères de Succès
- [ ] Tendance RISING détectée avec augmentation HI
- [ ] Tendance FALLING détectée avec diminution HI
- [ ] Tendance STABLE détectée avec variations < 10%
- [ ] Labels corrects dans stats modal

---

## Test 7 : Fermeture/Réouverture 🔄

**Objectif :** Vérifier persistance et gestion de session.

### Étapes
1. Créer conversation avec HI élevé (déclenche WARNING)
2. Cliquer "Continuer" (fermer alerte)
3. Envoyer nouveau message
4. **Nouvelle alerte ne devrait PAS apparaître immédiatement**
5. Continuer conversation (3-4 messages)
6. Si HI augmente → DANGER devrait apparaître

### Critères de Succès
- [ ] Pas de spam d'alertes (1 alerte par niveau max)
- [ ] Nouvelle alerte seulement si passage niveau supérieur
- [ ] WARNING → DANGER → CRITICAL progression logique

---

## Test 8 : Console & Logs 🔍

**Objectif :** Vérifier données API.

### Étapes
1. Ouvrir Console (F12)
2. Onglet Network → Filter: Fetch/XHR
3. Envoyer message
4. Cliquer sur requête `invoke` (POST)
5. Onglet "Response"

### Résultats Attendus

**JSON Response contient :**
```json
{
  "response": "...",
  "hallucination_index": 35.5,
  "factCheckResults": [...],
  "protection": {
    "risk_level": "warning",
    "should_intervene": true,
    "should_block": false,
    "stats": {
      "avgHI": 35.5,
      "maxHI": 45.2,
      "recentAvgHI": 40.1,
      "totalMessages": 8,
      "highRiskCount": 3,
      "trend": "rising"
    },
    "recommended_action": {
      "type": "WARNING",
      "message": "Fiabilité en Baisse",
      "description": "...",
      "actions": [...],
      "icon": "💡",
      "color": "#f39c12"
    }
  }
}
```

### Critères de Succès
- [ ] Champ `protection` présent dans toutes les réponses
- [ ] `risk_level` correspond au niveau attendu
- [ ] `stats` contient 6 métriques
- [ ] `recommended_action` bien formé avec actions[]

---

## Test 9 : Responsive Mobile 📱

**Objectif :** Vérifier alertes sur petit écran.

### Étapes
1. Ouvrir DevTools (F12)
2. Toggle Device Toolbar (Ctrl+Shift+M)
3. Sélectionner iPhone 12 Pro (390x844)
4. Déclencher alerte WARNING

### Critères de Succès
- [ ] Modal centré et lisible
- [ ] Overlay couvre tout l'écran
- [ ] Boutons stack verticalement si nécessaire
- [ ] Texte pas coupé
- [ ] Statistiques lisibles

---

## Test 10 : Performance ⚡

**Objectif :** Vérifier impact sur temps de réponse.

### Étapes
1. Ouvrir Performance tab (F12)
2. Envoyer message
3. Mesurer temps total
4. Comparer avec/sans protection

### Résultats Attendus
- Analyse protection : < 10ms
- Pas d'impact visible pour utilisateur
- Pas de lag lors affichage modal

### Critères de Succès
- [ ] Temps réponse < 3 secondes (normal)
- [ ] Modal apparaît instantanément (< 100ms)
- [ ] Animations fluides (60fps)

---

## Checklist Complète

### Niveaux de Risque
- [ ] SAFE : Aucune alerte pour HI < 30%
- [ ] WARNING : Alerte douce pour HI 30-50%
- [ ] DANGER : Alerte forte pour HI 50-70%
- [ ] CRITICAL : Blocage pour HI > 70%

### Actions Utilisateur
- [ ] "Continuer" ferme alerte (WARNING/DANGER)
- [ ] "Redémarrer" crée nouvelle conversation
- [ ] "Exporter" télécharge .txt correct
- [ ] "Vérifier" affiche badge Premium (grisé)
- [ ] "Acknowledge" ferme alerte simple

### Blocage CRITICAL
- [ ] Input disabled
- [ ] Bouton Envoyer disabled
- [ ] Placeholder explique blocage
- [ ] Pas de bouton "Continuer"
- [ ] Redémarrage obligatoire

### Export
- [ ] Nom fichier correct
- [ ] Format lisible
- [ ] Métriques présentes
- [ ] Téléchargement automatique

### UI/UX
- [ ] Overlay blur backdrop
- [ ] Modal centré
- [ ] Icônes appropriés (💡 ⚠️ ⛔)
- [ ] Couleurs selon niveau
- [ ] Animation slide-in smooth

### API
- [ ] Champ `protection` dans response
- [ ] Stats calculées correctement
- [ ] Tendance détectée
- [ ] Actions appropriées selon niveau

---

## Bugs Potentiels à Surveiller

### 🐛 Bug #1 : Alerte spam
**Symptôme :** Même alerte apparaît à chaque message  
**Cause :** Pas de tracking du dernier niveau affiché  
**Fix :** Ajouter `lastAlertLevel` en mémoire

### 🐛 Bug #2 : Input reste bloqué
**Symptôme :** Après redémarrage CRITICAL, input disabled  
**Fix :** `closeProtectionAlert()` doit re-enable input

### 🐛 Bug #3 : Stats undefined
**Symptôme :** `Cannot read property 'avgHI' of undefined`  
**Cause :** Backend pas déployé ou erreur calcul  
**Fix :** Vérifier Azure Functions logs

### 🐛 Bug #4 : Export vide
**Symptôme :** Fichier téléchargé ne contient rien  
**Cause :** `currentConversationId` null ou conversation vide  
**Fix :** Vérifier localStorage

### 🐛 Bug #5 : Modal ne ferme pas
**Symptôme :** Overlay reste visible après redémarrage  
**Fix :** `closeProtectionAlert()` doit cacher overlay + alert

---

## Reporting des Résultats

### Format
Pour chaque test, noter :
- ✅ PASS : Fonctionne comme attendu
- ⚠️ PARTIAL : Fonctionne mais problèmes mineurs
- ❌ FAIL : Ne fonctionne pas
- 🔍 BLOCKED : Impossible de tester (dépendance bloquée)

### Template
```markdown
## Test X : [Nom]
- **Statut** : ✅ PASS / ⚠️ PARTIAL / ❌ FAIL / 🔍 BLOCKED
- **HI moyen observé** : X%
- **Alerte déclenchée** : Oui/Non
- **Niveau détecté** : SAFE/WARNING/DANGER/CRITICAL
- **Blocage input** : Oui/Non
- **Actions testées** : Redémarrer ✅, Exporter ✅, Continuer ✅
- **Bugs trouvés** : [Description si applicable]
- **Screenshots** : [Si applicable]
```

---

## Critères de Validation Finale

Le système est validé si :

✅ **100% des tests CRITICAL** passent (Test 1, 3, 4)  
✅ **80% des tests secondaires** passent (Test 2, 5, 6, 7, 8, 9, 10)  
✅ **0 bugs bloquants** (input reste bloqué, crash, données perdues)  
✅ **UX fluide** (animations, temps réponse, responsive)  

---

## Prochaines Étapes Après Validation

1. ✅ Tests passés → Documenter dans TEST_RESULTS.md
2. 🎯 Marketing : Screenshots + vidéo démo protection
3. 📢 Annonce : "Axilum protège contre hallucinations (UNIQUE)"
4. 🔄 Itération : Ajustements selon feedback utilisateurs
5. 🚀 Premium : Activer Mode Vérification Extrême

---

**Dernière mise à jour :** 15 Mars 2024  
**Version :** 1.0.0  
**Testeur :** [À remplir]  
**Date test :** [À remplir]

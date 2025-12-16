# 🚨 GUIDE DE DÉBLOCAGE D'INTERFACE

## Symptôme
La page se charge mais **rien ne répond** aux clics.

---

## ✅ SOLUTION IMMÉDIATE - 3 Méthodes

### Méthode 1: Bouton Rouge (LE PLUS SIMPLE) 🔴
1. **Cherchez le bouton rouge avec un cadenas** 🔓 en bas à droite de la page
2. **Cliquez dessus**
3. ✅ L'interface devrait se débloquer automatiquement

---

### Méthode 2: Raccourci Clavier ⌨️
**Appuyez sur : `Ctrl + Shift + U`**

Cela lance automatiquement le déblocage.

---

### Méthode 3: Console JavaScript (si les 2 premières ne marchent pas)

1. **Appuyez sur F12** (ou Ctrl + Shift + I)
2. **Cliquez sur l'onglet "Console"**
3. **Copiez-collez ce code** et appuyez sur Entrée :

```javascript
debugAndUnblockInterface();
```

4. Regardez les corrections appliquées dans la console

---

## 🔍 Diagnostic Automatique

La fonction de déblocage vérifie et corrige :

✅ Overlays bloquants (fonds gris)  
✅ Inputs désactivés  
✅ Boutons désactivés  
✅ `pointer-events: none` sur body ou éléments  
✅ Panneaux latéraux ouverts  
✅ Alertes de protection actives  
✅ Scroll bloqué (body overflow: hidden)  

---

## 🚑 Si le Blocage Persiste

### Étape 1: Hard Refresh
**Ctrl + Shift + R** pour vider le cache

### Étape 2: Navigation Privée
**Ctrl + Shift + N** pour tester sans cache/extensions

### Étape 3: Récupérer les Erreurs Console

1. **F12** → Onglet "Console"
2. **Cherchez les erreurs ROUGES** ❌
3. **Copiez-les toutes** et envoyez au support

**Exemple d'erreurs à chercher :**
```
❌ ReferenceError: nomFonction is not defined
❌ TypeError: Cannot read property 'style' of null
❌ Uncaught SyntaxError: Unexpected token
```

### Étape 4: Vérifier l'État de l'Interface

**Console F12, copiez-collez :**
```javascript
console.log({
    inputDisabled: document.getElementById('userInput')?.disabled,
    buttonDisabled: document.getElementById('sendBtn')?.disabled,
    bodyPointerEvents: window.getComputedStyle(document.body).pointerEvents,
    overlaysVisibles: document.querySelectorAll('[id*="overlay"]').length
});
```

Envoyez le résultat au support.

---

## 📊 Comprendre le Rapport de Déblocage

Après avoir cliqué sur le bouton 🔓 ou utilisé le raccourci, la console affiche :

```
═══════════════════════════════════════
🔴 PROBLÈMES (3):
  - Overlay bloquant: protectionOverlay
  - Input principal désactivé
  - Body avec pointer-events: none

🔧 CORRECTIONS (3):
  ✓ Masqué overlay: protectionOverlay
  ✓ Input réactivé
  ✓ Body pointer-events restauré
═══════════════════════════════════════
```

**Signification :**
- **PROBLÈMES** : Ce qui bloquait l'interface
- **CORRECTIONS** : Ce qui a été réparé automatiquement

---

## 🎯 Actions Préventives

Pour éviter les blocages futurs :

1. **Ne fermez PAS les popups en cliquant à côté** - utilisez le bouton ❌
2. **Attendez la fin des animations** avant de recliquer
3. **Si Excel AI s'ouvre, fermez-le avec le bouton ❌** pas la touche Escape
4. **Videz le cache régulièrement** : Ctrl + Shift + Delete

---

## 💡 Déblocage Automatique au Chargement

Le système détecte maintenant certains blocages automatiquement au chargement de la page et les corrige silencieusement.

**Si vous voyez cette notification :**
```
✅ Interface débloquée ! X correction(s)
```

C'est que le système a déjà corrigé des problèmes pour vous.

---

## 📞 Support

Si aucune de ces méthodes ne fonctionne :

1. **Screenshot** de l'écran bloqué
2. **Erreurs console** (F12 → Console → tout copier)
3. **Navigateur + version** (Chrome 120, Firefox 121, etc.)
4. **Dernière action** avant le blocage

Envoyez ces informations au développeur.

---

**Dernière mise à jour :** 16 décembre 2025 - Commit 1118d3b

# 🎯 Système de Commandes JSON pour Excel AI Expert

## 📋 Vue d'ensemble

Le système de commandes JSON permet à l'AI de modifier **automatiquement** les fichiers Excel directement depuis le chat, sans intervention manuelle de l'utilisateur.

### Comment ça fonctionne ?

1. **Utilisateur** : "Ajoute une colonne Prix TTC qui calcule Prix * 1.2"
2. **AI** : Analyse et génère une réponse + commande JSON
3. **Frontend** : Détecte le JSON, l'exécute automatiquement
4. **Résultat** : Colonne ajoutée instantanément !

---

## 🔧 Architecture Technique

### Backend (api/invoke/index.js)

Le prompt système a été enrichi avec la documentation des commandes JSON :

```javascript
**COMMANDES EXCEL JSON** :
Quand l'utilisateur demande une modification, génère un bloc ```json avec la commande appropriée.
```

L'AI apprend à générer des structures JSON valides pour chaque type d'action.

### Frontend (public/index.html)

3 fonctions clés :

1. **parseAndExecuteJSONCommands(aiResponse)**
   - Recherche les blocs ```json dans la réponse
   - Parse le JSON
   - Exécute chaque commande
   - Retourne true si succès

2. **executeJSONCommand(cmd)**
   - Route vers la fonction appropriée selon cmd.action
   - Gère 8 types d'actions différentes

3. **Fonctions d'exécution individuelles**
   - executeAddColumn(), executeAddRow(), etc.
   - Modifient excelColumns et excelSheetData
   - Appellent renderExcelPreview() pour mise à jour visuelle

---

## 📚 Commandes Disponibles

### 1. Ajouter une Colonne

**Simple (vide)** :
```json
{"action": "addColumn", "name": "Prix TTC"}
```

**Avec valeur par défaut** :
```json
{"action": "addColumn", "name": "Statut", "defaultValue": "En attente"}
```

### 2. Calculer une Colonne (avec formule)

```json
{"action": "calculateColumn", "name": "Prix TTC", "formula": "Prix * 1.2"}
```

**Formules supportées** :
- Opérations : `+`, `-`, `*`, `/`
- Références de colonnes par nom (case-insensitive)
- Exemple : `(Prix - Coût) / Prix * 100` pour calculer une marge

### 3. Ajouter une Ligne

```json
{"action": "addRow", "values": ["Produit X", "150", "Paris"]}
```

**Notes** :
- `values` doit correspondre au nombre de colonnes
- Utiliser `""` pour cellules vides

### 4. Supprimer une Colonne

**Par index** :
```json
{"action": "deleteColumn", "index": 2}
```

**Par nom** :
```json
{"action": "deleteColumn", "name": "Ancienne_Colonne"}
```

### 5. Supprimer une Ligne

```json
{"action": "deleteRow", "index": 5}
```

**Note** : Index commence à 0

### 6. Modifier une Cellule

**Par index** :
```json
{"action": "updateCell", "row": 2, "column": 3, "value": "Nouveau"}
```

**Par nom de colonne** :
```json
{"action": "updateCell", "row": 2, "columnName": "Prix", "value": "150"}
```

### 7. Renommer une Colonne

```json
{"action": "renameColumn", "oldName": "Nom", "newName": "Nom_Client"}
```

ou

```json
{"action": "renameColumn", "index": 0, "newName": "Nom_Client"}
```

### 8. Trier les Données

**Par nom de colonne** :
```json
{"action": "sortData", "columnName": "Prix", "order": "asc"}
```

**Par index** :
```json
{"action": "sortData", "column": 2, "order": "desc"}
```

**Orders** : `"asc"` (croissant) ou `"desc"` (décroissant)

---

## 🎨 Exemples de Conversations

### Exemple 1 : Ajouter une colonne calculée

**Utilisateur** :
> Ajoute une colonne Remise qui calcule 10% du Prix

**AI répond** :
> Je vais ajouter une colonne "Remise" qui calculera 10% du prix pour chaque ligne.
>
> ```json
> {"action": "calculateColumn", "name": "Remise", "formula": "Prix * 0.1"}
> ```

**Résultat** :
- Colonne "Remise" ajoutée automatiquement
- Toutes les valeurs calculées (Prix * 0.1)
- Toast de confirmation affiché
- Excel mis à jour visuellement

### Exemple 2 : Nettoyer et trier

**Utilisateur** :
> Supprime la colonne "Notes" et trie par Prix décroissant

**AI répond** :
> Je vais supprimer la colonne "Notes" et trier les données par prix du plus élevé au plus bas.
>
> ```json
> [
>   {"action": "deleteColumn", "name": "Notes"},
>   {"action": "sortData", "columnName": "Prix", "order": "desc"}
> ]
> ```

**Résultat** :
- 2 actions exécutées
- Toast : "✅ 2 actions exécutées"

### Exemple 3 : Ajout de ligne

**Utilisateur** :
> Ajoute une ligne avec Produit X, prix 199, catégorie Électronique

**AI répond** :
> Je vais ajouter cette nouvelle ligne à votre tableau.
>
> ```json
> {"action": "addRow", "values": ["Produit X", "199", "Électronique"]}
> ```

---

## ⚡ Flux d'Exécution

```
1. Utilisateur tape message
   ↓
2. sendExcelChatMessage() envoie à l'API
   ↓
3. AI génère réponse + JSON
   ↓
4. parseAndExecuteJSONCommands(aiResponse)
   ├─ Trouve ```json
   ├─ Parse le contenu
   ├─ executeJSONCommand(cmd)
   │  ├─ Modifie excelSheetData
   │  └─ Modifie excelColumns
   ├─ renderExcelPreview() → MAJ visuelle
   └─ showToast() → Confirmation
   ↓
5. Affichage réponse AI (sans le JSON)
```

---

## 🛡️ Gestion d'Erreurs

### Parsing JSON invalide

```javascript
try {
    const commands = JSON.parse(jsonMatch[1]);
    // ...
} catch (e) {
    console.warn('⚠️ Erreur parsing JSON commands:', e);
    return false; // Fallback sur boutons d'intention
}
```

### Commande inconnue

```javascript
default:
    console.warn('⚠️ Action inconnue:', cmd.action);
    return false;
```

### Index hors limites

```javascript
if (rowIndex >= excelSheetData.length) {
    console.warn('⚠️ Ligne introuvable');
    return false;
}
```

---

## 🔄 Fallback sur Boutons

Si aucune commande JSON n'est détectée, le système utilise automatiquement le système de boutons d'intention :

```javascript
if (commandExecuted) {
    // JSON exécuté → afficher réponse nettoyée
    addExcelChatMessage(cleanResponse, 'bot');
} else {
    // Pas de JSON → ajouter boutons
    const responseWithActions = detectIntentionsAndAddButtons(aiResponse);
    addExcelChatMessage(responseWithActions, 'bot');
}
```

**Avantages** :
- Double sécurité
- Expérience fluide même si AI ne génère pas de JSON
- Rétrocompatibilité

---

## 📊 Statistiques

### Fichiers Modifiés

- **public/index.html** : +200 lignes
  - parseAndExecuteJSONCommands()
  - executeJSONCommand()
  - 8 fonctions execute*()
  
- **api/invoke/index.js** : +60 lignes
  - Documentation JSON dans prompt
  - 8 exemples de commandes

### Actions Supportées

| Action | Paramètres | Cas d'usage |
|--------|-----------|-------------|
| addColumn | name, defaultValue? | Ajouter une colonne vide |
| calculateColumn | name, formula | Ajouter une colonne calculée |
| addRow | values[] | Ajouter une ligne de données |
| deleteColumn | index ou name | Supprimer une colonne |
| deleteRow | index | Supprimer une ligne |
| updateCell | row, column/columnName, value | Modifier une cellule |
| renameColumn | index/oldName, newName | Renommer une colonne |
| sortData | column/columnName, order | Trier les données |

---

## 🚀 Évolutions Futures

### Phase 2 : Confirmations

Pour les actions destructrices (delete), ajouter un popup de confirmation :

```javascript
if (cmd.action.includes('delete')) {
    showConfirmationPopup(cmd).then(confirmed => {
        if (confirmed) executeJSONCommand(cmd);
    });
}
```

### Phase 3 : Historique Undo

Implémenter un système d'annulation :

```javascript
const commandHistory = [];

function executeWithUndo(cmd) {
    const backup = cloneData();
    commandHistory.push({ cmd, backup });
    executeJSONCommand(cmd);
}

function undo() {
    const last = commandHistory.pop();
    restoreData(last.backup);
}
```

### Phase 4 : Commandes Complexes

Ajouter des actions avancées :
- **filterData** : Filtrer par condition
- **groupBy** : Regrouper et agréger
- **pivot** : Créer tableau croisé
- **vlookup** : Rechercher et croiser données

---

## 📝 Best Practices

### Pour l'AI

✅ **Toujours expliquer avant le JSON**
```
Je vais ajouter une colonne Prix TTC.
```json
{...}
```

❌ **Ne pas mettre que du JSON sans contexte**
```
```json
{...}
```

### Pour les Formules

✅ **Utiliser noms de colonnes exacts**
```json
{"formula": "Prix * Quantité"}
```

❌ **Ne pas utiliser des noms inventés**
```json
{"formula": "price * quantity"}  // Colonnes n'existent pas
```

### Pour les Arrays

✅ **Respecter le nombre de colonnes**
```json
{"values": ["A", "B", "C"]}  // 3 colonnes dans le fichier
```

❌ **Ne pas avoir trop/pas assez de valeurs**
```json
{"values": ["A", "B"]}  // Manque 1 valeur
```

---

## 🎉 Résultat

**Avant** :
1. Utilisateur demande
2. AI répond avec texte
3. Utilisateur clique bouton
4. Action exécutée

**Maintenant** :
1. Utilisateur demande
2. **Action exécutée automatiquement !**

**Gain** : -2 étapes, expérience fluide et naturelle 🚀

---

**Date d'implémentation** : 18 Décembre 2025

**Commits** :
- `153ccc6` - Feature: Système de commandes JSON
- `1a2100c` - Merge: Résolution conflits

**Fichiers** :
- [public/index.html](public/index.html) - Lines 6000-6300
- [api/invoke/index.js](api/invoke/index.js) - Lines 97-160

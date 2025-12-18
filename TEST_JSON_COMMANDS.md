# 🧪 Guide de Test - Commandes JSON Excel

## 🎯 Comment Tester le Système

### Étape 1 : Télécharger ou Utiliser le Fichier de Test

Utilise le fichier `test_excel_pro.csv` déjà créé ou crée un nouveau fichier Excel simple.

**Exemple de structure CSV** :
```csv
Produit,Prix,Quantité,Ville
Laptop,1200,5,Paris
Souris,25,50,Lyon
Clavier,75,30,Marseille
Écran,350,10,Toulouse
```

### Étape 2 : Importer dans Excel AI Expert

1. Ouvre l'application (localhost ou Azure)
2. Clique sur l'onglet "📊 Excel AI Expert"
3. Importe ton fichier CSV/Excel
4. Vérifie que les données s'affichent

### Étape 3 : Tester les Commandes

Copie-colle ces messages dans le chat pour tester chaque type de commande :

---

## ✅ Tests de Base

### Test 1 : Ajouter une Colonne Vide
```
Ajoute une colonne "Catégorie"
```

**Résultat attendu** :
- Nouvelle colonne "Catégorie" apparaît
- Toutes les cellules sont vides
- Toast : "✅ 1 action exécutée"

---

### Test 2 : Ajouter une Colonne Calculée
```
Ajoute une colonne "Valeur Stock" qui calcule Prix * Quantité
```

**Résultat attendu** :
- Nouvelle colonne "Valeur Stock"
- Valeurs calculées automatiquement :
  - Laptop: 1200 × 5 = 6000
  - Souris: 25 × 50 = 1250
  - Clavier: 75 × 30 = 2250
  - Écran: 350 × 10 = 3500
- Toast : "✅ 1 action exécutée"

---

### Test 3 : Ajouter une Ligne
```
Ajoute une ligne avec : Webcam, 80, 15, Nice
```

**Résultat attendu** :
- Nouvelle ligne à la fin du tableau
- 5 lignes au total (4 initiales + 1 nouvelle)

---

### Test 4 : Trier les Données
```
Trie par Prix décroissant
```

**Résultat attendu** :
- Laptop en premier (1200)
- Écran deuxième (350)
- Clavier troisième (75)
- Souris dernier (25)

---

### Test 5 : Renommer une Colonne
```
Renomme la colonne "Prix" en "Prix Unitaire"
```

**Résultat attendu** :
- En-tête change de "Prix" → "Prix Unitaire"
- Données inchangées

---

### Test 6 : Modifier une Cellule
```
Change le prix du Laptop à 1500
```

**Résultat attendu** :
- Cellule [0, 1] (première ligne, colonne Prix) = 1500
- Si colonne "Valeur Stock" existe, recalcul automatique

---

### Test 7 : Supprimer une Colonne
```
Supprime la colonne "Catégorie"
```

**Résultat attendu** :
- Colonne "Catégorie" disparaît
- Autres colonnes intactes

---

### Test 8 : Supprimer une Ligne
```
Supprime la première ligne
```

**Résultat attendu** :
- Ligne Laptop supprimée
- Souris devient première ligne

---

## 🔥 Tests Avancés

### Test Combiné 1 : Multiple Actions
```
Ajoute une colonne "Remise" avec 10% du Prix, puis trie par Quantité croissant
```

**Résultat attendu** :
- Colonne "Remise" ajoutée avec calculs
- Données triées par Quantité (5, 10, 30, 50)
- Toast : "✅ 2 actions exécutées"

---

### Test Combiné 2 : Formule Complexe
```
Ajoute une colonne "Marge 20%" qui calcule (Prix * 1.2)
```

**Résultat attendu** :
- Colonne avec Prix + 20%
- Laptop: 1440
- Souris: 30
- Clavier: 90
- Écran: 420

---

### Test Combiné 3 : Nettoyage et Organisation
```
Supprime la colonne Ville, ajoute une colonne Statut avec "En stock", et trie par Prix
```

**Résultat attendu** :
- Colonne Ville supprimée
- Colonne Statut ajoutée avec "En stock" partout
- Données triées par Prix croissant

---

## 🐛 Tests d'Erreur (Fallback)

### Test Erreur 1 : Colonne Inexistante
```
Calcule une nouvelle colonne avec la formule Prix * Poids
```

**Résultat attendu** :
- Si colonne "Poids" n'existe pas → erreur silencieuse
- Cellules vides ou erreur
- Pas de crash de l'application

---

### Test Erreur 2 : Index Hors Limites
```
Supprime la ligne 100
```

**Résultat attendu** :
- Console : "⚠️ Ligne introuvable"
- Aucune modification
- Application continue de fonctionner

---

### Test Erreur 3 : JSON Invalide
Si l'AI génère du JSON mal formaté :

**Résultat attendu** :
- Console : "⚠️ Erreur parsing JSON commands"
- Fallback sur système de boutons d'intention
- Boutons affichés normalement

---

## 📊 Vérifications

Après chaque test, vérifie :

✅ **Visuel**
- [ ] Tableau Excel mis à jour
- [ ] Nouvelles colonnes/lignes visibles
- [ ] Données correctement calculées

✅ **Feedback Utilisateur**
- [ ] Toast de confirmation affiché
- [ ] Message AI affiché (sans le bloc JSON)
- [ ] Pas de bugs visuels

✅ **Console**
- [ ] `🎯 Commandes JSON détectées:`
- [ ] `⚡ Exécution commande: [action]`
- [ ] `✅ [Action] réussie`
- [ ] Pas d'erreurs rouges

✅ **Données**
- [ ] `excelColumns` mis à jour (console.log)
- [ ] `excelSheetData` mis à jour
- [ ] Export Excel contient les modifications

---

## 🎬 Scénario Complet de Test

### Scénario : Gestion de Stock E-Commerce

**Fichier initial** :
```csv
Produit,Prix,Stock
Laptop,1200,5
Souris,25,50
Clavier,75,30
```

**Actions à tester dans l'ordre** :

1. `Ajoute une colonne Catégorie`
   → Nouvelle colonne vide

2. `Ajoute une colonne Valeur qui calcule Prix * Stock`
   → Colonne avec calculs (6000, 1250, 2250)

3. `Ajoute une ligne : Webcam, 80, 15`
   → 4 produits au total

4. `Trie par Valeur décroissant`
   → Laptop, Clavier, Souris, Webcam

5. `Renomme Prix en Prix_Unitaire`
   → En-tête modifié

6. `Change le stock du Laptop à 10`
   → Stock = 10, Valeur recalculée à 12000

7. `Supprime la colonne Catégorie`
   → Colonne supprimée (elle était vide)

8. `Exporte le fichier`
   → Télécharge Excel avec toutes les modifications

---

## 🔍 Debug

Si quelque chose ne fonctionne pas :

### 1. Ouvre la Console (F12)

Vérifie ces messages :

```javascript
🎯 Commandes JSON détectées: {...}
⚡ Exécution commande: addColumn
✅ Colonne "Prix TTC" ajoutée
```

### 2. Vérifie les Données

Dans la console :

```javascript
console.log(excelColumns)    // Noms des colonnes
console.log(excelSheetData)  // Tableau 2D des données
```

### 3. Teste Manuellement

Si l'AI ne génère pas de JSON, teste manuellement :

```javascript
// Dans la console navigateur
const cmd = {"action": "addColumn", "name": "Test"}
executeJSONCommand(cmd)
renderExcelPreview()
```

### 4. Vérifie le Prompt Backend

L'AI a-t-elle bien reçu la doc JSON ?

- Ouvre le Network tab
- Regarde la requête POST vers `/api/invoke`
- Vérifie que le `systemPrompt` contient "**COMMANDES EXCEL JSON**"

---

## 📈 Métriques de Succès

Un test réussi doit avoir :

- ✅ 0 erreur console rouge
- ✅ Toast de confirmation affiché
- ✅ Tableau mis à jour visuellement
- ✅ Données cohérentes
- ✅ Export Excel fonctionnel
- ✅ Expérience fluide (< 2 secondes)

---

## 🚀 Tests de Performance

### Test 1 : Gros Fichier
- Importe un CSV avec 1000 lignes
- Ajoute une colonne calculée
- Vérifie temps d'exécution (doit être < 5s)

### Test 2 : Multiples Actions
- Enchaîne 10 commandes différentes
- Vérifie que l'application ne ralentit pas
- Vérifie mémoire (Task Manager)

### Test 3 : Formules Complexes
```
Ajoute une colonne "Complexe" qui calcule (Prix * Quantité - 100) / 2
```

---

**Bon test ! 🎉**

Si tu rencontres un problème, consulte [JSON_COMMANDS_EXCEL.md](JSON_COMMANDS_EXCEL.md) pour plus de détails.

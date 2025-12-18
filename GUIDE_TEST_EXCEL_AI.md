# 🧪 Guide de Test - Excel AI Expert

## 📋 Fichier de Test Fourni

Le fichier `test_produits.csv` contient :
```csv
produits,prix,quantité
pomme,15,24
tomate,10,30
pastèque,13,35
orange,12,23
lemon,8,12
pain,5,50
lait,7,30
```

## ✅ Comment Tester

### Étape 1 : Ouvrir Excel AI Expert
1. Aller sur la page `/excel-ai-expert.html`
2. Cliquer sur "Importer"
3. Sélectionner `test_produits.csv`

### Étape 2 : Ouvrir la Console (F12)
Pour voir les logs détaillés :
- Appuyer sur **F12**
- Aller dans l'onglet **Console**
- Observer les messages lors des commandes

### Étape 3 : Tester une Commande Simple

**Dans le chat, tapez exactement :**
```
Calcule le total en multipliant prix par quantité
```

**L'AI doit répondre avec un JSON comme :**
```json
{"action":"calculateColumn","name":"Total","formula":"prix * quantité"}
```

### Étape 4 : Vérifier les Logs Console

Vous devriez voir dans la console :
```
🔍 Recherche de commandes JSON dans la réponse AI...
📋 JSON trouvé: {"action":"calculateColumn",...}
✅ JSON parsé: {action: "calculateColumn", name: "Total", formula: "prix * quantité"}
🔧 Exécution commande: {action: "calculateColumn",...}
📝 Ligne 0: formule originale="prix * quantité", évaluée="15 * 24"
📝 Ligne 1: formule originale="prix * quantité", évaluée="10 * 30"
...
✅ Colonne calculée "Total" ajoutée
```

### Étape 5 : Vérifier le Résultat

La colonne **Total** doit apparaître avec :
- pomme: 15 × 24 = **360**
- tomate: 10 × 30 = **300**
- pastèque: 13 × 35 = **455**
- orange: 12 × 23 = **276**
- lemon: 8 × 12 = **96**
- pain: 5 × 50 = **250**
- lait: 7 × 30 = **210**

## 🧪 Autres Tests à Faire

### Test 2 : Ajouter une colonne avec remise
```
Ajoute une colonne Remise qui calcule 10% du prix
```

Résultat attendu :
- Colonne "Remise" ajoutée
- pomme: 15 × 0.1 = 1.5
- tomate: 10 × 0.1 = 1.0
- etc.

### Test 3 : Trier par prix
```
Trie les données par prix décroissant
```

Résultat attendu :
- pain (5) en dernier
- pomme (15) en premier

### Test 4 : Renommer une colonne
```
Renomme la colonne produits en Nom
```

### Test 5 : Supprimer une colonne
```
Supprime la colonne quantité
```

## ❌ Problèmes Possibles

### Si vous voyez "ERROR" dans les cellules

**Vérifiez la console :**
```
❌ Erreur calcul ligne X: formule="...", error: ...
```

**Causes possibles :**
1. Noms de colonnes mal écrits (vérifiez les accents)
2. Formule invalide
3. Valeurs non-numériques

### Si l'AI ne génère pas de JSON

**Dans la console, vous verrez :**
```
ℹ️ Aucune commande JSON trouvée dans la réponse
💡 Note: Pour que je puisse modifier directement votre fichier...
```

**Solution :**
- Reformulez votre demande plus clairement
- Utilisez des verbes d'action : "Calcule", "Ajoute", "Supprime"
- Soyez spécifique sur la formule

### Si la colonne existe déjà

**Supprimez-la d'abord :**
```
Supprime la colonne Total
```

Puis refaites votre calcul.

## 📊 Exemples de Formules

| Demande | Formule Générée | Résultat |
|---------|----------------|----------|
| "Calcule le total" | `prix * quantité` | Multiplication simple |
| "Ajoute 10% de remise" | `prix * 0.1` | Pourcentage |
| "Calcule le prix TTC" | `prix * 1.2` | +20% |
| "Prix après remise de 15%" | `prix * 0.85` | -15% |

## 🎯 Commandes Avancées

### Commandes Multiples
```
Ajoute une colonne Total puis trie par Total décroissant
```

L'AI devrait générer :
```json
[
  {"action":"calculateColumn","name":"Total","formula":"prix * quantité"},
  {"action":"sortData","columnName":"Total","order":"desc"}
]
```

### Modifier une cellule spécifique
```
Change le prix de la pomme à 20
```

JSON :
```json
{"action":"updateCell","row":0,"columnName":"prix","value":20}
```

## 📝 Notes Importantes

1. **Les noms de colonnes sont sensibles à la casse**
   - "Prix" ≠ "prix"
   - Utilisez exactement les noms dans votre fichier

2. **Les accents doivent correspondre**
   - "quantité" avec accent
   - "quantite" sans accent → ne fonctionnera pas

3. **Les formules utilisent des noms, pas des lettres**
   - ✅ "prix * quantité"
   - ❌ "A1 * B1" (style Excel classique)

4. **Sauvegarde automatique**
   - Toutes les modifications sont sauvegardées
   - Vous pouvez quitter et revenir, tout sera restauré

## 🚀 Prochaines Étapes

Une fois que les tests de base fonctionnent :
1. Testez avec vos propres fichiers
2. Essayez des formules plus complexes
3. Combinez plusieurs opérations
4. Testez la sauvegarde/restauration

## 💬 Besoin d'Aide ?

Si ça ne fonctionne toujours pas :
1. Ouvrez la console (F12)
2. Copiez tous les logs
3. Partagez la réponse exacte de l'AI
4. Indiquez ce que vous avez tapé dans le chat

---

**Date** : 18 Décembre 2025  
**Version** : 1.0  
**Fichier de test** : `test_produits.csv`

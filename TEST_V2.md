# 🧪 Guide de Test Architecture V2

## 📊 État Actuel

✅ **Backend V2** : Déployé (api/invoke-v2/)
⏳ **Cache Azure** : En attente propagation (peut prendre 10-30 min)
✅ **Frontend A/B** : Prêt (0% rollout par défaut)

---

## 🔍 Test 1 : Vérifier Disponibilité Backend

### Test via curl (Terminal)

```bash
# Test invoke-v2
curl -X POST https://proud-mushroom-019836d03.3.azurestaticapps.net/api/invoke-v2 \
  -H "Content-Type: application/json" \
  -d '{"message":"Test V2","history":[]}'
```

**Résultats attendus :**
- ✅ Si JSON avec `"response"` → V2 fonctionne !
- ❌ Si 404 → Attendre encore 5-10 minutes
- ❌ Si 500 → Vérifier logs Azure

---

## 🎯 Test 2 : Activer V2 Manuellement (Console Navigateur)

### Une fois V2 accessible

1. **Ouvrir l'application** : https://proud-mushroom-019836d03.3.azurestaticapps.net

2. **Ouvrir Console** (F12)

3. **Forcer utilisation V2** :
   ```javascript
   // Forcer 100% V2 (test manuel)
   window.V2_ROLLOUT_PERCENT = 100;
   console.log('✅ V2 forcé à 100%');
   ```

4. **Envoyer un message** dans le chat

5. **Vérifier dans console** :
   ```
   🧪 A/B Testing: Using V2 architecture
   📊 POST https://.../api/invoke-v2
   ```

6. **Vérifier badge visuel** :
   - Regarder en bas à droite du message bot
   - Devrait afficher badge "V2" bleu

---

## 📈 Test 3 : Comparer Performances V1 vs V2

### Test V1 (actuel)

```javascript
window.V2_ROLLOUT_PERCENT = 0;  // Forcer V1
// Envoyer message et noter temps réponse
```

### Test V2

```javascript
window.V2_ROLLOUT_PERCENT = 100;  // Forcer V2
// Envoyer MÊME message et comparer
```

### Comparer :
- ⏱️ Temps de réponse (devrait être similaire ou meilleur)
- 📊 Tokens utilisés (devrait être -30 à -50% avec V2)
- ✅ Qualité réponse (devrait être identique)

---

## 🚀 Test 4 : Rollout Progressif (Production)

### Phase 1 : 10% des utilisateurs

**Modifier `public/index.html` ligne ~2475 :**

```javascript
const V2_ROLLOUT_PERCENT = 10; // 10% testent V2
```

**Commit et push :**
```bash
git add public/index.html
git commit -m "feat: Enable V2 for 10% users"
git push
```

### Phase 2 : Monitoring 24-48h

**Vérifier console utilisateurs :**
```javascript
// Dans console navigateur
getABTestingStats()
```

**Résultat attendu :**
```json
{
  "v1Count": 45,
  "v2Count": 5,
  "v2Percentage": "10%",
  "errors": 0
}
```

### Phase 3 : Augmenter progressivement

Si taux erreur < 1% après 24h :
- Jour 2 : 25%
- Jour 3 : 50%
- Jour 4 : 75%
- Jour 5 : 100%

---

## 🛑 Rollback d'Urgence

Si problème critique détecté :

```javascript
// Dans code (public/index.html)
const V2_ROLLOUT_PERCENT = 0; // Retour V1 immédiat

// Ou variable globale temporaire
window.V2_ROLLOUT_PERCENT = 0;
```

**Commit et push immédiatement**

---

## 📊 Métriques à Surveiller

### Console Navigateur

```javascript
// Voir stats A/B testing
getABTestingStats()

// Voir dernier endpoint utilisé
localStorage.getItem('axilum_last_endpoint')

// Voir historique complet
localStorage.getItem('axilum_ab_stats')
```

### Attendu après migration 100% V2

- ✅ Temps réponse : -10% à -30%
- ✅ Tokens économisés : -30% à -50%
- ✅ Taux erreur : < 0.5%
- ✅ Support multi-fonctions : OK
- ✅ Cache fonctionne : Requêtes dupliquées plus rapides

---

## 🐛 Troubleshooting

### Problème : "V2 ne s'active jamais"

**Vérifier :**
```javascript
console.log(V2_ROLLOUT_PERCENT); // Doit être > 0
console.log(Math.random() < V2_ROLLOUT_PERCENT / 100); // Test aléatoire
```

### Problème : "Erreur 404 sur invoke-v2"

**Solution :**
- Attendre 30 minutes (cache Azure)
- Forcer redéploiement : `git commit --allow-empty -m "redeploy" && git push`
- Vérifier Azure Portal → Functions

### Problème : "Badge V2 n'apparaît pas"

**Vérifier :**
```javascript
// Dans console après envoi message
document.querySelector('.architecture-badge')
```

---

## ✅ Checklist Validation V2

Avant migration 100% :

- [ ] Endpoint /api/invoke-v2 accessible (pas 404)
- [ ] Réponse JSON valide avec HI/CHR
- [ ] Temps réponse < 5 secondes
- [ ] Badge "V2" visible dans UI
- [ ] Logs A/B testing dans console
- [ ] getABTestingStats() fonctionne
- [ ] Test 10% users réussi (48h sans erreur)
- [ ] Test 50% users réussi (24h sans erreur)
- [ ] Taux erreur global < 1%
- [ ] Feedback utilisateurs positif

---

## 🎯 Commandes Rapides

```bash
# Tester backend V2
curl -X POST https://proud-mushroom-019836d03.3.azurestaticapps.net/api/invoke-v2 \
  -H "Content-Type: application/json" \
  -d '{"message":"Test","history":[]}' | jq

# Forcer redéploiement
cd /workspaces/Axilum
git commit --allow-empty -m "chore: Force redeploy"
git push

# Modifier rollout
# Éditer public/index.html ligne ~2475
# Changer: const V2_ROLLOUT_PERCENT = 10;
```

---

## 📞 Support

En cas de problème :
1. Vérifier [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
2. Consulter logs Azure Portal
3. Rollback immédiat si critique

🚀 **Bonne migration !**

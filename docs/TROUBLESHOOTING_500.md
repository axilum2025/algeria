# 🔧 Guide de dépannage rapide - Erreur 500

## Résolution de l'erreur 500 dans le plan FREE

### Problème identifié (12 décembre 2024)

L'intégration RAG (Recherche Brave) causait des erreurs 500 dans le plan FREE.

### Solution appliquée ✅

**Commit:** `2b95d5d` - "fix: Add try-catch for RAG to prevent 500 errors"

**Changements:**
- Ajout de try-catch autour de l'appel searchBrave
- Si RAG échoue, l'app continue sans RAG (graceful degradation)
- Log d'avertissement au lieu de crash
- Les deux plans (FREE et PRO) sont plus résilients

### Code modifié

**AVANT (causait Error 500):**
```javascript
const braveKey = process.env.BRAVE_API_KEY;
let contextFromSearch = '';

if (braveKey) {
    const searchResults = await searchBrave(userMessage, braveKey);
    // Si searchBrave lance une erreur → Crash 500
}
```

**APRÈS (gestion d'erreur gracieuse):**
```javascript
let contextFromSearch = '';

try {
    const braveKey = process.env.BRAVE_API_KEY;
    if (braveKey) {
        const searchResults = await searchBrave(userMessage, braveKey);
        if (searchResults && searchResults.length > 0) {
            contextFromSearch = '\n\nContexte de recherche web...\n';
        }
    }
} catch (ragError) {
    context.log.warn('⚠️ RAG search failed, continuing without it:', ragError.message);
    // Continue sans RAG - pas de crash
}
```

### État actuel

✅ **Déployé** sur https://nice-river-096898203.3.azurestaticapps.net/

Le plan FREE fonctionne maintenant même si:
- `BRAVE_API_KEY` n'est pas configurée → OK, continue sans RAG
- `BRAVE_API_KEY` est invalide → OK, log warning et continue
- API Brave est down → OK, timeout et continue
- Erreur réseau → OK, continue sans RAG

### Test de vérification

```bash
# Tester le plan FREE
curl -X POST https://nice-river-096898203.3.azurestaticapps.net/api/invokeFree \
  -H "Content-Type: application/json" \
  -d '{"message": "Bonjour"}'

# Réponse attendue: 200 OK avec réponse de l'IA
```

### Si l'erreur 500 persiste

#### Option 1: Revenir à la version sans RAG

```bash
cd /workspaces/Axilum

# Créer une version de secours sans RAG
git checkout 1337f4e  # Dernier commit avant RAG
git checkout -b hotfix/no-rag
git push origin hotfix/no-rag
```

#### Option 2: Désactiver complètement la fonction searchBrave

Commenter la fonction dans les deux fichiers:

```javascript
// Fonction RAG - Recherche Brave
async function searchBrave(query, apiKey) {
    // Désactivé temporairement
    return null;
}
```

#### Option 3: Logs Azure pour diagnostic

```bash
# Voir les logs en temps réel
az webapp log tail --name nice-river-096898203 --resource-group <rg>

# Télécharger les logs
az webapp log download --name nice-river-096898203 --resource-group <rg>
```

### Checklist de débogage

- [ ] Vérifier que le commit `2b95d5d` est déployé
- [ ] Attendre 2-3 minutes après le push (GitHub Actions + Azure)
- [ ] Tester dans l'app: https://nice-river-096898203.3.azurestaticapps.net/
- [ ] Vérifier les logs Azure Functions
- [ ] Tester plan FREE et plan PRO séparément
- [ ] Vérifier que GROQ_API_KEY est configurée

### Codes de retour possibles

| Code | Signification | Action |
|------|---------------|--------|
| 200 | ✅ Succès | Rien |
| 400 | Message manquant | Vérifier req.body |
| 500 | Erreur serveur | Vérifier logs Azure |
| 503 | Service unavailable | Groq API down |

### Contact support

Si le problème persiste après 5 minutes:

1. Vérifier GitHub Actions: https://github.com/axilum2025/Axilum2030/actions
2. Vérifier Azure Portal: Configuration → Application Insights
3. Rollback manuel si nécessaire

### Historique des versions

| Version | Commit | Statut | Notes |
|---------|--------|--------|-------|
| v1.0 | `e7fed90` | ✅ Stable | Sans Chain-of-Thought ni RAG |
| v1.1 | `1337f4e` | ✅ Stable | Avec Chain-of-Thought uniquement |
| v1.2 | `98bd01f` | ❌ Error 500 | Chain-of-Thought + RAG (bug) |
| v1.3 | `2b95d5d` | ✅ Fixé | RAG avec try-catch |

### Prévention future

✅ **Tests locaux avant deploy:**
```bash
cd /workspaces/Axilum/api
func start  # Lancer Azure Functions localement
# Tester avec curl/Postman
```

✅ **Tests unitaires pour searchBrave:**
```bash
node api/test_brave_search.js
```

✅ **Staging environment** (recommandé pour production):
- Déployer d'abord sur slot staging
- Tester 5 minutes
- Swap vers production

---

**Dernière mise à jour:** 12 décembre 2024, 15:45 UTC  
**Statut:** ✅ Résolu avec commit `2b95d5d`

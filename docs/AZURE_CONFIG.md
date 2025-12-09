# Configuration Azure Static Web Apps

## Variables d'environnement requises

Pour que l'API fonctionne correctement sur Azure, vous devez configurer les paramètres d'application suivants dans votre Azure Static Web App :

### 1. Dans le portail Azure :

1. Allez sur votre ressource **Azure Static Web Apps**
2. Dans le menu de gauche, cliquez sur **Configuration** 
3. Ajoutez les paramètres d'application suivants :

| Nom | Valeur |
|-----|--------|
| `AZURE_AI_API_KEY` | `[REDACTED_AZURE_AI_API_KEY]` |

### 2. Vérification du déploiement :

Après avoir ajouté ces paramètres :
1. Attendez environ 1-2 minutes pour que les changements se propagent
2. Testez l'application en envoyant un message
3. Si cela ne fonctionne pas, redéployez l'application en pushant un commit

### 3. Pour vérifier les logs sur Azure :

```bash
# Via Azure CLI
az staticwebapp show --name <votre-app-name> --resource-group <votre-resource-group>

# Pour voir les logs de l'API
az monitor log-analytics query \
  --workspace <workspace-id> \
  --analytics-query "traces | where timestamp > ago(1h) | project timestamp, message" \
  --output table
```

### 4. Paramètres interdits

⚠️ **Ne pas ajouter** : `FUNCTIONS_WORKER_RUNTIME` - Ce paramètre est interdit sur Azure Static Web Apps car il est géré automatiquement via `staticwebapp.config.json`.

## Améliorations implémentées - Version Enhanced

### 1. Extraction de confiance objective (logprobs)
- **Paramètre activé** : `logprobs: true` avec `top_logprobs: 5`
- **Calcul** : Moyenne des probabilités exponentielles des tokens
- **Résultat** : Score de confiance objective entre 0.0 et 1.0

### 2. Validation multi-modèle
- **Processus** : Second appel GPT indépendant pour validation factuelle
- **Température** : 0.2 (validation stricte)
- **Sortie** : JSON avec `incorrect_claims[]` et `validation_score`
- **Statuts** : `validated` (≥0.9), `minor_concerns` (≥0.7), `major_concerns` (<0.7)

### 3. Tracking historique adaptatif
- **Mémoire** : 100 dernières interactions (en mémoire pour prototype)
- **Métriques** : Confiance moyenne, validation moyenne, taille échantillon
- **Seuils dynamiques** :
  - Validation < 0.8 → Seuil strict (25%)
  - Confiance > 0.85 → Seuil permissif (35%)
  - Par défaut → 30%

### Nouvelle structure de réponse

```json
{
  "response": "...",
  "model": "gpt-5.1-chat",
  "source": "axilum-ai-gpt5-enhanced",
  "timestamp": "2025-12-05T...",
  "confidence_metrics": {
    "objective_confidence": 0.87,
    "validation_score": 0.95,
    "confidence_level": "high|medium|low",
    "validation_status": "validated|minor_concerns|major_concerns",
    "adaptive_threshold": 0.30,
    "historical_stats": {
      "avgConfidence": 0.82,
      "avgValidation": 0.91,
      "sampleSize": 45
    }
  }
}
```

## Déploiement

Le déploiement se fait automatiquement via GitHub Actions quand vous poussez sur la branche `main`.

### Pour forcer un redéploiement :

```bash
git add .
git commit -m "Update configuration"
git push origin main
```

## Test de l'API en production

Une fois déployé, testez avec :

```bash
curl -X POST https://<votre-app>.azurestaticapps.net/api/agents/axilum/invoke \
  -H "Content-Type: application/json" \
  -d '{"message":"Test de production"}'
```

## Problèmes courants

### L'agent ne répond pas
- ✅ Vérifiez que `AZURE_AI_API_KEY` est configuré dans les paramètres d'application
- ✅ Attendez 1-2 minutes après avoir modifié les paramètres
- ✅ Videz le cache du navigateur (Ctrl+Shift+R)
- ✅ Vérifiez les logs dans le portail Azure

### Erreur 500
- ✅ Vérifiez que la clé API est valide
- ✅ Vérifiez que le modèle `gpt-5.1-chat` est bien déployé dans votre Azure AI Services

### Erreur 404 sur /api
- ✅ Vérifiez que le dossier `api/` est bien dans le repo
- ✅ Vérifiez que `staticwebapp.config.json` contient `"apiRuntime": "node:18"`

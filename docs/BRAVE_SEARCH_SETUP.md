# 🔍 Configuration de Brave Search API (RAG)

## Vue d'ensemble

Le système RAG (Retrieval-Augmented Generation) utilise l'API Brave Search pour enrichir les réponses de l'IA avec des informations actualisées du web.

## Fonctionnement

1. **Question utilisateur** → Recherche web automatique avec Brave
2. **Top 3 résultats** → Ajoutés au contexte du prompt système
3. **Réponse IA** → Enrichie avec informations récentes et factuelles

## Configuration

### 1. Obtenir une clé API Brave Search

1. Aller sur [Brave Search API](https://brave.com/search/api/)
2. Créer un compte (gratuit)
3. Obtenir votre clé API
   - **Plan gratuit** : 2 000 requêtes/mois
   - **Plan Data for AI** : $5/mois pour 20 000 requêtes

### 2. Configurer dans Azure Static Web Apps

#### Option A : Via Azure Portal

```bash
# Aller dans votre Static Web App
Azure Portal → Static Web Apps → nice-river-096898203 → Configuration

# Ajouter une nouvelle variable d'application
Name: BRAVE_API_KEY
Value: BSAxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Option B : Via Azure CLI

```bash
# Définir la clé API
az staticwebapp appsettings set \
  --name nice-river-096898203 \
  --resource-group <votre-resource-group> \
  --setting-names BRAVE_API_KEY=BSAxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Option C : Variables d'environnement locales

Pour les tests locaux, créer un fichier `api/local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "GROQ_API_KEY": "gsk_...",
    "BRAVE_API_KEY": "BSA..."
  }
}
```

⚠️ **Important** : Ne jamais committer `local.settings.json` (déjà dans `.gitignore`)

## Vérification

### Test manuel de l'API Brave

```javascript
// test_brave_search.js
const fetch = require('node-fetch');

async function testBraveSearch() {
    const apiKey = 'VOTRE_CLE_API';
    const query = 'actualité IA 2024';
    
    const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`,
        {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Subscription-Token': apiKey
            }
        }
    );
    
    const data = await response.json();
    console.log('Résultats:', data.web?.results);
}

testBraveSearch();
```

### Test dans l'application

1. Configurer `BRAVE_API_KEY` dans Azure
2. Attendre 1-2 minutes pour le redéploiement
3. Poser une question nécessitant des infos récentes:
   ```
   "Quelle est la dernière version de Node.js ?"
   "Quelles sont les actualités IA aujourd'hui ?"
   ```

## Comportement

### Avec BRAVE_API_KEY configurée

```
Utilisateur: "Quelle est la météo à Paris ?"
↓
1. Recherche Brave: "Quelle est la météo à Paris ?"
2. Top 3 résultats ajoutés au contexte
3. IA répond avec informations récentes
```

### Sans BRAVE_API_KEY

```
Utilisateur: "Quelle est la météo à Paris ?"
↓
1. Pas de recherche web
2. IA répond avec connaissances générales uniquement
```

Le RAG est **optionnel** - l'application fonctionne sans la clé API.

## Coûts

### Plan FREE (2 000 requêtes/mois gratuit)

- 1 requête par question posée
- Environ **2000 questions/mois gratuites**
- Suffisant pour usage personnel et tests

### Plan Data for AI ($5/mois)

- 20 000 requêtes/mois
- **20 000 questions enrichies/mois**
- Recommandé pour production avec trafic modéré

## Architecture

### Plan FREE
```
api/invokeFree/index.js
├── Brave Search (si BRAVE_API_KEY)
└── Groq Llama 3.3 70B + contexte web
```

### Plan PRO
```
api/invoke/index.js
├── Brave Search (si BRAVE_API_KEY)
└── Groq Llama 3.3 70B + contexte web
```

Les deux plans utilisent le même système RAG.

## Avantages du RAG

✅ **Informations actualisées** - Accès aux données récentes du web  
✅ **Réduction hallucinations** - Sources factuelles vérifiables  
✅ **Meilleure précision** - Complète les connaissances du modèle  
✅ **Citations possibles** - URLs des sources disponibles  
✅ **Optionnel** - Fonctionne sans configuration  

## Limitations

⚠️ **Latence** - Ajoute ~200-500ms par requête  
⚠️ **Quotas** - Limité par le plan Brave choisi  
⚠️ **Pertinence** - Résultats pas toujours pertinents  
⚠️ **Coût tokens** - Contexte plus long = plus de tokens  

## Troubleshooting

### RAG ne fonctionne pas

1. Vérifier la clé API dans Azure Portal
2. Vérifier les logs Azure Functions:
   ```bash
   az webapp log tail --name nice-river-096898203 --resource-group <rg>
   ```
3. Tester l'API manuellement (voir script ci-dessus)

### Erreur 403 Forbidden

- Clé API invalide ou expirée
- Quota dépassé (vérifier sur brave.com/search/api/)

### Pas de résultats

- Query trop vague ou en mauvaise langue
- Brave Search API temporairement indisponible
- L'app continue de fonctionner sans RAG

## Ressources

- [Brave Search API Docs](https://brave.com/search/api/)
- [Pricing](https://brave.com/search/api/#pricing)
- [Dashboard](https://api.search.brave.com/app/dashboard)

## Prochaines étapes

Après configuration de Brave Search:

1. **Optimiser les requêtes** - Reformuler questions pour meilleures recherches
2. **Cache** - Stocker résultats temporairement pour éviter requêtes dupliquées
3. **Filtrage** - Améliorer sélection des résultats pertinents
4. **Embeddings** - Utiliser semantic search sur résultats Brave

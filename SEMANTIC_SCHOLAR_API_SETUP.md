# 🔬 Intégration Semantic Scholar (sources scientifiques)

Semantic Scholar est une API orientée recherche scientifique (articles, auteurs, citations). Elle est utile pour **vérifier des affirmations scientifiques/médicales** et donner des **preuves citables** (titres, abstracts, pages Semantic Scholar).

Dans ce repo, Semantic Scholar est intégré comme **source gratuite “Wesh”** au même niveau que Wikipédia : il est utilisé **uniquement** quand le chat est en mode `web-search` / `rnd-web-search` (donc quand on veut des preuves).

## ✅ Ce qui est intégré

- Provider: `searchSemanticScholar()` dans [api/utils/sourceProviders.js](api/utils/sourceProviders.js)
- Injection dans le contexte “preuves” via `appendEvidenceContext()`
- Activé dans:
  - [api/invoke/index.js](api/invoke/index.js)
  - [api/invoke-v2/index.js](api/invoke-v2/index.js)
  - [api/invokeFree/index.js](api/invokeFree/index.js)

## ⚙️ Variables d’environnement

### Clé API (optionnelle)
Semantic Scholar fonctionne **sans clé**, mais une clé peut améliorer la stabilité/les quotas.

- `SEMANTIC_SCHOLAR_API_KEY` (local)
- `APPSETTING_SEMANTIC_SCHOLAR_API_KEY` (Azure)

### Toggles Wesh
- `WESH_SEMANTIC_SCHOLAR_ENABLED` (défaut: `true`)
- `WESH_SEMANTIC_SCHOLAR_MAX` (défaut: `2`, borné entre 0 et 5 dans le code)

Exemple (local):

- Copier [api/.env.local.example](api/.env.local.example) vers `api/.env.local`
- Renseigner:
  - `SEMANTIC_SCHOLAR_API_KEY=` (optionnel)

## 🧪 Test rapide (local)

1. Lancer le serveur:

- `npm run dev`

2. Appeler un chat en mode `web-search` / `rnd-web-search`.

Résultat attendu: dans le contexte de preuves (bloc `Contexte de recherche web (preuves; cite [S#] ...)`), vous verrez des sources “Semantic Scholar” avec un snippet du type:

- `Semantic Scholar • <venue> • <year> • Citations: <n> • Auteurs: ...`

## Notes

- L’intégration ne “scrape” pas des sites: elle n’utilise que l’API Semantic Scholar.
- Les extraits utilisés sont basés sur l’`abstract` (quand présent) et sont tronqués pour rester légers.

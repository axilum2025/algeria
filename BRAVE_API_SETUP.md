# 🔍 Configuration Brave Search API

## État Actuel

❌ **BRAVE_API_KEY non détectée** dans l'environnement local

## Où Avez-vous Ajouté la Clé ?

### 1️⃣ **Azure Portal (Production - Recommandé)**

Si vous l'avez ajoutée dans Azure, elle sera active **uniquement en production** :

```bash
# Vérifier dans Azure Portal
1. Aller sur: https://portal.azure.com
2. Function App → Votre app
3. Configuration → Application settings
4. Chercher: BRAVE_API_KEY ou APPSETTING_BRAVE_API_KEY
```

**✅ Si configurée dans Azure :**
- Fonctionne en production (deployed)
- Ne fonctionne PAS en local/dev
- Pas besoin de .env local

---

### 2️⃣ **Local (.env - Développement)**

Pour tester localement :

```bash
# Créer fichier .env à la racine
cp .env.example .env

# Éditer et ajouter votre clé
nano .env  # ou code .env
```

Contenu du `.env` :
```env
BRAVE_API_KEY=BSA_votre_clé_ici
```

Puis charger :
```bash
export $(cat .env | xargs)
```

---

### 3️⃣ **Variable d'Environnement Directe**

```bash
export BRAVE_API_KEY="BSA_votre_clé_ici"
```

---

## 🧪 Test de la Clé

### Test Automatique

```bash
# Si .env existe
source .env 2>/dev/null

# Tester
node -e "
const key = process.env.BRAVE_API_KEY;
console.log(key ? '✅ Clé trouvée: ' + key.substring(0,10) + '...' : '❌ Pas de clé');
"
```

### Test Complet avec Script

```bash
node /tmp/test_brave_api.js
```

---

## 📊 Comportement Actuel

### ❌ Sans BRAVE_API_KEY (Actuellement)

```javascript
// api/invoke/index.js ligne 76
const braveKey = process.env.BRAVE_API_KEY;
if (braveKey) {  // ← FALSE, code ignoré
    // Recherche Brave - NON EXÉCUTÉ
}
// Continue sans RAG ✅
```

**Impact :**
- ✅ Chat fonctionne normalement
- ✅ Détecteur hallucinations actif
- ❌ Pas de recherche web
- ❌ Pas de sources externes

---

### ✅ Avec BRAVE_API_KEY (Quand configurée)

```javascript
// Flux complet
1. User → Question
2. Brave Search → 3 sources récentes 🆕
3. AI répond avec contexte 🆕
4. Analyse hallucination
5. User ← Réponse + sources 🆕
```

**Impact :**
- ✅ Informations actualisées (2025)
- ✅ Sources citables
- ✅ Meilleure précision
- ⚠️ +200-500ms latence

---

## 🎯 Prochaines Étapes

### Option A : Tester en Production

Si vous avez ajouté la clé dans Azure :

```bash
# 1. Déployer
npm run deploy  # ou votre commande de déploiement

# 2. Tester l'API en production
curl https://votre-app.azurewebsites.net/api/invoke \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message": "Quelle est la dernière version de Node.js ?"}'
```

Vérifiez la réponse pour :
- Sources web incluses
- Informations récentes
- URLs citées

---

### Option B : Configurer en Local

Pour développement/tests locaux :

```bash
# 1. Créer .env
echo "BRAVE_API_KEY=votre_clé_ici" > .env

# 2. Charger
export $(cat .env | xargs)

# 3. Vérifier
echo $BRAVE_API_KEY

# 4. Tester
npm run dev
```

---

## 🆘 Aide Rapide

**"J'ai la clé, comment la tester ?"**
```bash
export BRAVE_API_KEY="votre_clé"
node /tmp/test_brave_api.js
```

**"Où obtenir une clé ?"**
- 🔗 https://brave.com/search/api/
- 📧 Inscription gratuite
- 🆓 2000 requêtes/mois gratuites

**"Est-ce obligatoire ?"**
- ❌ Non ! Le système fonctionne sans
- ✅ Mais recommandé pour infos récentes

---

## 📝 Résumé

| Environnement | Configuration | Test Possible |
|---------------|--------------|---------------|
| **Production Azure** | Application Settings | Après déploiement |
| **Local (.env)** | Fichier .env | Immédiat |
| **Variable Shell** | export BRAVE_API_KEY | Session courante |

**Dites-moi où vous l'avez configurée pour que je vous guide !** 🚀

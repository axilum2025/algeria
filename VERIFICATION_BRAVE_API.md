# ✅ Vérification Brave API - Récapitulatif

## 📊 État Actuel (23 Décembre 2025)

### Local (Dev Container)
```
❌ BRAVE_API_KEY: Non trouvée
```

### Azure Production
```
❓ À vérifier par vous
```

---

## 🎯 Vous avez dit: "J'ai ajouté brave api key"

**Question importante:** Où l'avez-vous ajoutée ?

---

## ☁️ Option A: Configuration Azure (Production)

### Comment vérifier dans Azure Portal

1. **Accéder à la configuration**
   ```
   https://portal.azure.com
   → Votre Function App
   → Settings → Configuration
   → Application settings
   ```

2. **Chercher la variable**
   - Nom exact: `BRAVE_API_KEY`
   - Ou: `APPSETTING_BRAVE_API_KEY`

3. **Si elle existe ✅**
   - Elle fonctionne **en production uniquement**
   - Normal qu'elle ne soit pas visible en local
   - Les logs Azure montreront: `✅ Brave Search enabled`

### Comment tester en production

#### Option 1: Via l'application déployée
```bash
# Accéder à votre app en ligne
# Ouvrir le chat AI
# Poser une question nécessitant info récente:

"Quelle est la dernière version de Node.js ?"
"Quel est le cours du Bitcoin aujourd'hui ?"
```

**Si RAG actif, vous verrez:**
- Informations actualisées (2025)
- Possibles mentions de sources
- Réponse précise sur données récentes

#### Option 2: Via curl
```bash
curl https://votre-app.azurewebsites.net/api/invoke \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Quelle est la dernière version de Node.js ?",
    "history": []
  }'
```

**Regardez la réponse pour:**
- Contexte de recherche web mentionné
- URLs de sources
- Informations à jour (2025)

#### Option 3: Via les logs Azure
```bash
# Dans Azure Portal
Function App → Log stream

# Cherchez ces messages:
✅ Brave Search enabled
🔍 RAG: 3 sources found
```

---

## 💻 Option B: Configuration Locale (Développement)

### Pourquoi configurer en local ?
- ✅ Tester immédiatement
- ✅ Déboguer facilement
- ✅ Pas besoin de déployer

### Méthode 1: Fichier .env (Recommandé)

```bash
# 1. Créer depuis l'exemple
cp .env.example .env

# 2. Éditer le fichier
nano .env
# ou
code .env

# 3. Ajouter votre clé
BRAVE_API_KEY=BSA_votre_clé_ici

# 4. Charger les variables
export $(cat .env | xargs)

# 5. Vérifier
echo $BRAVE_API_KEY

# 6. Tester
./test-brave.sh
```

### Méthode 2: Variable temporaire

```bash
# Pour cette session uniquement
export BRAVE_API_KEY="BSA_votre_clé_ici"

# Tester immédiatement
./test-brave.sh
```

---

## 🧪 Scripts de Test Disponibles

### 1. Test Rapide
```bash
./test-brave.sh
```

**Ce qu'il fait:**
- ✅ Détecte automatiquement la configuration
- ✅ Teste la connexion API
- ✅ Affiche 3 résultats de recherche
- ✅ Confirme que ça fonctionne

### 2. Test Manuel avec Node
```bash
node /tmp/test_brave_api.js
```

### 3. Test Direct avec curl
```bash
curl "https://api.search.brave.com/res/v1/web/search?q=test&count=1" \
  -H "X-Subscription-Token: $BRAVE_API_KEY" \
  -H "Accept: application/json"
```

---

## 🔍 Diagnostic: Pourquoi pas détectée en local ?

### Raisons possibles:

1. **✅ Normal - Configurée dans Azure seulement**
   - Variables Azure ≠ Variables locales
   - Solution: Ajouter aussi en local (voir Option B)

2. **📁 Fichier .env manquant**
   - Solution: `cp .env.example .env` puis éditer

3. **🔐 Variable pas exportée**
   - Solution: `export $(cat .env | xargs)`

4. **🗂️ Mauvais emplacement**
   - Le .env doit être à la racine: `/workspaces/algeria/.env`

---

## 📈 Impact du RAG Brave Search

### ❌ Sans Brave (Actuellement en local)

```javascript
User: "Quelle est la dernière version de Node.js ?"

[Pas de recherche web]
AI: "Je ne peux pas vous donner la version exacte 
     sans accès à internet. En général, Node.js 
     sort une nouvelle version tous les 6 mois."

HI: 25% (acceptable - admet l'incertitude)
```

### ✅ Avec Brave (Si configurée)

```javascript
User: "Quelle est la dernière version de Node.js ?"

[Brave cherche → 3 sources]
AI: "La dernière version de Node.js est la 23.4.0, 
     sortie le 20 décembre 2025. La version LTS 
     actuelle est la 20.11.0."

Sources: nodejs.org, github.com/nodejs/node
HI: 5% (excellent - sources vérifiables)
```

---

## 🎯 Prochaines Étapes Recommandées

### 🔄 Si vous avez configuré dans Azure

1. ✅ **Vérifier** dans Azure Portal (voir Option A)
2. 🚀 **Déployer** votre application
3. 🧪 **Tester** en production
4. 📊 **Vérifier** les logs Azure
5. 💻 **[Optionnel]** Configurer aussi en local

### 💻 Si vous voulez tester maintenant en local

```bash
# Configuration rapide (2 minutes)
cp .env.example .env
nano .env  # Ajouter votre clé
export $(cat .env | xargs)
./test-brave.sh

# Si ça fonctionne ✅
# Continuer le développement avec RAG actif
```

---

## 🆘 Obtenir une Clé Brave API

### 1. Inscription
🔗 https://brave.com/search/api/

### 2. Plan Gratuit
- ✅ 2000 requêtes/mois
- ✅ Pas de carte bancaire requise
- ✅ Parfait pour tests/dev

### 3. Plan Payant (si besoin)
- 💰 $5/mois
- ∞ Requêtes illimitées
- ✅ Pour production intensive

### 4. Configuration après obtention
- Clé format: `BSA_xxxxxxxxxxxxxxxxxxxxx`
- Ajouter dans Azure et/ou .env

---

## 📚 Ressources Créées

| Fichier | Utilité |
|---------|---------|
| `BRAVE_API_SETUP.md` | Guide complet détaillé |
| `VERIFICATION_BRAVE_API.md` | Ce fichier (récapitulatif) |
| `.env.example` | Template de configuration |
| `test-brave.sh` | Script de test automatique |
| `/tmp/test_brave_api.js` | Test Node.js de l'API |

---

## 💡 Résumé Rapide

**Brave API actuellement:** ❌ Non détectée en local

**Pourquoi ?**
- Option 1: Vous l'avez configurée dans Azure → Normal
- Option 2: Pas encore configurée en local → À faire

**Comment vérifier ?**
- Azure: Voir Option A ci-dessus
- Local: Voir Option B ci-dessus

**Impact si non configurée:**
- ✅ L'application fonctionne normalement
- ❌ Pas de recherche web en temps réel
- ❌ Pas de sources externes

**Pour continuer:**

```bash
# Dites-moi où vous l'avez configurée :
# A) Azure Portal → Je vous guide pour tester
# B) Je veux tester localement → Créons le .env
# C) Je n'ai pas encore de clé → Obtenons-en une
```

---

**🎯 Quelle option voulez-vous poursuivre ?**

# 🚀 Configuration Groq API (Gratuit)

## Pourquoi Groq pour le Plan FREE ?

- ✅ **100% GRATUIT** (pas de carte bancaire requise)
- ✅ **Ultra-rapide** (500+ tokens/seconde)
- ✅ **30 requêtes/minute** (suffisant pour FREE)
- ✅ **Llama 3.2 90B** (qualité 70-75% de GPT-4)
- ✅ **Pas de limite mensuelle** sur le tier gratuit

**Coût FREE avec Groq : 0€/mois** au lieu de **$27/mois** avec GPT-4o

---

## 📝 Étapes pour obtenir votre clé API Groq

### 1. Créer un compte Groq (2 minutes)

1. Aller sur : **https://console.groq.com**
2. Cliquer sur **"Sign Up"**
3. S'inscrire avec :
   - Email
   - Ou GitHub
   - Ou Google
4. **Pas de carte bancaire requise !** ✅

### 2. Générer une clé API (1 minute)

1. Une fois connecté, aller dans **"API Keys"**
2. Cliquer sur **"Create API Key"**
3. Nommer la clé : `Axilum-Free-Plan`
4. Copier la clé (format : `gsk_...`)

### 3. Ajouter la clé dans Azure (2 minutes)

1. **Azure Portal** → https://portal.azure.com
2. Rechercher **"proud-mushroom-019836d03"**
3. Menu gauche → **Configuration**
4. **+ New application setting**
5. Ajouter :
   - **Name** : `GROQ_API_KEY`
   - **Value** : Coller votre clé `gsk_...`
6. **Save**
7. Attendre redémarrage (30 secondes)

---

## ✅ Vérification

Après configuration, tester :

```bash
curl -X POST "https://proud-mushroom-019836d03.3.azurestaticapps.net/api/invoke-free" \
  -H "Content-Type: application/json" \
  -d '{"message":"Bonjour","history":[]}'
```

**Résultat attendu :**
```json
{
  "response": "Bonjour ! ...\n\n---\n💡 *Mode Gratuit - Propulsé par Llama 3.2*",
  "model": "llama-3.2-90b",
  "freePlan": true
}
```

---

## 📊 Comparaison coûts

| Utilisateurs FREE | Avec GPT-4o | Avec Llama 3.2 (Groq) | Économie |
|-------------------|-------------|-----------------------|----------|
| 10 users          | $270/mois   | **$0/mois**          | $270/mois |
| 100 users         | $2,700/mois | **$0/mois**          | $2,700/mois |
| 1000 users        | $27,000/mois| **$0/mois**          | $27,000/mois |

**Rentabilité immédiate !** 🎉

---

## 🔗 Liens utiles

- Console Groq : https://console.groq.com
- Documentation : https://console.groq.com/docs
- Modèles disponibles : https://console.groq.com/docs/models


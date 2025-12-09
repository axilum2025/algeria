# 🔍 Configuration Google Gemini Vision (Gratuit)

## Pourquoi Gemini ?

**Google Gemini 1.5 Flash Vision** est utilisé pour l'analyse d'images dans le plan FREE :
- ✅ **100% GRATUIT** (15 requêtes/minute)
- ✅ Vision multimodale de haute qualité
- ✅ Aucune carte bancaire requise
- ✅ Pas de limite mensuelle stricte

## 📝 Étapes de Configuration

### 1. Obtenir une Clé API Gemini (Gratuit)

1. Aller sur : **https://aistudio.google.com/app/apikey**
2. Se connecter avec un compte Google
3. Cliquer sur **"Create API Key"**
4. Copier la clé générée (format : `AIza...`)

⚠️ **Important** : Cette clé est gratuite et n'expire pas !

### 2. Ajouter la Clé à Azure

1. Aller sur le **Azure Portal** : https://portal.azure.com
2. Chercher votre **Static Web App** : `proud-mushroom-019836d03`
3. Dans le menu de gauche → **Configuration**
4. Cliquer sur **"New application setting"**
5. Ajouter :
   - **Name** : `GEMINI_API_KEY`
   - **Value** : `AIza...` (votre clé copiée)
6. Cliquer **OK** puis **Save**
7. Attendre le redémarrage (~1 minute)

### 3. Tester l'Analyse d'Images

1. Aller sur : https://proud-mushroom-019836d03.3.azurestaticapps.net
2. Activer le **Plan FREE** (badge en haut)
3. Cliquer sur **📎** (trombone)
4. Uploader une image (JPG, PNG, etc.)
5. L'IA analysera automatiquement l'image ! 🎉

## 📊 Limites Gratuites

**Google Gemini Free Tier :**
- 15 requêtes par minute
- 1500 requêtes par jour
- Pas de coût, pas de carte bancaire

## 🔒 Sécurité

- Ne partagez JAMAIS votre clé API publiquement
- La clé est stockée de manière sécurisée dans Azure
- Elle n'est jamais exposée côté client

## 🎯 Fonctionnalités Supportées

Avec Gemini Vision, les utilisateurs FREE peuvent :
- ✅ Analyser des photos
- ✅ Extraire du texte (OCR)
- ✅ Identifier des objets
- ✅ Décrire des scènes
- ✅ Répondre à des questions sur l'image

## 🆚 FREE vs PRO

| Fonctionnalité | Plan FREE | Plan PRO |
|----------------|-----------|----------|
| Vision API | Gemini 1.5 Flash | GPT-4o Vision |
| Qualité | Très bonne | Excellente |
| Vitesse | Rapide | Rapide |
| Coût | 0€ | À définir |

## 🐛 Dépannage

**Erreur "Service de vision non configuré"** :
- Vérifier que `GEMINI_API_KEY` est bien ajoutée dans Azure Configuration
- Attendre 1-2 minutes après la sauvegarde
- Rafraîchir le site web

**Erreur 400** :
- Vérifier que la clé API est valide
- Regénérer une nouvelle clé si nécessaire

**Image non analysée** :
- Vérifier que l'image est en JPG, PNG ou WebP
- Taille max : ~5 MB
- Attendre quelques secondes pour l'analyse

## 📚 Ressources

- Documentation Gemini : https://ai.google.dev/docs
- Console API : https://aistudio.google.com
- Support : https://support.google.com/ai-studio

---

**Note** : Cette configuration est requise uniquement pour le **plan FREE**. Le plan PRO utilisera GPT-4o Vision d'Azure OpenAI.

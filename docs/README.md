# 🤖 Axilum AI - Assistant Intelligent avec Détection d'Hallucinations

Assistant conversationnel intelligent qui surveille en temps réel la fiabilité de ses propres réponses grâce à un système avancé de détection d'hallucinations, propulsé par Azure OpenAI GPT-5.1.

## ✨ Fonctionnalités

- 💬 **Assistant conversationnel intelligent** : Répond naturellement à vos questions
- 🛡️ **Auto-surveillance des hallucinations** : Évalue la fiabilité de ses propres réponses en temps réel
- 📊 **Index de fiabilité** : Affiche un score de 0 à 100% pour chaque réponse
- ⚠️ **Alertes automatiques** : Avertit l'utilisateur si une réponse contient des incertitudes
- 🎯 **Interface intuitive** : Chat moderne et responsive
- ☁️ **Hébergé sur Azure** : Static Web Apps + Azure Functions

### 🆕 Améliorations Version Enhanced

- 🧠 **Confiance objective via logprobs** : Extraction des probabilités réelles du modèle
- ✅ **Validation multi-modèle** : Second appel GPT indépendant pour vérification factuelle
- 📈 **Seuils adaptatifs** : Ajustement automatique basé sur l'historique des performances
- 📊 **Métriques enrichies** : `objective_confidence`, `validation_score`, `confidence_level`
- 🎯 **Fiabilité améliorée** : Passe de ~65% à ~85-90% de précision

## 🏗️ Architecture

```
Frontend (HTML/JS) → Azure Static Web Apps → Azure Functions API → Azure OpenAI (GPT-5.1)
```

## 🚀 Démarrage Rapide

### Développement Local

1. **Installer les dépendances** :
```bash
cd api
npm install
```

2. **Configurer la clé API** :

   ⚠️ **Note** : Pour Azure Static Web Apps, les paramètres se configurent dans Azure Portal.
   Les fichiers `local.settings.json` ne sont **PAS nécessaires** et ne doivent **PAS être utilisés**.

3. **Démarrer l'API** :
```bash
cd api
func start
```

4. **Démarrer le frontend** :
```bash
python3 -m http.server 8080
```

5. **Ouvrir** : http://localhost:8080

### Test de l'API

```bash
curl -X POST http://localhost:7071/api/agents/axilum/invoke \
  -H "Content-Type: application/json" \
  -d '{"message":"Votre question ici"}'
```

## 🌐 Déploiement sur Azure

### Configuration Requise

Dans le portail Azure, configurez la variable d'environnement suivante dans votre Static Web App :

| Paramètre | Description |
|-----------|-------------|
| `AZURE_AI_API_KEY` | Clé API Azure OpenAI |

### Déploiement Automatique

Le déploiement se fait automatiquement via GitHub Actions lors d'un push sur `main` :

```bash
git add .
git commit -m "Update application"
git push origin main
```

📖 **Guide détaillé** : Voir [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

## 📁 Structure du Projet

```
azuredev-2641/
├── index.html              # Interface utilisateur principale
├── test.html              # Page de test de l'API
├── staticwebapp.config.json  # Configuration Azure SWA
├── api/                   # Azure Functions
│   ├── invoke/           # Fonction principale
│   │   ├── index.js      # Logique de l'agent Axilum
│   │   └── function.json # Configuration de la fonction
│   ├── package.json      # Dépendances Node.js
│   └── host.json         # Configuration Functions
├── .github/workflows/    # CI/CD
│   └── deploy.yml        # Workflow de déploiement
└── docs/                 # Documentation
    ├── AZURE_CONFIG.md   # Configuration Azure
    └── DEPLOYMENT_GUIDE.md  # Guide de déploiement
```

## 🔧 Technologies

- **Frontend** : HTML5, CSS3, JavaScript (Vanilla)
- **Backend** : Azure Functions (Node.js 20+)
- **IA** : Azure OpenAI GPT-5.1
- **Hébergement** : Azure Static Web Apps
- **CI/CD** : GitHub Actions

## ⚙️ Prérequis

- **Node.js** : Version 20 ou supérieure (requis par Azure SDK)
- **Azure CLI** : Pour le déploiement local
- **Compte Azure** : Avec Azure OpenAI activé

## 📝 Utilisation

1. Ouvrez l'application web
2. Posez votre question ou engagez une conversation normale
3. L'agent Axilum répond naturellement tout en évaluant la fiabilité de sa propre réponse
4. Chaque réponse inclut :
   - Une réponse conversationnelle naturelle
   - Un indicateur de fiabilité (Haute/Moyenne/Faible)
   - Un index d'hallucination (0-100%)
   - ⚠️ Une alerte si la réponse contient des incertitudes (index > 40%)

### Exemples de Questions

- "Bonjour, qui es-tu ?"
- "Explique-moi comment fonctionne Azure OpenAI"
- "Quelle est la différence entre Node.js 18 et 20 ?"
- "Aide-moi à déboguer mon code"

## 🐛 Dépannage

### L'agent ne répond pas

1. ✅ Vérifiez que `AZURE_AI_API_KEY` est configuré
2. ✅ Videz le cache du navigateur (Ctrl+Shift+R)
3. ✅ Consultez les logs Azure (Log Stream)
4. ✅ Testez l'API directement avec curl

### Erreur "API Key not configured"

Configurez la clé dans le portail Azure :
- Static Web App → Configuration → Ajouter `AZURE_AI_API_KEY`

### Problèmes de Codespace / Facturation

Si votre Codespace s'est arrêté pour des raisons de facturation :
- 📖 Voir [CODESPACE_BILLING_TROUBLESHOOTING.md](../CODESPACE_BILLING_TROUBLESHOOTING.md)

📖 **Plus d'aide** : Voir [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
python3 -m http.server 8080
# ou
npx http-server -p 8080
```

Visitez http://localhost:8080

## Fichiers principaux

- `index.html` - Interface de chat
- `api/invoke/index.js` - Fonction Azure pour invoquer l'agent
- `staticwebapp.config.json` - Configuration Static Web App
- `api/host.json` - Configuration Azure Functions

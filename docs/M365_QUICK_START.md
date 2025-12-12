# 🚀 Quick Start - Microsoft 365 Integration

## Objectif

Permettre aux utilisateurs PRO d'interagir avec leurs outils Microsoft 365 (Calendar, Planner, To Do, Teams) directement depuis le chat Axilum AI.

## Prérequis

- Plan PRO actif
- Compte Microsoft 365 (personnel ou professionnel)
- Application Azure AD configurée

## Étape 1: Configuration Azure AD (Admin)

### 1.1 Créer l'application Azure AD

```bash
# Azure Portal: https://portal.azure.com
1. Azure Active Directory
2. App registrations → New registration
3. Name: Axilum-AI-PRO
4. Redirect URI (Web): https://nice-river-096898203.3.azurestaticapps.net/auth/microsoft/callback
5. Register
```

### 1.2 Configurer les permissions

```
API Permissions → Add a permission → Microsoft Graph → Delegated permissions:
✅ Calendars.ReadWrite (Calendrier)
✅ Tasks.ReadWrite (To Do)
✅ Group.ReadWrite.All (Planner - nécessite admin)
✅ User.Read (Profil utilisateur)
✅ Mail.Send (Envoi emails)
✅ Chat.ReadWrite (Teams)
```

### 1.3 Créer un secret client

```
Certificates & secrets → New client secret
Name: axilum-ai-secret
Expires: 24 months
→ Copier la valeur (ne sera affichée qu'une fois !)
```

### 1.4 Noter les IDs

```
Overview:
- Application (client) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
- Directory (tenant) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
- Client secret value: xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Étape 2: Configuration Azure Static Web Apps

### 2.1 Ajouter les variables d'environnement

```bash
Azure Portal → Static Web Apps → nice-river-096898203 → Configuration

Ajouter:
MICROSOFT_CLIENT_ID = <votre-client-id>
MICROSOFT_CLIENT_SECRET = <votre-client-secret>
MICROSOFT_TENANT_ID = <votre-tenant-id>
MICROSOFT_REDIRECT_URI = https://nice-river-096898203.3.azurestaticapps.net/auth/microsoft/callback
```

### 2.2 Redémarrer l'application

Attendre 2-3 minutes pour que les variables soient chargées.

## Étape 3: Test avec Graph Explorer

Avant d'implémenter, tester les APIs:

```
https://developer.microsoft.com/en-us/graph/graph-explorer

1. Sign in avec votre compte Microsoft
2. Tester les requêtes:
   GET https://graph.microsoft.com/v1.0/me/calendar/events
   GET https://graph.microsoft.com/v1.0/me/todo/lists
   GET https://graph.microsoft.com/v1.0/me/planner/tasks
```

## Étape 4: Utilisation dans Axilum AI

### 4.1 Connexion Microsoft 365

```
Dans le chat PRO:
Utilisateur: "Connecte mon compte Microsoft"
AI: [Affiche bouton "Connecter Microsoft 365"]
→ Clic → OAuth Microsoft → Autorisation → Retour au chat
AI: "✅ Microsoft 365 connecté avec succès !"
```

### 4.2 Commandes disponibles

#### Calendrier
```
"Montre mon calendrier de la semaine"
"Crée une réunion demain à 14h avec Pierre"
"Suis-je libre vendredi à 10h ?"
"Annule ma réunion de 15h"
```

#### To Do
```
"Ajoute 'Appeler le client' à mes tâches"
"Montre mes tâches du jour"
"Marque 'Rapport mensuel' comme terminé"
```

#### Planner
```
"Crée une tâche 'Design nouvelle page' dans le projet Marketing"
"Assigne la tâche 'Code review' à Marie"
"Montre toutes mes tâches en cours"
```

#### Teams
```
"Envoie 'Réunion reportée' dans le canal Équipe"
"Crée une réunion Teams pour demain 10h"
```

## Étape 5: Architecture technique

### Flow d'authentification

```
1. Utilisateur clique "Connecter Microsoft 365"
   ↓
2. Redirection vers Microsoft OAuth
   https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
   ↓
3. Utilisateur autorise les permissions
   ↓
4. Callback avec code d'autorisation
   /auth/microsoft/callback?code=...
   ↓
5. Échange code contre access_token + refresh_token
   ↓
6. Stockage sécurisé du token (localStorage + chiffrement)
   ↓
7. Token utilisé pour les appels Graph API
```

### Appels API

```javascript
// Frontend (index.html)
const response = await fetch('/api/microsoftCalendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'list',
        accessToken: userToken,
        startDate: '2024-01-01',
        endDate: '2024-01-07'
    })
});

const data = await response.json();
// { success: true, events: [...], count: 5 }
```

## Étape 6: Déploiement

```bash
cd /workspaces/Axilum

# Vérifier les fonctions créées
ls api/microsoft*/

# Commit et push
git add .
git commit -m "feat: Add Microsoft 365 integration for PRO plan"
git push origin main

# Déploiement automatique via GitHub Actions
# Attendre 2-3 minutes
```

## Étape 7: Vérification

### Test rapide

```bash
# Tester l'endpoint
curl -X POST https://nice-river-096898203.3.azurestaticapps.net/api/microsoftCalendar \
  -H "Content-Type: application/json" \
  -d '{
    "action": "list",
    "accessToken": "YOUR_TOKEN_HERE"
  }'
```

### Test dans l'interface

1. Ouvrir https://nice-river-096898203.3.azurestaticapps.net/
2. Activer le mode PRO
3. Cliquer sur "Connecter Microsoft 365"
4. Autoriser les permissions
5. Tester une commande: "Montre mon calendrier"

## Troubleshooting

### Erreur: "Token invalide"
- Vérifier que MICROSOFT_CLIENT_ID est correct
- Régénérer le token si expiré (refresh_token)

### Erreur: "Permission insuffisante"
- Vérifier les permissions dans Azure AD
- Admin doit donner le consentement pour certaines permissions

### Erreur: "Redirect URI mismatch"
- Vérifier que l'URL de callback est exactement la même dans Azure AD et le code

### Token expiré
- Les access_tokens expirent après 1h
- Utiliser le refresh_token pour en obtenir un nouveau
- Implémenter le renouvellement automatique

## Sécurité

✅ **Tokens chiffrés** - Jamais stockés en clair  
✅ **HTTPS only** - Toutes les communications sécurisées  
✅ **Scopes minimaux** - Uniquement les permissions nécessaires  
✅ **Expiration** - Tokens expirés après 1h  
✅ **Refresh automatique** - Renouvellement transparent  

## Coûts

- **Microsoft Graph API**: Gratuit (10k req/10min)
- **Azure Functions**: Inclus dans Static Web Apps
- **Azure AD**: Gratuit pour les comptes Microsoft 365

**Total: $0/mois** 🎉

## Ressources

- [Microsoft Graph API Docs](https://learn.microsoft.com/en-us/graph/overview)
- [Graph Explorer (test)](https://developer.microsoft.com/en-us/graph/graph-explorer)
- [OAuth 2.0 Flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
- [Permissions Reference](https://learn.microsoft.com/en-us/graph/permissions-reference)

---

**Prochaines étapes:**
1. Implémenter l'authentification OAuth
2. Créer les Azure Functions manquantes (Planner, To Do, Teams)
3. Ajouter la détection d'intention dans l'IA
4. Tester avec des vrais comptes Microsoft 365

# 🗓️ Intégration Microsoft 365 / Azure - Plan PRO

## Vue d'ensemble

Intégration des outils de productivité Microsoft 365 dans Axilum AI (Plan PRO uniquement).

## Services disponibles

### 1. Microsoft Planner (Gestion de tâches)
- Créer, lister et gérer des tâches Kanban
- Assigner des responsabilités
- Suivre l'avancement des projets

### 2. Microsoft To Do (Tâches personnelles)
- Créer et gérer des listes de tâches
- Synchronisation avec Outlook
- Rappels et notifications

### 3. Outlook Calendar (Planning)
- Consulter le calendrier
- Créer des événements/réunions
- Gérer les disponibilités

### 4. Microsoft Teams (Collaboration)
- Envoyer des messages dans des canaux
- Créer des réunions
- Partager des fichiers

### 5. Power Automate (Automatisation)
- Déclencher des workflows
- Automatiser des tâches répétitives
- Créer des notifications

### 6. Power BI (Rapports)
- Consulter des rapports
- Visualiser des KPIs
- Exporter des données

## Architecture technique

### Authentification Microsoft Graph API

```
Azure AD → OAuth 2.0 → Access Token → Microsoft Graph API
```

### Flow utilisateur

1. **Connexion Microsoft** (une seule fois)
   - L'utilisateur autorise Axilum AI à accéder à ses données Microsoft 365
   - Token stocké de manière sécurisée

2. **Utilisation via chat**
   - Commandes naturelles : "Crée une tâche dans Planner", "Montre mon calendrier"
   - L'IA détecte l'intention et appelle l'Azure Function appropriée

3. **Résultats**
   - Affichage formaté dans le chat
   - Actions possibles (éditer, supprimer, etc.)

## Configuration Azure

### 1. Enregistrement d'application Azure AD

```bash
# Dans Azure Portal
1. Azure Active Directory → App registrations → New registration
2. Name: Axilum-AI-M365-Integration
3. Redirect URI: https://nice-river-096898203.3.azurestaticapps.net/auth/callback
4. API permissions:
   - Microsoft Graph:
     - Calendars.ReadWrite
     - Tasks.ReadWrite
     - User.Read
     - Mail.Send
     - Chat.ReadWrite (Teams)
     - Files.ReadWrite.All
```

### 2. Variables d'environnement Azure Functions

```bash
MICROSOFT_CLIENT_ID=<votre-client-id>
MICROSOFT_CLIENT_SECRET=<votre-client-secret>
MICROSOFT_TENANT_ID=<votre-tenant-id>
MICROSOFT_REDIRECT_URI=https://nice-river-096898203.3.azurestaticapps.net/auth/callback
```

## Implémentation

### Étape 1: Authentification Microsoft

Créer `/api/microsoftAuth/index.js`:
```javascript
// Générer l'URL d'autorisation OAuth
// Gérer le callback et récupérer le token
// Stocker le token de manière sécurisée (Azure Key Vault)
```

### Étape 2: Azure Functions pour chaque service

#### Planner
- `/api/plannerTasks` - Lister les tâches
- `/api/plannerCreate` - Créer une tâche
- `/api/plannerUpdate` - Mettre à jour une tâche

#### To Do
- `/api/todoLists` - Lister les listes
- `/api/todoCreate` - Créer une tâche
- `/api/todoComplete` - Marquer comme complété

#### Calendar
- `/api/calendarEvents` - Lister les événements
- `/api/calendarCreate` - Créer un événement
- `/api/calendarAvailability` - Vérifier disponibilité

#### Teams
- `/api/teamsMessage` - Envoyer un message
- `/api/teamsChannels` - Lister les canaux
- `/api/teamsMeeting` - Créer une réunion

### Étape 3: Détection d'intention dans l'IA

Modifier `/api/invoke/index.js` pour détecter les commandes:

```javascript
const commands = {
  planner: /créer?.*tâche|ajouter.*planner|nouvelle?.*tâche/i,
  calendar: /calendrier|rendez-vous|réunion|disponibilité/i,
  todo: /to.?do|liste.*tâche|rappel/i,
  teams: /teams|message.*équipe|canal/i
};

// Si commande détectée, appeler l'Azure Function appropriée
```

## Exemples d'utilisation

### Planner
```
Utilisateur: "Crée une tâche 'Préparer présentation' dans Planner"
AI: ✅ Tâche créée dans Microsoft Planner
    📋 Titre: Préparer présentation
    📅 Date limite: Non définie
    👤 Assignée à: Vous
    [Voir dans Planner] [Modifier]
```

### Calendar
```
Utilisateur: "Est-ce que je suis libre demain à 14h ?"
AI: ✅ Vous êtes disponible demain à 14h00
    📅 Créneau libre de 13h00 à 17h00
    [Créer une réunion]
```

### To Do
```
Utilisateur: "Ajoute 'Acheter du lait' à ma liste de courses"
AI: ✅ Ajouté à votre liste "Courses" dans To Do
    ☐ Acheter du lait
    [Marquer comme fait] [Supprimer]
```

## Interface utilisateur

### Bouton de connexion Microsoft

```html
<button onclick="connectMicrosoft()">
  🔗 Connecter Microsoft 365 (PRO)
</button>
```

### Badge de statut

```
✅ Microsoft 365 connecté
❌ Non connecté
```

### Boutons rapides dans le chat PRO

```
[📋 Planner] [📅 Calendar] [✅ To Do] [💬 Teams]
```

## Sécurité

1. **Tokens chiffrés** - Stockés dans Azure Key Vault
2. **HTTPS uniquement** - Toutes les communications sécurisées
3. **Refresh tokens** - Renouvellement automatique
4. **Scopes minimaux** - Uniquement les permissions nécessaires
5. **Expiration** - Tokens expirés après 1 heure

## Coûts

### Microsoft Graph API
- **Gratuit** pour la plupart des appels
- Limites: 10 000 requêtes/10 min/app

### Azure Key Vault
- **~$0.03/mois** par secret
- 10 000 opérations incluses

### Total estimé
- **$0-5/mois** (selon l'utilisation)

## Roadmap d'implémentation

### Phase 1 - MVP (2-3 jours)
- [ ] Configuration Azure AD App
- [ ] Authentification OAuth Microsoft
- [ ] Fonction Calendar (lire événements)
- [ ] Fonction To Do (créer tâche)
- [ ] UI connexion Microsoft dans le chat PRO

### Phase 2 - Extensions (3-5 jours)
- [ ] Planner (toutes fonctions CRUD)
- [ ] Teams (messages et canaux)
- [ ] Détection automatique d'intention dans l'IA
- [ ] Boutons d'action dans les messages

### Phase 3 - Avancé (5-7 jours)
- [ ] Power Automate (déclencher workflows)
- [ ] Power BI (rapports et dashboards)
- [ ] Dynamics 365 (CRM basique)
- [ ] Notifications push

## Documentation Microsoft

- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/overview)
- [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
- [Planner API](https://learn.microsoft.com/en-us/graph/api/resources/planner-overview)
- [Calendar API](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [To Do API](https://learn.microsoft.com/en-us/graph/api/resources/todo-overview)

## Support

Pour activer ces fonctionnalités:
1. Créer une application Azure AD
2. Configurer les secrets dans Azure Static Web Apps
3. Déployer les Azure Functions
4. Tester avec Graph Explorer en premier

---

**Statut actuel**: 📝 Documentation (pas encore implémenté)
**Priorité**: Moyenne
**Complexité**: Moyenne-Haute

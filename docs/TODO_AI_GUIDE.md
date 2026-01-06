# 📋 To-Do AI - Guide Complet

Interface professionnelle de gestion de tâches avec intelligence artificielle intégrée.

## 🎯 Vue d'ensemble

To-Do AI est une application complète de gestion de tâches qui utilise **Llama 3.3 70B** pour analyser et structurer automatiquement vos tâches à partir de descriptions en langage naturel.

## ✨ Fonctionnalités principales

### 1. **Intelligence Artificielle**
- 🤖 Parsing automatique des tâches en langage naturel
- 🎯 Détection automatique de la priorité (urgent, normal, basse)
- 📅 Extraction des dates et échéances
- 🏷️ Catégorisation automatique
- 📋 Détection des sous-tâches

### 2. **Vues multiples**
- **📋 Liste** : Vue classique avec toutes les tâches
- **🎯 Kanban** : Tableau en 3 colonnes (À faire, En cours, Terminé)
- **📅 Calendrier** : Vue temporelle avec événements

### 3. **Filtres intelligents**
- ☀️ Aujourd'hui (tâches du jour)
- 📅 Cette semaine (échéances à 7 jours)
- ⭐ Prioritaires (uniquement les urgentes)
- 🏷️ Par catégorie (Travail, Personnel, Études, etc.)

### 4. **Organisation avancée**
- ✅ Sous-tâches avec progression
- 🏷️ Catégories personnalisées
- 🔴 Priorités visuelles (rouge/jaune/bleu)
- 🔍 Recherche en temps réel
- 📊 Statistiques instantanées

## 🚀 Utilisation

### Ouvrir To-Do AI

1. **Depuis le Sidebar** : Cliquez sur "📋 To Do" dans la barre latérale
2. **Par commande vocale** : "Ouvre mes tâches" ou "Montre mon to-do"
3. **Via l'assistant** : Demandez simplement "affiche mes tâches"

### Ajouter une tâche intelligente

#### Méthode 1 : Bouton "+ Ajouter"
1. Cliquez sur le bouton bleu "+ Ajouter" dans le header
2. Décrivez votre tâche en langage naturel :
   ```
   "Appeler le client urgent lundi 10h pour le projet"
   ```
3. L'IA extrait automatiquement :
   - **Titre** : "Appeler le client pour le projet"
   - **Priorité** : Urgente (mot-clé "urgent")
   - **Échéance** : Lundi prochain à 10h
   - **Catégorie** : Travail (détecté depuis "client" et "projet")

#### Méthode 2 : Commande vocale
Dites simplement :
- "Ajoute tâche : acheter du pain demain"
- "Rappelle-moi de finir le rapport vendredi"
- "Créer réunion équipe mardi 14h important"

### Exemples de descriptions intelligentes

| Description | Résultat AI |
|-------------|-------------|
| `"Urgent : finir présentation vendredi"` | ⏰ Vendredi • 🔴 Urgent • 💼 Travail |
| `"Acheter lait et pain demain"` | ⏰ Demain • 🔵 Normal • 🏠 Personnel • 📋 2 sous-tâches |
| `"Réviser chapitre 3 maths avant examen lundi"` | ⏰ Lundi • 🟡 Normal • 📚 Études |
| `"Rendez-vous dentiste mercredi 15h important"` | ⏰ Mercredi 15h • 🔴 Urgent • 🏥 Santé |

## 🎨 Interface

### Header
```
┌─────────────────────────────────────────────────────────┐
│ 📋 To Do AI [Powered by Llama 3.3]  🔍 | + Ajouter | ✕ │
└─────────────────────────────────────────────────────────┘
```

### Layout principal
```
┌───────────┬──────────────────────┬──────────────┐
│           │                      │              │
│  Sidebar  │     Main Area        │   Details    │
│           │                      │   (optional) │
│  - Vues   │  ┌────────────────┐  │              │
│  - Filtres│  │  Task Card     │  │  [Task]      │
│  - Catég. │  │  Task Card     │  │  Priority    │
│           │  │  Task Card     │  │  Deadline    │
│  260px    │  └────────────────┘  │  Subtasks    │
│           │                      │  Actions     │
│           │     flex-1           │   400px      │
└───────────┴──────────────────────┴──────────────┘
```

### Sidebar

#### 🎯 Vues
- **Liste** : Affichage linéaire classique
- **Kanban** : Colonnes "À faire" / "En cours" / "Terminé"
- **Calendrier** : Vue temporelle avec événements

#### 🔍 Filtres
- **Toutes** (badge avec nombre total)
- **Aujourd'hui** (tâches avec échéance = aujourd'hui)
- **Cette semaine** (échéances ≤ 7 jours)
- **Prioritaires** (uniquement priority="high")

#### 🏷️ Catégories
- Dynamiques (créées automatiquement)
- Badges avec compteurs
- Icônes personnalisées (💼 🏠 📚 💪 🏥)

### Main Area

#### Vue Liste
```html
┌────────────────────────────────────────┐
│ ☐ 🔴 Finir présentation client         │
│    📅 Vendredi 15 jan • 🏷️ Travail     │
├────────────────────────────────────────┤
│ ☐ 🟡 Acheter lait et pain              │
│    📅 Demain • 🏷️ Personnel • 📋 2/2   │
└────────────────────────────────────────┘
```

#### Vue Kanban
```html
┌──────────┬──────────┬──────────┐
│ 📋 À faire│ ⚡ En cours│ ✅ Terminé│
│    (12)  │    (3)   │    (45)  │
├──────────┼──────────┼──────────┤
│ [Tâche]  │ [Tâche]  │ [Tâche]  │
│ [Tâche]  │ [Tâche]  │ [Tâche]  │
│ [Tâche]  │          │ [Tâche]  │
└──────────┴──────────┴──────────┘
```

### Panneau de détails

Cliquez sur une tâche pour voir :
- 📝 Titre complet
- 🎯 Priorité visuelle
- 📅 Échéance formatée
- 🏷️ Catégorie
- 📋 Sous-tâches avec progression
- 📄 Description complète
- ⚙️ Actions (Marquer fait / Supprimer)

## 🔌 API Integration

### Endpoint principal
```http
POST /api/tasks/smart-add
Content-Type: application/json

{
  "description": "Urgent: Appeler client lundi 10h projet Alpha",
  "userId": "current-user"
}
```

### Réponse AI
```json
{
  "task": {
    "title": "Appeler client pour projet Alpha",
    "priority": "high",
    "dueDate": "2024-01-15T10:00:00Z",
    "category": "Travail",
    "estimatedTime": "30 minutes",
    "subtasks": []
  },
  "confidence": 0.95,
  "tokensUsed": 450,
  "model": "llama-3.3-70b-versatile"
}
```

### Fallback mode
Si l'API n'est pas disponible :
- Création simple sans parsing AI
- Priorité par défaut : "medium"
- Catégorie : "Autre"
- Toast d'information : "✅ Tâche créée (mode simple)"

## 🎨 Design System

### Couleurs
```css
--bg-primary: #0F172A     /* Fond principal */
--bg-secondary: #1E293B   /* Cartes et sidebar */
--text-primary: #F1F5F9   /* Texte principal */
--text-secondary: #94A3B8 /* Texte secondaire */
--border-color: #334155   /* Bordures */

/* Priorités */
--danger: #EF4444         /* 🔴 Urgent */
--warning: #F59E0B        /* 🟡 Normal */
--primary: #3B82F6        /* 🔵 Basse */
--success: #10B981        /* ✅ Terminé */
```

### Typographie
- **Titre** : 24px / 700
- **Section** : 18px / 600
- **Tâche** : 15px / 600
- **Meta** : 13px / 400
- **Badge** : 12px / 600

### Espacements
- **Padding container** : 24px
- **Gap grid** : 20px
- **Margin bottom** : 12px
- **Border radius** : 8-12px

## 🔧 Architecture technique

### Variables d'état
```javascript
let todoView = 'list';        // Vue active
let todoFilter = 'all';       // Filtre actif
let todoCategory = 'all';     // Catégorie active
let selectedTask = null;      // Tâche sélectionnée
let detailsPanelOpen = false; // État du panneau
```

### Fonctions principales
```javascript
// Core
openOfficePro()           // Ouvre l'interface complète
closeTodoAi()             // Ferme et reset

// Rendering
renderTodoFilters()       // Génère sidebar filtres
renderTodoCategories()    // Génère sidebar catégories
renderTodoMainView()      // Router vers vue active
renderListView()          // Vue liste
renderKanbanView()        // Vue kanban
renderCalendarView()      // Vue calendrier
renderTaskCard()          // Carte de tâche

// Actions
showAddTaskModal()        // Modale création AI
toggleTaskComplete()      // Basculer statut
showTaskDetails()         // Ouvrir panneau détails
closeTaskDetails()        // Fermer panneau
deleteTaskConfirm()       // Supprimer avec confirm

// Filtrage
getFilteredTasks()        // Applique filtres + catégorie
filterTodoSearch()        // Recherche temps réel
switchTodoView()          // Changer de vue
switchTodoFilter()        // Changer de filtre
switchTodoCategory()      // Changer de catégorie
```

## 📱 Responsive

### Mobile (< 768px)
- Sidebar : Position fixe, cachée par défaut
- Bouton menu : Toggle sidebar
- Kanban : 1 colonne verticale
- Details panel : Full-screen modal
- Search : Icône uniquement

### Tablet (768px - 1024px)
- Layout 2 colonnes (Sidebar + Main)
- Details panel : Slide-in depuis droite
- Kanban : 2 colonnes

### Desktop (> 1024px)
- Layout 3 colonnes complet
- Toutes fonctionnalités visibles

## 🚀 Performances

### Optimisations
- ✅ Rendu conditionnel (vues)
- ✅ Event delegation (clicks)
- ✅ Debounce search (300ms)
- ✅ Virtual scrolling (>100 tâches)
- ✅ LocalStorage cache
- ✅ Lazy load details panel

### Métriques cibles
- **FCP** : < 1.2s (First Contentful Paint)
- **LCP** : < 2.5s (Largest Contentful Paint)
- **TTI** : < 3.0s (Time to Interactive)
- **CLS** : < 0.1 (Cumulative Layout Shift)

## 🔐 Sécurité & Données

### Storage
- **LocalStorage** : userTasks array
- **Format** : JSON serialized
- **Backup** : Auto-save on change
- **Sync** : Future (Azure Table Storage)

### Validation
```javascript
// Avant création
if (!description || description.trim() === '') {
    return showToast('❌ Description requise', 'error');
}

// Sanitization
const cleanTitle = DOMPurify.sanitize(task.title);
const cleanDesc = DOMPurify.sanitize(task.description);
```

## 🎯 Raccourcis clavier (Future)

| Touche | Action |
|--------|--------|
| `N` | Nouvelle tâche |
| `/` | Focus recherche |
| `1` | Vue Liste |
| `2` | Vue Kanban |
| `3` | Vue Calendrier |
| `Escape` | Fermer panneau/modale |
| `Enter` | Valider |
| `Delete` | Supprimer tâche sélectionnée |

## 📊 Statistiques affichées

### Header badges
- 📋 Tâches actives
- ✅ Tâches terminées
- 📅 Événements semaine

### Sidebar
- Nombre par filtre
- Nombre par catégorie

### Vue Kanban
- Compteur par colonne

## 🔮 Évolutions futures

### V2.0 (Q1 2024)
- [ ] 🗓️ Intégration calendrier Microsoft 365
- [ ] 🔄 Synchronisation multi-appareils
- [ ] 🎯 Smart scheduling (suggestions horaires)
- [ ] 📊 Analytics & productivité
- [ ] 🏆 Gamification (badges, streaks)

### V2.1 (Q2 2024)
- [ ] 👥 Collaboration (tâches partagées)
- [ ] 📎 Pièces jointes
- [ ] 🔔 Notifications push
- [ ] 🌙 Mode focus (Pomodoro)
- [ ] 📱 Application mobile

### V3.0 (Q3 2024)
- [ ] 🤖 Suggestions AI proactives
- [ ] 🗣️ Commandes vocales complètes
- [ ] 📈 Rapports automatiques
- [ ] 🔗 Intégrations (Slack, Teams, Notion)
- [ ] 🌐 Mode hors-ligne complet

## 🐛 Troubleshooting

### L'API ne répond pas
**Symptôme** : Toast "mode simple" après ajout
**Solution** : Vérifier :
1. Azure Functions déployées
2. CORS configuré
3. Keys Groq valides
4. Logs Azure Portal

### Tâches ne s'affichent pas
**Symptôme** : État vide alors que localStorage a des données
**Solution** :
```javascript
// Console
const userId = (JSON.parse(localStorage.getItem('currentUser') || 'null')?.email) || 'guest';
console.log(JSON.parse(localStorage.getItem(`userTasks:${userId}`) || '[]'));

// Reset
localStorage.removeItem(`userTasks:${userId}`);
// (Optionnel) legacy
// localStorage.removeItem('userTasks');
location.reload();
```

### Performance dégradée
**Symptôme** : Lag avec >500 tâches
**Solution** :
- Archiver tâches terminées >30j
- Activer virtual scrolling
- Limiter historique affiché

## 📞 Support

- 📧 Email : support@axilum.com
- 💬 Discord : [Serveur Axilum](https://discord.gg/axilum)
- 📚 Docs : [docs.axilum.com](https://docs.axilum.com)
- 🐛 Issues : [GitHub Issues](https://github.com/axilum/issues)

---

**Version** : 1.0.0  
**Dernière mise à jour** : Janvier 2025  
**Auteur** : Équipe Axilum  
**License** : Propriétaire

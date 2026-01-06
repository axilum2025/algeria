# 📋 To-Do AI - Quick Start

Interface professionnelle de gestion de tâches avec intelligence artificielle Llama 3.3 70B.

## 🚀 Démarrage Rapide

### 1. Accès à l'interface

**Depuis Axilum** :
- Cliquez sur **"📋 To Do"** dans la sidebar gauche
- Ou dites : _"Ouvre mes tâches"_

**Mode standalone** :
```bash
# Ouvrir dans un navigateur
open public/todo-ai.html
```

### 2. Ajouter une tâche intelligente

Cliquez sur **"+ Ajouter"** et décrivez en langage naturel :

```
"Urgent : appeler client lundi 10h pour projet Alpha"
```

**L'IA extrait automatiquement** :
- ✅ Titre : "Appeler client pour projet Alpha"
- ✅ Priorité : Urgente (mot-clé "urgent")
- ✅ Échéance : Lundi prochain 10h
- ✅ Catégorie : Travail (détecté depuis "client" + "projet")
- ✅ Temps estimé : 30 minutes

### 3. Naviguer

**Vues** (sidebar gauche) :
- 📋 **Liste** : Vue classique linéaire
- 🎯 **Kanban** : Colonnes "À faire" / "En cours" / "Terminé"
- 📅 **Calendrier** : Vue temporelle avec événements

**Filtres** :
- ☀️ **Aujourd'hui** : Tâches du jour
- 📅 **Cette semaine** : Échéances ≤ 7 jours
- ⭐ **Prioritaires** : Urgentes uniquement
- 🏷️ **Catégories** : Travail, Personnel, Études, etc.

**Actions** :
- 🔍 **Recherche** : Filtre temps réel
- ✓ **Checkbox** : Marquer comme fait
- 👁️ **Clic tâche** : Voir détails complets
- 🗑️ **Supprimer** : Avec confirmation

## 📖 Documentation Complète

- [TODO_AI_GUIDE.md](../docs/TODO_AI_GUIDE.md) - Guide utilisateur complet (600+ lignes)
- [TODO_AI_SUMMARY.md](../docs/TODO_AI_SUMMARY.md) - Résumé technique de l'implémentation
- [NEW_FUNCTIONS_GUIDE.md](../docs/NEW_FUNCTIONS_GUIDE.md) - API taskManager

## 🎨 Captures d'Interface

### Layout Principal
```
┌────────────────────────────────────────────────────────┐
│ 📋 To Do AI [✨ Llama 3.3]  🔍 [____] + Ajouter  ✕    │
├──────────┬──────────────────────────┬──────────────────┤
│ VUES     │                          │                  │
│ • Liste  │  ┌────────────────────┐  │                  │
│ • Kanban │  │ ☐ 🔴 Finir rapport │  │                  │
│ • Calendr│  │   📅 Ven • 💼 Travail│  │    Details       │
│          │  └────────────────────┘  │    Panel         │
│ FILTRES  │  ┌────────────────────┐  │                  │
│ • All 12 │  │ ☐ 🟡 Acheter lait  │  │  [Task Info]     │
│ • Auj. 3 │  │   📅 Demain • 🏠   │  │  [Priority]      │
│ • Sem. 8 │  └────────────────────┘  │  [Deadline]      │
│ • Prior 5│                          │  [Subtasks]      │
│          │      Main Area           │  [Actions]       │
│ CATÉG.   │      (flex-1)            │                  │
│ • 💼 Trav│                          │    400px         │
│ • 🏠 Pers│                          │  (expandable)    │
│  260px   │                          │                  │
└──────────┴──────────────────────────┴──────────────────┘
```

### Vue Kanban
```
┌─────────────┬─────────────┬─────────────┐
│ 📋 À faire  │ ⚡ En cours  │ ✅ Terminé   │
│    (12)     │    (3)      │    (45)     │
├─────────────┼─────────────┼─────────────┤
│ [Tâche]     │ [Tâche]     │ [Tâche]     │
│ 🔴 Urgent   │ 🟡 Normal   │ ✅ Fait     │
│             │             │             │
│ [Tâche]     │ [Tâche]     │ [Tâche]     │
│ 🟡 Normal   │ 🔵 Basse    │ ✅ Fait     │
└─────────────┴─────────────┴─────────────┘
```

## 💡 Exemples d'Utilisation

### Tâches Simples
```
"Acheter du pain demain"
→ 🔵 Normal | 📅 Demain | 🏠 Personnel
```

### Tâches Urgentes
```
"URGENT finir présentation vendredi"
→ 🔴 Urgent | 📅 Vendredi | 💼 Travail
```

### Avec Sous-tâches
```
"Préparer réunion lundi : ordre du jour, slides, invitations"
→ 🟡 Normal | 📅 Lundi | 💼 Travail | 📋 3 sous-tâches
```

### Rendez-vous
```
"Dentiste mercredi 15h important"
→ 🔴 Urgent | 📅 Mercredi 15h | 🏥 Santé
```

## 🔧 Configuration

### Variables d'État
```javascript
todoView = 'list'         // list | kanban | calendar
todoFilter = 'all'        // all | today | week | priority
todoCategory = 'all'      // all | Work | Personal | Studies...
selectedTask = null       // ID de la tâche sélectionnée
detailsPanelOpen = false  // État du panneau
```

### Personnalisation
```javascript
// Dans public/index.html ligne ~4424

// Changer vue par défaut
let todoView = 'kanban';  // Démarre en Kanban

// Changer filtre par défaut
let todoFilter = 'today'; // Affiche aujourd'hui
```

## 🎯 Raccourcis (À venir)

| Touche | Action |
|--------|--------|
| `N` | Nouvelle tâche |
| `/` | Focus recherche |
| `1` | Vue Liste |
| `2` | Vue Kanban |
| `3` | Vue Calendrier |
| `Esc` | Fermer panneau |

## 🐛 Dépannage

### "Mode simple" lors de création
**Symptôme** : Toast "Tâche créée (mode simple)"  
**Cause** : API `/api/tasks/smart-add` non accessible  
**Solution** : L'IA parsing activé en production après résolution Azure 404

### Tâches ne s'affichent pas
**Symptôme** : Liste vide  
**Solution** :
```javascript
// Console développeur
const userId = (JSON.parse(localStorage.getItem('currentUser') || 'null')?.email) || 'guest';
console.log(JSON.parse(localStorage.getItem(`userTasks:${userId}`) || '[]'));

// Reset complet
localStorage.removeItem(`userTasks:${userId}`);
// (Optionnel) legacy
// localStorage.removeItem('userTasks');
location.reload();
```

### Performance lente
**Symptôme** : Lag avec >500 tâches  
**Solution** : Archiver tâches terminées >30j

## 📊 Métriques

**Code** :
- 600+ lignes JavaScript
- 20+ fonctions
- 3 vues (List/Kanban/Calendar)
- 4 filtres + catégories dynamiques

**Performance** :
- FCP : < 1.2s
- TTI : < 3.0s
- 60fps smooth scrolling
- LocalStorage (instant)

## 🚀 Évolutions Futures

### V2.0 (Q1 2025)
- [ ] Drag & drop Kanban
- [ ] Calendrier interactif
- [ ] Notifications push
- [ ] Export CSV/ICS
- [ ] Sync Microsoft 365

### V2.1 (Q2 2025)
- [ ] Multi-appareils
- [ ] Collaboration
- [ ] Mode hors-ligne
- [ ] Application mobile

### V3.0 (Q3 2025)
- [ ] Suggestions AI proactives
- [ ] Rapports automatiques
- [ ] Intégrations (Slack/Notion)
- [ ] Gamification

## 📞 Support

- 📧 Email : support@axilum.com
- 💬 Discord : discord.gg/axilum
- 📚 Docs : docs.axilum.com
- 🐛 Issues : github.com/axilum/issues

---

**Version** : 1.0.0  
**Dernière mise à jour** : Janvier 2025  
**License** : Propriétaire  
**Auteur** : Équipe Axilum

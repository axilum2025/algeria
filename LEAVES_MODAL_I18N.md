# Internationalisation des Modals de Congés

## Objectif
Traduire les modals "Planning des Congés" et "Nouvelle Demande de Congé" qui contenaient du texte en dur.

## Modifications Effectuées

### 1. Clés de Traduction (public/index.html)
Ajout des clés suivantes dans `I18N_STRINGS` :

**Français :**
```javascript
'hr.leaves.modal.title': 'Nouvelle Demande de Congé',
'hr.leaves.modal.subtitle': 'Remplissez les informations ci-dessous',
'hr.leaves.calendar.title': 'Planning des Congés',
'hr.leaves.calendar.subtitle': 'Vue mensuelle avec suivi des chevauchements',
'hr.leaves.calendar.filterDept': 'Filtrer par département',
'hr.leaves.calendar.allDepts': 'Tous les départements',
```

**Anglais :**
```javascript
'hr.leaves.modal.title': 'New Leave Request',
'hr.leaves.modal.subtitle': 'Fill in the information below',
'hr.leaves.calendar.title': 'Leave Planning',
'hr.leaves.calendar.subtitle': 'Monthly view with overlap tracking',
'hr.leaves.calendar.filterDept': 'Filter by Department',
'hr.leaves.calendar.allDepts': 'All Departments',
```

### 2. Logique Javascript/HTML
Remplacement des textes codés en dur par `t()` :
- Titres et sous-titres des modals.
- Éléments du calendrier (titre, sous-titre, filtres).

## Vérification
- Les clés sont présentes pour FR et EN.
- Le code HTML utilise désormais `${t(...)}` pour ces éléments.

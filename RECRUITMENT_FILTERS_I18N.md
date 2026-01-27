# Internationalisation des Filtres de Recrutement

## Objectif
Remplacer les textes codés en dur dans les filtres et boutons d'action du module de recrutement par des clés de traduction dynamiques.

## Modifications Effectuées

### 1. Clés de Traduction (public/index.html)
Ajout et mise à jour des clés dans `I18N_STRINGS` :

**Français :**
```javascript
'hr.recruitment.actions.toggleShortlist': 'Tout afficher',
'hr.recruitment.actions.toggleShortlistOnly': 'Shortlist uniquement',
'hr.recruitment.filter.allJobs': 'Toutes les offres',
```

**Anglais :**
```javascript
'hr.recruitment.actions.toggleShortlist': 'Show All',
'hr.recruitment.actions.toggleShortlistOnly': 'Shortlist Only',
'hr.recruitment.filter.allJobs': 'All Jobs',
```

Note : Les emojis (⭐) ont été retirés des valeurs de traduction pour être gérés dans la logique JS/HTML, permettant une meilleure flexibilité.

### 2. Logique JavaScript
Mise à jour des fonctions pour utiliser `t()` :

- **`syncRecruitmentShortlistFilterButton()`** :
  - Utilise désormais `${t('hr.recruitment.actions.toggleShortlistOnly')}` et `${t('hr.recruitment.actions.toggleShortlist')}`.
  - Ajoute l'emoji ⭐ dynamiquement via template string.

- **`populateJobFilter()`** :
  - L'option par défaut utilise désormais `${t('hr.recruitment.filter.allJobs')}` au lieu de "Toutes les offres".

### 3. Structure HTML
- Le bouton `#recruitmentShortlistFilterBtn` est initialisé avec la clé `hr.recruitment.actions.toggleShortlist` et l'emoji ⭐.

## Vérification
- Recherche Grep confirmant l'absence de chaînes en dur "⭐ Tout afficher" et "Toutes les offres" (hors définitions de clés).
- Les clés sont présentes dans les sections FR et EN.

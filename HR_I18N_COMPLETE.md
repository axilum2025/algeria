# Internationalisation Complète du Module RH

## Objectif
Standardiser et traduire tous les éléments d'interface restants dans les sous-modules RH (Congés, Paie, Évaluations).

## Modifications

### 1. Clés "Common" (hr.common.*)
Ajout d'un jeu de clés communes pour les tableaux et labels récurrents :
- `hr.common.employee` : Employé / Employee
- `hr.common.type` : Type
- `hr.common.startDate` : Date Début / Start Date
- `hr.common.endDate` : Date Fin / End Date
- `hr.common.duration` : Durée / Duration
- `hr.common.status` : Statut / Status
- `hr.common.actions` : Actions
- `hr.common.date`: Date

### 2. Tableaux de Données
Mise à jour des en-têtes de colonnes (`<th>`) pour utiliser `t()` :
- **Tableau des Congés** : Utilise maintenant les clés `hr.common.*`.
- **Tableau de Paie** : 
  - `hr.payroll.period` : Période / Period
  - `hr.payroll.grossSalary` : Salaire Brut / Gross Salary
  - `hr.payroll.netSalary` : Salaire Net / Net Salary

### 3. Autres Éléments
- Titres de sections dans les évaluations : "Actions recommandées" et "Actions préventives".
- Label "Date" dans les cartes d'évaluation.

## État
Les tableaux principaux et les titres de sections des modules RH sont maintenant entièrement localisables.

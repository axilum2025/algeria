# Migration Excel AI - Plan de Travail

## État Actuel

Excel AI fonctionne sur une **page dédiée complète** : `/public/excel-ai-expert.html`

- ✅ Fonctionnelle et stable
- ✅ Interface complète (2004 lignes)
- ✅ Intégration XLSX.js
- ✅ Upload et traitement de fichiers
- ✅ Chat intégré avec historique

## Objectif de la Migration

Convertir Excel AI en module chargeable dynamiquement, comme Text Pro.

## Avantages de la Migration

1. **Pas de rechargement de page**
   - Navigation fluide
   - Pas de perte de contexte

2. **Performance**
   - Chargement à la demande
   - Ressources partagées avec l'app principale

3. **Intégration**
   - Partage de contexte avec le chat principal
   - Historique unifié

4. **Maintenance**
   - Code modulaire et isolé
   - Tests plus faciles

## Plan de Migration (Phase 2)

### Étape 1 : Analyse
- [ ] Identifier toutes les dépendances
- [ ] Lister les bibliothèques externes (XLSX.js)
- [ ] Mapper les fonctions principales
- [ ] Identifier les variables globales

### Étape 2 : Extraction
- [ ] Extraire le HTML vers une fonction template
- [ ] Extraire le CSS vers une fonction de styles
- [ ] Isoler le JavaScript dans un module IIFE
- [ ] Gérer les dépendances externes

### Étape 3 : Adaptation
- [ ] Convertir en overlay full-screen
- [ ] Adapter les fonctions pour le module
- [ ] Gérer l'état local du module
- [ ] Ajouter la fermeture avec animation

### Étape 4 : Intégration
- [ ] Créer la fonction de chargement
- [ ] Modifier le bouton de la sidebar
- [ ] Tester le chargement dynamique
- [ ] Vérifier toutes les fonctionnalités

### Étape 5 : Tests
- [ ] Test d'upload de fichiers
- [ ] Test du traitement Excel
- [ ] Test du chat AI
- [ ] Test de performance
- [ ] Test de fermeture et réouverture

### Étape 6 : Déploiement Progressif
- [ ] Déployer en mode test (option cachée)
- [ ] Tests utilisateurs
- [ ] Corrections de bugs
- [ ] Activation générale

## Structure Cible du Module

```javascript
// /public/js/excel-ai-module.js

(function() {
    'use strict';
    
    // Chargement de XLSX.js si nécessaire
    function loadXLSX(callback) {
        if (typeof XLSX !== 'undefined') {
            callback();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = callback;
        document.head.appendChild(script);
    }
    
    // Variables du module
    let excelCurrentFile = null;
    let excelSheetData = [];
    let excelColumns = [];
    let excelChatHistory = [];
    
    // Fonction principale
    window.openExcelAiModule = function() {
        loadXLSX(() => {
            const overlay = createExcelAiInterface();
            document.body.appendChild(overlay);
        });
    };
    
    // Création de l'interface
    function createExcelAiInterface() {
        // ... HTML + CSS + Fonctions
    }
    
    // Fonctions de traitement Excel
    function handleFileUpload(file) {
        // ...
    }
    
    function processExcelData(data) {
        // ...
    }
    
    // Intégration AI
    async function sendExcelCommand(command) {
        // ...
    }
    
})();
```

## Dépendances à Gérer

### Bibliothèques Externes
- **XLSX.js** (v0.18.5)
  - Chargement dynamique avant ouverture
  - Vérification de disponibilité
  - Fallback si échec

### Ressources
- Styles CSS (extraits de excel-ai-expert.html)
- Assets (images, icônes si utilisés)
- Polices (Segoe UI, Calibri)

## Points d'Attention

### Compatibilité
- ✅ Upload de fichiers Excel (.xlsx, .xls)
- ✅ Parsing avec XLSX.js
- ✅ Affichage des données
- ✅ Modifications et commandes AI
- ✅ Export des résultats

### Performance
- Chargement de fichiers volumineux
- Rendu de grandes tables
- Traitement AI en temps réel

### UX
- Transitions fluides
- Feedback visuel
- Gestion d'erreurs claire

## Timeline Suggérée

- **Semaine 1** : Analyse et extraction (Étapes 1-2)
- **Semaine 2** : Adaptation et intégration (Étapes 3-4)
- **Semaine 3** : Tests et corrections (Étape 5)
- **Semaine 4** : Déploiement progressif (Étape 6)

## Fallback et Sécurité

En cas de problème avec le module :
```javascript
// Dans loadExcelAiModule() - index.html
script.onerror = function() {
    console.error('Erreur chargement module Excel AI');
    // Fallback : redirection vers page dédiée
    window.location.href = '/excel-ai-expert.html';
};
```

## Statut Actuel

- ✅ Module stub créé : `/public/js/excel-ai-module.js`
- ✅ Fonction de chargement préparée dans `index.html`
- ✅ Fallback vers page dédiée configuré
- ⏳ Migration complète : À planifier

## Prochaines Actions

1. **Maintenir la page actuelle** - Rien ne change pour l'utilisateur
2. **Développer le module** progressivement
3. **Tester en parallèle** sans impacter la prod
4. **Basculer** quand le module est complet et testé

---

**Date de création :** 21 décembre 2025  
**Status :** Plan préparé, migration en attente  
**Priorité :** Moyenne (après stabilisation de Text Pro)

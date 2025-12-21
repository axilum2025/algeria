/**
 * Module HR Management - Gestion des Ressources Humaines
 * Wrapper pour charger et gérer le module RH
 * 
 * Le code RH complet reste dans index.html pour l'instant (lignes 6489-14054)
 * Ce module sert de point d'entrée contrôlé
 */

(function() {
    'use strict';
    
    console.log('Module HR Management initialisé');
    
    /**
     * Ouvrir l'interface HR Management
     * Vérifie que toutes les fonctions RH sont disponibles avant d'ouvrir
     */
    window.openHRModule = function() {
        try {
            // Vérifier que les fonctions RH sont disponibles
            if (typeof openHRManagement !== 'function') {
                throw new Error('Fonctions RH non disponibles');
            }
            
            // Appeler la fonction principale RH
            openHRManagement();
            
            console.log('Module HR Management ouvert avec succès');
        } catch (error) {
            console.error('Erreur lors de l\'ouverture du module HR:', error);
            alert('Erreur lors de l\'ouverture de la Gestion RH. Veuillez rafraîchir la page.');
        }
    };
    
    /**
     * Fermer l'interface HR Management
     */
    window.closeHRModule = function() {
        const overlay = document.getElementById('hrManagementOverlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => overlay.remove(), 300);
        }
    };
    
    /**
     * Vérifier la santé du module
     */
    window.checkHRModule = function() {
        const requiredFunctions = [
            'openHRManagement',
            'getHRStorageKey',
            'getHRData',
            'setHRData'
        ];
        
        const missing = requiredFunctions.filter(fn => typeof window[fn] !== 'function');
        
        if (missing.length > 0) {
            console.warn('Fonctions RH manquantes:', missing);
            return false;
        }
        
        console.log('Module HR: Toutes les fonctions sont disponibles');
        return true;
    };
    
    // Auto-vérification au chargement
    if (typeof openHRManagement === 'function') {
        console.log('Module HR: Fonctions principales détectées');
    } else {
        console.warn('Module HR: En attente du chargement des fonctions principales');
    }
    
})();

/**
 * NOTE IMPORTANTE:
 * 
 * Ce module est un WRAPPER léger. Le code RH complet (7566 lignes) reste dans index.html.
 * 
 * Pour une migration complète future:
 * 
 * 1. Extraire tout le code RH de index.html (lignes 6489-14054)
 * 2. Le placer dans ce fichier avec encapsulation IIFE
 * 3. Exposer uniquement les fonctions nécessaires
 * 4. Gérer l'état local du module
 * 5. Charger dynamiquement à la demande
 * 
 * Avantages de la migration complète:
 * - Réduction de la taille de index.html
 * - Chargement à la demande (lazy loading)
 * - Isolation et testabilité
 * - Maintenance facilitée
 * 
 * Pour l'instant, ce wrapper permet:
 * - Point d'entrée contrôlé
 * - Gestion d'erreurs
 * - Vérification de santé
 * - Préparation pour migration future
 */

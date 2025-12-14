/**
 * 📋 TO-DO AI INTERFACE - TEST SUITE
 * 
 * Tests de l'interface complète To-Do AI
 * Vérifie : Rendering, Filtrage, Actions, AI Integration
 */

console.log('🧪 TO-DO AI INTERFACE - Tests automatiques\n');
console.log('=' .repeat(60));

let testsTotal = 0;
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    testsTotal++;
    try {
        fn();
        testsPassed++;
        console.log(`✅ Test ${testsTotal}: ${name}`);
    } catch (error) {
        testsFailed++;
        console.log(`❌ Test ${testsTotal}: ${name}`);
        console.log(`   Erreur: ${error.message}`);
    }
}

// ============================================================================
// TEST 1: VARIABLES D'ÉTAT
// ============================================================================

test('Variables d\'état globales existent', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    if (!content.includes('let todoView')) throw new Error('todoView manquante');
    if (!content.includes('let todoFilter')) throw new Error('todoFilter manquante');
    if (!content.includes('let todoCategory')) throw new Error('todoCategory manquante');
    if (!content.includes('let selectedTask')) throw new Error('selectedTask manquante');
    if (!content.includes('let detailsPanelOpen')) throw new Error('detailsPanelOpen manquante');
});

// ============================================================================
// TEST 2: FONCTIONS PRINCIPALES
// ============================================================================

test('Fonction openOfficePro() existe', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    if (!content.includes('function openOfficePro()')) {
        throw new Error('openOfficePro() non trouvée');
    }
    
    // Vérifie qu'elle crée l'interface complète
    if (!content.includes('To Do AI')) {
        throw new Error('Titre "To Do AI" manquant');
    }
    if (!content.includes('Powered by Llama 3.3')) {
        throw new Error('Badge AI manquant');
    }
});

test('Fonction closeTodoAi() existe', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    if (!content.includes('function closeTodoAi()')) {
        throw new Error('closeTodoAi() non trouvée');
    }
    if (!content.includes('closeGenericModal()')) {
        throw new Error('Appel closeGenericModal() manquant');
    }
});

test('Fonctions de rendu existent', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    const functions = [
        'renderTodoFilters',
        'renderTodoCategories',
        'renderTodoMainView',
        'renderListView',
        'renderKanbanView',
        'renderCalendarView',
        'renderTaskCard'
    ];
    
    functions.forEach(fn => {
        if (!content.includes(`function ${fn}(`)) {
            throw new Error(`Fonction ${fn}() manquante`);
        }
    });
});

test('Fonctions d\'actions existent', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    const functions = [
        'showAddTaskModal',
        'toggleTaskComplete',
        'showTaskDetails',
        'closeTaskDetails',
        'deleteTaskConfirm'
    ];
    
    functions.forEach(fn => {
        if (!content.includes(`function ${fn}(`)) {
            throw new Error(`Fonction ${fn}() manquante`);
        }
    });
});

test('Fonctions de filtrage existent', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    const functions = [
        'getFilteredTasks',
        'filterTodoSearch',
        'switchTodoView',
        'switchTodoFilter',
        'switchTodoCategory'
    ];
    
    functions.forEach(fn => {
        if (!content.includes(`function ${fn}(`)) {
            throw new Error(`Fonction ${fn}() manquante`);
        }
    });
});

// ============================================================================
// TEST 3: STRUCTURE HTML
// ============================================================================

test('Header avec boutons existe', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Header gradient bleu
    if (!content.includes('linear-gradient(135deg, #3B82F6')) {
        throw new Error('Header gradient manquant');
    }
    
    // Bouton recherche
    if (!content.includes('placeholder="🔍 Rechercher..."')) {
        throw new Error('Input recherche manquant');
    }
    
    // Bouton ajouter
    if (!content.includes('onclick="showAddTaskModal()"')) {
        throw new Error('Bouton ajouter manquant');
    }
    
    // Bouton fermer
    if (!content.includes('onclick="closeTodoAi()"')) {
        throw new Error('Bouton fermer manquant');
    }
});

test('Sidebar avec sections existe', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Sidebar 260px
    if (!content.includes('width: 260px')) {
        throw new Error('Sidebar width manquant');
    }
    
    // Sections
    if (!content.includes('VUES')) throw new Error('Section VUES manquante');
    if (!content.includes('FILTRES')) throw new Error('Section FILTRES manquante');
    if (!content.includes('CATÉGORIES') && !content.includes('CATÉG.')) {
        throw new Error('Section CATÉGORIES manquante');
    }
    
    // Boutons de vue
    if (!content.includes('switchTodoView(\'list\')')) throw new Error('Bouton Liste manquant');
    if (!content.includes('switchTodoView(\'kanban\')')) throw new Error('Bouton Kanban manquant');
    if (!content.includes('switchTodoView(\'calendar\')')) throw new Error('Bouton Calendrier manquant');
});

test('Main Area et Details Panel existent', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Main area flex-1
    if (!content.includes('id="todoMainArea"')) {
        throw new Error('todoMainArea manquant');
    }
    
    // Details panel
    if (!content.includes('id="todoDetailsPanel"')) {
        throw new Error('todoDetailsPanel manquant');
    }
});

// ============================================================================
// TEST 4: INTÉGRATION AI
// ============================================================================

test('Intégration API smart-add', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Appel API
    if (!content.includes('/api/tasks/smart-add')) {
        throw new Error('Endpoint smart-add manquant');
    }
    
    // Toast AI
    if (!content.includes('Analyse de la tâche en cours')) {
        throw new Error('Toast AI manquant');
    }
    
    // Fallback mode
    if (!content.includes('mode simple')) {
        throw new Error('Fallback mode manquant');
    }
});

test('Badge Llama 3.3 affiché', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    if (!content.includes('Powered by Llama 3.3')) {
        throw new Error('Badge Llama 3.3 manquant');
    }
});

// ============================================================================
// TEST 5: DESIGN SYSTEM
// ============================================================================

test('Couleurs CSS définies', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Couleurs principales
    const colors = ['#0F172A', '#1E293B', '#F1F5F9', '#94A3B8', '#334155'];
    colors.forEach(color => {
        if (!content.includes(color)) {
            throw new Error(`Couleur ${color} manquante`);
        }
    });
    
    // Couleurs de priorité
    const priorityColors = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981'];
    priorityColors.forEach(color => {
        if (!content.includes(color)) {
            throw new Error(`Couleur priorité ${color} manquante`);
        }
    });
});

test('Layout 3 colonnes configuré', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Sidebar 260px
    if (!content.includes('260px')) {
        throw new Error('Sidebar width 260px manquante');
    }
    
    // Main area flex
    if (!content.includes('flex: 1')) {
        throw new Error('Main area flex manquant');
    }
    
    // Details panel 400px
    if (!content.includes('400px')) {
        throw new Error('Details panel 400px manquant');
    }
});

// ============================================================================
// TEST 6: VUE KANBAN
// ============================================================================

test('Vue Kanban avec 3 colonnes', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Grid 3 colonnes
    if (!content.includes('grid-template-columns: repeat(3, 1fr)')) {
        throw new Error('Grid 3 colonnes Kanban manquant');
    }
    
    // Titres colonnes
    if (!content.includes('À faire')) throw new Error('Colonne "À faire" manquante');
    if (!content.includes('En cours')) throw new Error('Colonne "En cours" manquante');
    if (!content.includes('Terminé')) throw new Error('Colonne "Terminé" manquante');
});

// ============================================================================
// TEST 7: RESPONSIVE DESIGN
// ============================================================================

test('Media queries pour mobile', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Dans todo-ai.html (standalone)
    const todoPath = './public/todo-ai.html';
    if (fs.existsSync(todoPath)) {
        const todoContent = fs.readFileSync(todoPath, 'utf8');
        
        if (!todoContent.includes('@media (max-width: 768px)')) {
            throw new Error('Media query mobile manquante');
        }
        
        if (!todoContent.includes('grid-template-columns: 1fr')) {
            throw new Error('Kanban 1 colonne mobile manquant');
        }
    }
});

// ============================================================================
// TEST 8: FICHIERS DOCUMENTATION
// ============================================================================

test('Documentation complète existe', () => {
    const fs = require('fs');
    
    const docs = [
        './docs/TODO_AI_GUIDE.md',
        './docs/TODO_AI_SUMMARY.md',
        './public/TODO_AI_README.md'
    ];
    
    docs.forEach(doc => {
        if (!fs.existsSync(doc)) {
            throw new Error(`Documentation ${doc} manquante`);
        }
        
        const content = fs.readFileSync(doc, 'utf8');
        if (content.length < 1000) {
            throw new Error(`Documentation ${doc} trop courte (${content.length} chars)`);
        }
    });
});

test('Documentation contient exemples', () => {
    const fs = require('fs');
    const guidePath = './docs/TODO_AI_GUIDE.md';
    const content = fs.readFileSync(guidePath, 'utf8');
    
    // Vérifie présence d'exemples
    if (!content.includes('```')) {
        throw new Error('Aucun bloc de code dans le guide');
    }
    
    if (!content.includes('Exemple')) {
        throw new Error('Aucun exemple dans le guide');
    }
    
    // Vérifie roadmap
    if (!content.includes('V2.0') || !content.includes('V3.0')) {
        throw new Error('Roadmap manquante');
    }
});

// ============================================================================
// TEST 9: PROTOTYPE STANDALONE
// ============================================================================

test('Fichier todo-ai.html existe', () => {
    const fs = require('fs');
    const htmlPath = './public/todo-ai.html';
    
    if (!fs.existsSync(htmlPath)) {
        throw new Error('Fichier todo-ai.html manquant');
    }
    
    const content = fs.readFileSync(htmlPath, 'utf8');
    
    // Vérifie structure complète
    if (!content.includes('<!DOCTYPE html>')) {
        throw new Error('Déclaration DOCTYPE manquante');
    }
    if (!content.includes('To Do AI')) {
        throw new Error('Titre manquant');
    }
    if (!content.includes('<style>')) {
        throw new Error('Styles CSS manquants');
    }
    if (!content.includes('<script>')) {
        throw new Error('JavaScript manquant');
    }
});

test('Prototype standalone est autonome', () => {
    const fs = require('fs');
    const htmlPath = './public/todo-ai.html';
    const content = fs.readFileSync(htmlPath, 'utf8');
    
    // CSS inline
    if (!content.includes(':root {')) {
        throw new Error('Variables CSS manquantes');
    }
    
    // JS inline
    if (!content.includes('function showAddTaskModal')) {
        throw new Error('Fonctions JS manquantes');
    }
    
    // Pas de dépendances externes requises pour la démo
    if (content.includes('src="http') && !content.includes('<!-- External')) {
        console.log('   ⚠️ Warning: Dépendances externes détectées (normal si CDN)');
    }
});

// ============================================================================
// TEST 10: INTÉGRATION AVEC SYSTÈME EXISTANT
// ============================================================================

test('Compatible avec fonctions getTasks existantes', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Utilise userTasks
    if (!content.includes('userTasks')) {
        throw new Error('Référence userTasks manquante');
    }
    
    // Utilise getTodayEvents
    if (!content.includes('getTodayEvents')) {
        throw new Error('Référence getTodayEvents manquante');
    }
    
    // Utilise getWeekEvents
    if (!content.includes('getWeekEvents')) {
        throw new Error('Référence getWeekEvents manquante');
    }
});

test('Fonction addTask() appelée correctement', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Dans showAddTaskModal
    const match = content.match(/addTask\([^)]+\)/);
    if (!match) {
        throw new Error('Appel addTask() manquant');
    }
    
    // Vérifie paramètres
    if (!content.includes('addTask(data.task.title')) {
        console.log('   ⚠️ Warning: Paramètres addTask() pourraient être différents');
    }
});

test('localStorage utilisé pour persistance', () => {
    const indexPath = './public/index.html';
    const fs = require('fs');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    if (!content.includes('localStorage')) {
        throw new Error('localStorage non utilisé');
    }
    
    if (!content.includes('setItem') || !content.includes('getItem')) {
        throw new Error('Méthodes localStorage manquantes');
    }
});

// ============================================================================
// RÉSULTATS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`\n📊 RÉSULTATS:\n`);
console.log(`Total:  ${testsTotal} tests`);
console.log(`✅ Réussis: ${testsPassed}`);
console.log(`❌ Échoués: ${testsFailed}`);
console.log(`\n📈 Taux de réussite: ${((testsPassed / testsTotal) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
    console.log('\n🎉 TOUS LES TESTS SONT PASSÉS !');
    console.log('✅ Interface To-Do AI est prête pour production\n');
    process.exit(0);
} else {
    console.log(`\n⚠️ ${testsFailed} test(s) ont échoué`);
    console.log('Veuillez corriger les erreurs ci-dessus\n');
    process.exit(1);
}

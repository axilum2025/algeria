// ✅ Task Manager Intelligent - Gestion de tâches avec IA
// Détection automatique de priorité, deadline, sous-tâches via Llama 3.3 70B

module.exports = async function (context, req) {
    context.log('✅ Task Manager Request:', req.method, req.params.action);

    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        };
        return;
    }

    try {
        const action = req.params.action || 'list';
        const userId = req.query.userId || req.body?.userId || 'default';

        // Simuler stockage (en production: Azure Table Storage ou Cosmos DB)
        const TASKS_STORAGE_KEY = `tasks_${userId}`;
        
        switch (action) {
            case 'create':
                return await createTask(context, req, userId);
            
            case 'list':
                return await listTasks(context, req, userId);
            
            case 'update':
                return await updateTask(context, req, userId);
            
            case 'delete':
                return await deleteTask(context, req, userId);
            
            case 'smart-add':
                return await smartAddTask(context, req, userId);
            
            case 'smart-command':
                return await smartCommand(context, req, userId);
            
            case 'sync':
                return await syncTasks(context, req, userId);
            
            default:
                context.res = {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: { error: "Unknown action. Use: create, list, update, delete, smart-add, smart-command, sync" }
                };
        }

    } catch (error) {
        context.log.error('❌ Error:', error);
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: { error: error.message }
        };
    }
};

/**
 * Ajout intelligent de tâche via IA (parse langage naturel)
 */
async function smartAddTask(context, req, userId) {
    const { description } = req.body;

    if (!description) {
        context.res = {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
            body: { error: "Task description is required" }
        };
        return;
    }

    const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;

    if (!groqKey) {
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: { error: "Groq API Key not configured" }
        };
        return;
    }

    // Utiliser IA pour parser la tâche
    const systemPrompt = `Tu es un assistant de gestion de tâches. Parse la description de tâche en JSON.

FORMAT ATTENDU:
{
  "title": "Titre court de la tâche",
  "description": "Description détaillée",
  "priority": "low|medium|high|urgent",
  "deadline": "YYYY-MM-DD" ou null,
  "estimatedTime": "Xh" ou null,
  "category": "travail|personnel|urgent|santé|etc.",
  "subtasks": ["sous-tâche 1", "sous-tâche 2"] ou []
}

RÈGLES:
- Détecte automatiquement la priorité basée sur mots-clés (urgent, important, vite, etc.)
- Extrait les dates si mentionnées (demain, lundi prochain, dans 3 jours, etc.)
- Suggère sous-tâches si la tâche est complexe
- Estime le temps si possible

EXEMPLES:
Input: "Finir le rapport urgent pour vendredi"
Output: {"title":"Finir le rapport","priority":"urgent","deadline":"2025-12-20",...}

Input: "Rappelle-moi d'acheter du lait"
Output: {"title":"Acheter du lait","priority":"low","category":"personnel",...}`;

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Parse cette tâche (date du jour: ${new Date().toISOString().split('T')[0]}):\n\n${description}` }
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: messages,
            max_tokens: 500,
            temperature: 0.2,
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: {
                error: `Groq Error: ${response.status}`,
                details: errorText
            }
        };
        return;
    }

    const aiData = await response.json();
    const parsedTask = JSON.parse(aiData.choices[0].message.content);

    // Créer la tâche avec ID
    const task = {
        id: Date.now().toString(),
        ...parsedTask,
        status: 'pending',
        createdAt: new Date().toISOString(),
        originalInput: description
    };

    // Sauvegarder (simulation - en production: Azure Storage)
    const tasks = await getTasks(userId);
    tasks.push(task);
    await saveTasks(userId, tasks);

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: {
            task: task,
            message: "Tâche créée avec succès",
            tokensUsed: aiData.usage?.total_tokens || 0
        }
    };
}

/**
 * Créer une tâche manuellement (ou mettre à jour si existe)
 */
async function createTask(context, req, userId) {
    const task = {
        id: req.body.id || Date.now().toString(),
        ...req.body,
        status: req.body.status || 'pending',
        createdAt: req.body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const tasks = await getTasks(userId);
    
    // Chercher si la tâche existe déjà (par ID)
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    
    if (existingIndex >= 0) {
        // Mettre à jour la tâche existante
        tasks[existingIndex] = task;
    } else {
        // Ajouter nouvelle tâche
        tasks.push(task);
    }
    
    await saveTasks(userId, tasks);

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: {
            task: task,
            message: "Tâche créée"
        }
    };
}

/**
 * Lister les tâches
 */
async function listTasks(context, req, userId) {
    const tasks = await getTasks(userId);
    const filter = req.query.filter; // pending, completed, urgent

    let filtered = tasks;
    if (filter === 'pending') {
        filtered = tasks.filter(t => t.status === 'pending');
    } else if (filter === 'completed') {
        filtered = tasks.filter(t => t.status === 'completed');
    } else if (filter === 'urgent') {
        filtered = tasks.filter(t => t.priority === 'urgent' || t.priority === 'high');
    }

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: {
            tasks: filtered,
            total: filtered.length
        }
    };
}

/**
 * Mettre à jour une tâche
 */
async function updateTask(context, req, userId) {
    const { taskId, ...updates } = req.body;

    if (!taskId) {
        context.res = {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
            body: { error: "taskId is required" }
        };
        return;
    }

    const tasks = await getTasks(userId);
    const taskIndex = tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
        context.res = {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
            body: { error: "Task not found" }
        };
        return;
    }

    tasks[taskIndex] = {
        ...tasks[taskIndex],
        ...updates,
        updatedAt: new Date().toISOString()
    };

    await saveTasks(userId, tasks);

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: {
            task: tasks[taskIndex],
            message: "Tâche mise à jour"
        }
    };
}

/**
 * Supprimer une tâche
 */
async function deleteTask(context, req, userId) {
    const taskId = req.query.taskId || req.body?.taskId;

    if (!taskId) {
        context.res = {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
            body: { error: "taskId is required" }
        };
        return;
    }

    const tasks = await getTasks(userId);
    const filtered = tasks.filter(t => t.id !== taskId);

    if (filtered.length === tasks.length) {
        context.res = {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
            body: { error: "Task not found" }
        };
        return;
    }

    await saveTasks(userId, filtered);

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: {
            message: "Tâche supprimée",
            remainingTasks: filtered.length
        }
    };
}

/**
 * Synchronisation complète - Remplace toutes les tâches serveur par celles du client
 */
async function syncTasks(context, req, userId) {
    const { tasks } = req.body;

    if (!Array.isArray(tasks)) {
        context.res = {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: { error: "Tasks array is required" }
        };
        return;
    }

    // Remplacer complètement les tâches du serveur
    await saveTasks(userId, tasks);

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: {
            message: "Synchronisation réussie",
            taskCount: tasks.length,
            tasks: tasks
        }
    };
}

/**
 * Commande intelligente - Assistant conversationnel
 * Exemples: "Organise ma semaine", "Qu'est-ce que je dois faire maintenant?", "Déplace ça à demain"
 */
async function smartCommand(context, req, userId) {
    const { command } = req.body;

    if (!command) {
        context.res = {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: { error: "Command is required" }
        };
        return;
    }

    const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
    if (!groqKey) {
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: { error: "Groq API Key not configured" }
        };
        return;
    }

    // Récupérer toutes les tâches pour contexte
    const tasks = await getTasks(userId);
    
    // Contexte temporel
    const now = new Date();
    const dayOfWeek = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][now.getDay()];
    const hour = now.getHours();
    const timeOfDay = hour < 12 ? 'matin' : hour < 18 ? 'après-midi' : 'soir';
    
    // Préparer contexte des tâches
    const taskContext = tasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        deadline: t.deadline,
        status: t.status,
        category: t.category,
        estimatedTime: t.estimatedTime
    }));

    const systemPrompt = `Tu es un assistant de productivité intelligent. Tu aides l'utilisateur à gérer ses tâches de manière conversationnelle.

CONTEXTE ACTUEL:
- Date/Heure: ${now.toISOString()}
- Jour: ${dayOfWeek}, ${timeOfDay}
- Nombre de tâches: ${tasks.length}

CAPACITÉS:
1. **Organiser/Planifier**: Réorganise les tâches selon priorités, deadlines, charge de travail
2. **Suggérer**: Recommande la prochaine tâche à faire selon contexte (heure, énergie, urgence)
3. **Modifier**: Change deadline, priorité, statut d'une ou plusieurs tâches
4. **Analyser**: Donne un aperçu de la charge de travail, tâches urgentes, etc.

FORMAT DE RÉPONSE JSON:
{
  "response": "Réponse conversationnelle à l'utilisateur",
  "action": "organize|suggest|modify|analyze|create|delete|info",
  "changes": [
    {
      "taskId": "123",
      "updates": {"deadline": "2025-12-15", "priority": "high"}
    }
  ],
  "created": [
    {
      "title": "Nouvelle tâche",
      "priority": "normal",
      "deadline": "2025-12-15",
      "category": "travail",
      "estimatedTime": "1h"
    }
  ],
  "deleted": ["taskId1", "taskId2"],
  "suggestions": [
    {
      "taskId": "456",
      "reason": "Urgent et rapide à faire",
      "order": 1
    }
  ],
  "insights": {
    "urgent": 3,
    "today": 5,
    "overdue": 1,
    "totalTime": "6h"
  }
}

EXEMPLES:

Commande: "Organise ma semaine"
→ Analyse deadlines, distribue tâches sur la semaine, équilibre charge quotidienne

Commande: "Qu'est-ce que je dois faire maintenant ?"
→ Suggère 2-3 tâches selon contexte (heure, priorité, temps estimé)

Commande: "Déplace la réunion à demain"
→ Trouve tâche avec "réunion", change deadline à demain

Commande: "Crée une tâche: Appeler Marie demain à 14h"
→ Crée nouvelle tâche avec title="Appeler Marie", deadline=demain 14h

Commande: "Supprime les tâches terminées"
→ Supprime toutes les tâches avec status="completed"

Commande: "Marque la première tâche comme terminée"
→ Change status à "completed" pour la première tâche

Commande: "Qu'est-ce qui est urgent ?"
→ Liste tâches urgentes ou avec deadline proche

RÈGLES:
- Réponds de manière naturelle et conversationnelle
- Priorise selon: urgence > importance > effort
- Le matin: tâches complexes/créatives
- L'après-midi: réunions/communications
- Le soir: tâches simples/administratives
- Si plusieurs tâches matchent, demande clarification`;

    const userMessage = `Tâches actuelles (${tasks.length}):\n${JSON.stringify(taskContext, null, 2)}\n\nCommande utilisateur:\n${command}`;

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: messages,
            max_tokens: 2000,
            temperature: 0.3,
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: { error: `Groq Error: ${response.status}`, details: errorText }
        };
        return;
    }

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // Appliquer les changements suggérés par l'IA
    let updatedTasks = [...tasks];
    let tasksModified = 0;

    // 1. Modifier les tâches existantes
    if (result.changes && result.changes.length > 0) {
        result.changes.forEach(change => {
            const taskIndex = updatedTasks.findIndex(t => t.id === change.taskId);
            if (taskIndex !== -1) {
                updatedTasks[taskIndex] = {
                    ...updatedTasks[taskIndex],
                    ...change.updates,
                    updatedAt: new Date().toISOString()
                };
                tasksModified++;
            }
        });
    }

    // 2. Créer de nouvelles tâches
    if (result.created && result.created.length > 0) {
        result.created.forEach(newTask => {
            const task = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                title: newTask.title,
                description: newTask.description || '',
                priority: newTask.priority || 'normal',
                deadline: newTask.deadline || null,
                category: newTask.category || 'personnel',
                status: newTask.status || 'pending',
                estimatedTime: newTask.estimatedTime || null,
                subtasks: newTask.subtasks || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            updatedTasks.push(task);
            tasksModified++;
        });
    }

    // 3. Supprimer des tâches
    if (result.deleted && result.deleted.length > 0) {
        result.deleted.forEach(taskId => {
            const taskIndex = updatedTasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                updatedTasks.splice(taskIndex, 1);
                tasksModified++;
            }
        });
    }

    // Sauvegarder si modifications
    if (tasksModified > 0) {
        await saveTasks(userId, updatedTasks);
    }

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: {
            response: result.response,
            action: result.action,
            changes: result.changes || [],
            created: result.created || [],
            deleted: result.deleted || [],
            suggestions: result.suggestions || [],
            insights: result.insights || {},
            tasksModified: tasksModified,
            tokensUsed: aiData.usage?.total_tokens || 0
        }
    };
}

// Helpers pour stockage (simulation - à remplacer par Azure Storage)
let tasksCache = {};

async function getTasks(userId) {
    return tasksCache[userId] || [];
}

async function saveTasks(userId, tasks) {
    tasksCache[userId] = tasks;
    return true;
}

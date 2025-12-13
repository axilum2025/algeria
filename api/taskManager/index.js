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
            
            default:
                context.res = {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: { error: "Unknown action. Use: create, list, update, delete, smart-add" }
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
 * Créer une tâche manuellement
 */
async function createTask(context, req, userId) {
    const task = {
        id: Date.now().toString(),
        ...req.body,
        status: req.body.status || 'pending',
        createdAt: new Date().toISOString()
    };

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

// Helpers pour stockage (simulation - à remplacer par Azure Storage)
let tasksCache = {};

async function getTasks(userId) {
    return tasksCache[userId] || [];
}

async function saveTasks(userId, tasks) {
    tasksCache[userId] = tasks;
    return true;
}

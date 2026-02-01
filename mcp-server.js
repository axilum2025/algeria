require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// --- CONFIGURATION ---
const PORT = process.env.MCP_PORT || 3001; // Port différent du serveur principal (3000)

// --- MOCK DATABASE (Pour simulation Quotas & Users) ---
// Dans le futur, ceci sera remplacé par votre vraie base de données (SQL/CosmosDB)
const USER_QUOTAS = {
    'user_123': { plan: 'premium', credits: 500 },
    'user_free': { plan: 'starter', credits: 10 }
};

const TOOLS_PRICING = {
    'get_employees': 0,      // Gratuit
    'external_api_call': 5   // Payant
};

// --- MIDDLEWARE DE SÉCURITÉ & QUOTAS ---
const authAndQuotaMiddleware = (req, res, next) => {
    // 1. IDENTIFICATION
    // Simulation: On récupère l'ID utilisateur depuis l'en-tête (envoyé par le frontend/AI)
    const userId = req.headers['x-user-id'] || 'user_123'; 
    const toolName = req.body.tool;

    console.log(`[MCP] Requête de ${userId} pour l'outil: ${toolName}`);

    // 2. VÉRIFICATION DES QUOTAS
    const user = USER_QUOTAS[userId];
    const cost = TOOLS_PRICING[toolName] || 0;

    if (!user) {
        return res.status(401).json({ error: "Utilisateur non reconnu" });
    }

    if (user.credits < cost) {
        console.error(`[MCP] Blocage: Crédits insuffisants pour ${userId}`);
        return res.status(403).json({ 
            error: "Crédits insuffisants. Veuillez recharger votre compte.",
            required: cost,
            available: user.credits
        });
    }

    // 3. DÉBIT (METERING)
    // Note: En prod, on ne déduit qu'APRES succès, mais ici on réserve.
    user.credits -= cost;
    console.log(`[MCP] Facturation: -${cost} crédits. Solde restant: ${user.credits}`);

    // On passe l'info utilisateur à la suite
    req.user = user;
    next();
};

// --- DÉFINITION DES OUTILS (TOOLS) ---

const tools = {
    // ========================================
    // OUTIL 1: Liste des outils disponibles
    // ========================================
    list_tools: async (params) => {
        return {
            tools: Object.keys(tools).map(name => ({
                name,
                description: toolDescriptions[name] || 'Outil disponible'
            }))
        };
    },

    // ========================================
    // OUTIL 2: Lecture données RH (Employés)
    // ========================================
    get_employees: async (params) => {
        const filePath = path.join(__dirname, 'api', 'employees', 'all.json');
        
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            const employees = JSON.parse(data);
            return { 
                count: employees.length, 
                employees: employees.slice(0, 5).map(e => ({ name: e.name, department: e.department || 'N/A' }))
            };
        }
        return { error: "Fichier employés non trouvé", hint: "Créez api/employees/all.json" };
    },

    // ========================================
    // OUTIL 3: Recherche Web (Brave API ou Simulation)
    // ========================================
    web_search: async (params) => {
        const query = params?.query || '';
        if (!query) return { error: "Paramètre 'query' requis" };
        
        const braveApiKey = process.env.BRAVE_API_KEY;
        console.log(`[MCP] Web Search: "${query}" (API: ${braveApiKey ? 'Brave' : 'Simulation'})`);
        
        // Si l'API Brave est configurée, utiliser la vraie recherche
        if (braveApiKey) {
            try {
                const maxResults = params?.max_results || 5;
                const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
                const response = await axios.get(searchUrl, {
                    headers: {
                        'Accept': 'application/json',
                        'X-Subscription-Token': braveApiKey
                    },
                    timeout: 10000
                });
                
                const results = (response.data.web?.results || []).map(r => ({
                    title: r.title,
                    url: r.url,
                    snippet: r.description || ''
                }));
                
                return { query, results, source: 'Brave Search API', count: results.length };
            } catch (error) {
                console.error('[MCP] Brave Search error:', error.message);
                return { query, error: error.message, source: 'Brave API Error' };
            }
        }
        
        // Mode simulation si pas d'API key
        return {
            query: query,
            results: [
                { title: `Résultat 1 pour "${query}"`, url: 'https://example.com/1', snippet: 'Description du premier résultat...' },
                { title: `Résultat 2 pour "${query}"`, url: 'https://example.com/2', snippet: 'Description du second résultat...' }
            ],
            note: "Simulation - Ajoutez BRAVE_API_KEY dans .env pour résultats réels"
        };
    },

    // ========================================
    // OUTIL 4: Taux de change (API Réelle)
    // ========================================
    get_exchange_rate: async (params) => {
        const from = (params?.from || 'USD').toUpperCase();
        const to = (params?.to || 'EUR').toUpperCase();
        
        try {
            // API gratuite sans clé
            const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from}`, { timeout: 5000 });
            const rate = response.data.rates[to];
            
            if (!rate) return { error: `Devise ${to} non trouvée` };
            
            return {
                from: from,
                to: to,
                rate: rate,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return { error: "Erreur API taux de change", details: error.message };
        }
    },

    // ========================================
    // OUTIL 5: Date et Heure actuelles
    // ========================================
    get_datetime: async (params) => {
        const timezone = params?.timezone || 'Europe/Paris';
        const now = new Date();
        
        return {
            utc: now.toISOString(),
            local: now.toLocaleString('fr-FR', { timeZone: timezone }),
            timezone: timezone,
            timestamp: now.getTime()
        };
    },

    // ========================================
    // OUTIL 6: Calculatrice
    // ========================================
    calculate: async (params) => {
        const expression = params?.expression || '';
        if (!expression) return { error: "Paramètre 'expression' requis" };
        
        try {
            // Sécurité: On n'utilise que des opérations mathématiques de base
            const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
            if (sanitized !== expression) {
                return { error: "Expression invalide - caractères non autorisés" };
            }
            const result = Function('"use strict"; return (' + sanitized + ')')();
            return { expression: expression, result: result };
        } catch (e) {
            return { error: "Erreur de calcul", details: e.message };
        }
    },

    // ========================================
    // OUTIL 7: Générateur UUID
    // ========================================
    generate_uuid: async (params) => {
        const { v4: uuidv4 } = require('uuid');
        return { uuid: uuidv4() };
    },

    // ========================================
    // OUTIL 8: Données externes (placeholder)
    // ========================================
    get_external_data: async (params) => {
        return { 
            source: "External API", 
            type: "Simulation", 
            message: `Données pour: ${params?.query || 'N/A'}`,
            note: "Configurez une vraie API externe"
        };
    }
};

// Descriptions des outils (pour list_tools et documentation)
const toolDescriptions = {
    list_tools: "Liste tous les outils MCP disponibles",
    get_employees: "Récupère la liste des employés RH",
    web_search: "Recherche sur le web (simulation)",
    get_exchange_rate: "Taux de change en temps réel (from, to)",
    get_datetime: "Date et heure actuelles (timezone optionnel)",
    calculate: "Calculatrice mathématique (expression)",
    generate_uuid: "Génère un identifiant unique UUID",
    get_external_data: "Accès API externe (simulation)"
};

// --- POINT D'ENTRÉE PRINCIPAL (ENDPOINT) ---
app.post('/mcp', authAndQuotaMiddleware, async (req, res) => {
    const { tool, params } = req.body;

    if (!tools[tool]) {
        return res.status(404).json({ 
            error: `Outil '${tool}' inconnu`,
            available_tools: Object.keys(tools)
        });
    }

    try {
        // Exécution de l'outil
        const result = await tools[tool](params);
        res.json({ status: 'success', tool: tool, data: result });
    } catch (error) {
        console.error(`[MCP] Erreur d'exécution:`, error);
        res.status(500).json({ error: "Erreur interne de l'outil", details: error.message });
    }
});

// --- ENDPOINT: Liste des outils disponibles ---
app.get('/mcp/tools', (req, res) => {
    const toolList = Object.keys(tools).map(name => ({
        name: name,
        description: toolDescriptions[name] || 'Outil disponible'
    }));
    res.json({ tools: toolList });
});

// --- DÉMARRAGE ---
app.listen(PORT, () => {
    console.log(`
    🚀 Serveur MCP (AI Bridge) démarré sur le port ${PORT}
    🛡️  Sécurité: Active (Simulation Token)
    💰 Quotas: Actifs (Simulation Débit)
    `);
});

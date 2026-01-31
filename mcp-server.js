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
    // Outil 1 : INTERNE (Lecture données RH)
    get_employees: async (params) => {
        // En vrai: Lire depuis api/employees/all.json ou Base de Données
        // Ici on simule une lecture sécurisée
        const filePath = path.join(__dirname, 'api', 'employees', 'all.json');
        
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            const employees = JSON.parse(data);
            return { 
                count: employees.length, 
                sample: employees.slice(0, 3).map(e => e.name) // On ne renvoie pas tout pour économiser les tokens
            };
        }
        return { error: "Fichier employés non trouvé" };
    },

    // Outil 2 : EXTERNE (Exemple API Météo/Finance)
    // Nécessite une clé API externe
    get_external_data: async (params) => {
        try {
            // Exemple: Appel à une API publique (ici placeholder)
            // const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${params.currency}`);
            // return response.data;
            
            return { 
                source: "External World", 
                type: "Simulation", 
                message: `Connexion externe réussie pour ${params.query}` 
            };
        } catch (error) {
            return { error: "Erreur de connexion externe", details: error.message };
        }
    }
};

// --- POINT D'ENTRÉE PRINCIPAL (ENDPOINT) ---
app.post('/mcp', authAndQuotaMiddleware, async (req, res) => {
    const { tool, params } = req.body;

    if (!tools[tool]) {
        return res.status(404).json({ error: `Outil '${tool}' inconnu` });
    }

    try {
        // Exécution de l'outil
        const result = await tools[tool](params);
        res.json({ status: 'success', data: result });
    } catch (error) {
        console.error(`[MCP] Erreur d'exécution:`, error);
        res.status(500).json({ error: "Erreur interne de l'outil" });
    }
});

// --- DÉMARRAGE ---
app.listen(PORT, () => {
    console.log(`
    🚀 Serveur MCP (AI Bridge) démarré sur le port ${PORT}
    🛡️  Sécurité: Active (Simulation Token)
    💰 Quotas: Actifs (Simulation Débit)
    `);
});

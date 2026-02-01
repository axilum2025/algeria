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
    },

    // ========================================
    // OUTIL 9: 📧 EMAIL - Envoyer un email
    // ========================================
    send_email: async (params) => {
        const { to, subject, body } = params || {};
        if (!to || !subject) return { error: "Paramètres 'to' et 'subject' requis" };
        
        // Option 1: Microsoft Graph API (si configuré)
        const msGraphToken = process.env.MS_GRAPH_TOKEN;
        if (msGraphToken) {
            try {
                await axios.post('https://graph.microsoft.com/v1.0/me/sendMail', {
                    message: {
                        subject: subject,
                        body: { contentType: 'Text', content: body || '' },
                        toRecipients: [{ emailAddress: { address: to } }]
                    }
                }, {
                    headers: { Authorization: `Bearer ${msGraphToken}` }
                });
                return { status: 'sent', to, subject, provider: 'Microsoft Graph' };
            } catch (e) {
                return { error: 'Erreur Microsoft Graph', details: e.message };
            }
        }
        
        // Option 2: SendGrid (si configuré)
        const sendgridKey = process.env.SENDGRID_API_KEY;
        if (sendgridKey) {
            try {
                await axios.post('https://api.sendgrid.com/v3/mail/send', {
                    personalizations: [{ to: [{ email: to }] }],
                    from: { email: process.env.SENDGRID_FROM || 'noreply@axilum.com' },
                    subject: subject,
                    content: [{ type: 'text/plain', value: body || '' }]
                }, {
                    headers: { Authorization: `Bearer ${sendgridKey}` }
                });
                return { status: 'sent', to, subject, provider: 'SendGrid' };
            } catch (e) {
                return { error: 'Erreur SendGrid', details: e.message };
            }
        }
        
        // Simulation si pas d'API configurée
        return { 
            status: 'simulated', 
            to, subject, body: body?.substring(0, 50) + '...',
            note: 'Ajoutez MS_GRAPH_TOKEN ou SENDGRID_API_KEY pour envoyer réellement'
        };
    },

    // ========================================
    // OUTIL 10: 📅 CALENDRIER - Lire les événements
    // ========================================
    get_calendar_events: async (params) => {
        const { days = 7 } = params || {};
        
        // Microsoft Graph API
        const msGraphToken = process.env.MS_GRAPH_TOKEN;
        if (msGraphToken) {
            try {
                const startDate = new Date().toISOString();
                const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
                
                const response = await axios.get(
                    `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDate}&endDateTime=${endDate}`,
                    { headers: { Authorization: `Bearer ${msGraphToken}` } }
                );
                
                return {
                    events: response.data.value.map(e => ({
                        subject: e.subject,
                        start: e.start.dateTime,
                        end: e.end.dateTime,
                        location: e.location?.displayName || ''
                    })),
                    provider: 'Microsoft Graph'
                };
            } catch (e) {
                return { error: 'Erreur Microsoft Graph', details: e.message };
            }
        }
        
        // Google Calendar API
        const googleCalToken = process.env.GOOGLE_CALENDAR_TOKEN;
        if (googleCalToken) {
            try {
                const timeMin = new Date().toISOString();
                const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
                
                const response = await axios.get(
                    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
                    { headers: { Authorization: `Bearer ${googleCalToken}` } }
                );
                
                return {
                    events: response.data.items.map(e => ({
                        subject: e.summary,
                        start: e.start.dateTime || e.start.date,
                        end: e.end.dateTime || e.end.date,
                        location: e.location || ''
                    })),
                    provider: 'Google Calendar'
                };
            } catch (e) {
                return { error: 'Erreur Google Calendar', details: e.message };
            }
        }
        
        // Simulation
        return {
            events: [
                { subject: 'Réunion équipe', start: '2026-02-01T10:00:00', end: '2026-02-01T11:00:00', location: 'Salle A' },
                { subject: 'Déjeuner client', start: '2026-02-02T12:00:00', end: '2026-02-02T14:00:00', location: 'Restaurant' }
            ],
            note: 'Simulation - Ajoutez MS_GRAPH_TOKEN ou GOOGLE_CALENDAR_TOKEN',
            provider: 'Simulation'
        };
    },

    // ========================================
    // OUTIL 11: 📅 CALENDRIER - Créer un événement
    // ========================================
    create_calendar_event: async (params) => {
        const { subject, start, end, location, description } = params || {};
        if (!subject || !start) return { error: "Paramètres 'subject' et 'start' requis" };
        
        const eventEnd = end || new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
        
        // Microsoft Graph
        const msGraphToken = process.env.MS_GRAPH_TOKEN;
        if (msGraphToken) {
            try {
                const response = await axios.post('https://graph.microsoft.com/v1.0/me/events', {
                    subject: subject,
                    start: { dateTime: start, timeZone: 'Europe/Paris' },
                    end: { dateTime: eventEnd, timeZone: 'Europe/Paris' },
                    location: location ? { displayName: location } : undefined,
                    body: description ? { contentType: 'Text', content: description } : undefined
                }, {
                    headers: { Authorization: `Bearer ${msGraphToken}`, 'Content-Type': 'application/json' }
                });
                
                return { status: 'created', id: response.data.id, subject, start, provider: 'Microsoft Graph' };
            } catch (e) {
                return { error: 'Erreur création événement', details: e.message };
            }
        }
        
        // Simulation
        return {
            status: 'simulated',
            subject, start, end: eventEnd, location,
            note: 'Ajoutez MS_GRAPH_TOKEN pour créer réellement'
        };
    },

    // ========================================
    // OUTIL 12: 💬 SLACK - Envoyer un message
    // ========================================
    send_slack_message: async (params) => {
        const { channel, message } = params || {};
        if (!channel || !message) return { error: "Paramètres 'channel' et 'message' requis" };
        
        const slackToken = process.env.SLACK_BOT_TOKEN;
        if (slackToken) {
            try {
                const response = await axios.post('https://slack.com/api/chat.postMessage', {
                    channel: channel,
                    text: message
                }, {
                    headers: { Authorization: `Bearer ${slackToken}`, 'Content-Type': 'application/json' }
                });
                
                if (!response.data.ok) throw new Error(response.data.error);
                return { status: 'sent', channel, ts: response.data.ts, provider: 'Slack' };
            } catch (e) {
                return { error: 'Erreur Slack', details: e.message };
            }
        }
        
        // Webhook Slack (alternative simple)
        const slackWebhook = process.env.SLACK_WEBHOOK_URL;
        if (slackWebhook) {
            try {
                await axios.post(slackWebhook, { text: `[${channel}] ${message}` });
                return { status: 'sent', channel, provider: 'Slack Webhook' };
            } catch (e) {
                return { error: 'Erreur Slack Webhook', details: e.message };
            }
        }
        
        return { status: 'simulated', channel, message: message.substring(0, 50), note: 'Ajoutez SLACK_BOT_TOKEN' };
    },

    // ========================================
    // OUTIL 13: 📱 WHATSAPP - Envoyer un message (via Twilio)
    // ========================================
    send_whatsapp: async (params) => {
        const { to, message } = params || {};
        if (!to || !message) return { error: "Paramètres 'to' et 'message' requis" };
        
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioWhatsapp = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
        
        if (twilioSid && twilioToken) {
            try {
                const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
                const response = await axios.post(
                    `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
                    new URLSearchParams({
                        From: twilioWhatsapp,
                        To: `whatsapp:${to}`,
                        Body: message
                    }),
                    { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
                );
                
                return { status: 'sent', to, sid: response.data.sid, provider: 'Twilio WhatsApp' };
            } catch (e) {
                return { error: 'Erreur Twilio', details: e.message };
            }
        }
        
        return { status: 'simulated', to, message: message.substring(0, 50), note: 'Ajoutez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN' };
    },

    // ========================================
    // OUTIL 14: 📄 PDF - Extraire le texte d'un PDF
    // ========================================
    extract_pdf_text: async (params) => {
        const { filePath, url } = params || {};
        if (!filePath && !url) return { error: "Paramètre 'filePath' ou 'url' requis" };
        
        try {
            // On utilise pdf-parse si installé
            let pdfParse;
            try {
                pdfParse = require('pdf-parse');
            } catch (e) {
                return { error: 'Module pdf-parse non installé', note: 'npm install pdf-parse' };
            }
            
            let dataBuffer;
            if (url) {
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                dataBuffer = Buffer.from(response.data);
            } else {
                const fullPath = path.resolve(filePath);
                if (!fs.existsSync(fullPath)) return { error: `Fichier non trouvé: ${fullPath}` };
                dataBuffer = fs.readFileSync(fullPath);
            }
            
            const data = await pdfParse(dataBuffer);
            return {
                text: data.text.substring(0, 5000), // Limite pour éviter surcharge
                pages: data.numpages,
                info: data.info,
                truncated: data.text.length > 5000
            };
        } catch (e) {
            return { error: 'Erreur extraction PDF', details: e.message };
        }
    },

    // ========================================
    // OUTIL 15: ✈️ CHECK-IN VOL (Simulation)
    // ========================================
    flight_checkin: async (params) => {
        const { confirmationCode, lastName } = params || {};
        if (!confirmationCode || !lastName) return { error: "Paramètres 'confirmationCode' et 'lastName' requis" };
        
        // Note: Les vraies APIs de compagnies aériennes ne sont généralement pas publiques
        // On simule le processus
        return {
            status: 'simulated',
            confirmationCode,
            lastName,
            message: 'Check-in simulé. En production, intégrez l\'API de votre compagnie aérienne ou utilisez un service comme Duffel/Amadeus.',
            note: 'APIs suggérées: Duffel (duffel.com), Amadeus, Travelport'
        };
    },

    // ========================================
    // OUTIL 16: 📧 EMAIL - Lire la boîte de réception
    // ========================================
    get_inbox: async (params) => {
        const { count = 10, unreadOnly = false } = params || {};
        
        // Microsoft Graph API
        const msGraphToken = process.env.MS_GRAPH_TOKEN;
        if (msGraphToken) {
            try {
                const filter = unreadOnly ? '&$filter=isRead eq false' : '';
                const response = await axios.get(
                    `https://graph.microsoft.com/v1.0/me/messages?$top=${count}&$orderby=receivedDateTime desc${filter}`,
                    { headers: { Authorization: `Bearer ${msGraphToken}` } }
                );
                
                return {
                    emails: response.data.value.map(e => ({
                        id: e.id,
                        from: e.from?.emailAddress?.address,
                        subject: e.subject,
                        preview: e.bodyPreview?.substring(0, 100),
                        receivedAt: e.receivedDateTime,
                        isRead: e.isRead
                    })),
                    provider: 'Microsoft Graph'
                };
            } catch (e) {
                return { error: 'Erreur Microsoft Graph', details: e.message };
            }
        }
        
        // Simulation
        return {
            emails: [
                { from: 'client@example.com', subject: 'Devis demandé', preview: 'Bonjour, je souhaite...', receivedAt: '2026-02-01T09:00:00Z', isRead: false },
                { from: 'team@company.com', subject: 'Réunion demain', preview: 'N\'oubliez pas la réunion...', receivedAt: '2026-01-31T16:00:00Z', isRead: true }
            ],
            note: 'Simulation - Ajoutez MS_GRAPH_TOKEN pour lire réellement',
            provider: 'Simulation'
        };
    },

    // ========================================
    // OUTIL 17: 📱 TELEGRAM - Envoyer un message
    // ========================================
    send_telegram: async (params) => {
        const { chatId, message } = params || {};
        if (!chatId || !message) return { error: "Paramètres 'chatId' et 'message' requis" };
        
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        if (telegramToken) {
            try {
                const response = await axios.post(
                    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
                    { chat_id: chatId, text: message, parse_mode: 'HTML' }
                );
                
                return { status: 'sent', chatId, messageId: response.data.result.message_id, provider: 'Telegram' };
            } catch (e) {
                return { error: 'Erreur Telegram', details: e.message };
            }
        }
        
        return { status: 'simulated', chatId, message: message.substring(0, 50), note: 'Ajoutez TELEGRAM_BOT_TOKEN' };
    }
};

// Descriptions des outils (pour list_tools et documentation)
const toolDescriptions = {
    list_tools: "Liste tous les outils MCP disponibles",
    get_employees: "Récupère la liste des employés RH",
    web_search: "Recherche sur le web (Brave API ou simulation)",
    get_exchange_rate: "Taux de change en temps réel (from, to)",
    get_datetime: "Date et heure actuelles (timezone optionnel)",
    calculate: "Calculatrice mathématique (expression)",
    generate_uuid: "Génère un identifiant unique UUID",
    get_external_data: "Accès API externe (simulation)",
    send_email: "📧 Envoyer un email (to, subject, body)",
    get_inbox: "📧 Lire les emails de la boîte de réception",
    get_calendar_events: "📅 Lire les événements du calendrier (days)",
    create_calendar_event: "📅 Créer un événement calendrier (subject, start)",
    send_slack_message: "💬 Envoyer un message Slack (channel, message)",
    send_whatsapp: "📱 Envoyer un WhatsApp via Twilio (to, message)",
    send_telegram: "📱 Envoyer un message Telegram (chatId, message)",
    extract_pdf_text: "📄 Extraire le texte d'un PDF (filePath ou url)",
    flight_checkin: "✈️ Check-in vol (confirmationCode, lastName)"
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

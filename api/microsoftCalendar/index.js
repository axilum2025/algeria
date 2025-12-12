// 📅 Microsoft Calendar - Gestion du calendrier Outlook (Plan PRO)
// Microsoft Graph API: https://learn.microsoft.com/en-us/graph/api/resources/calendar

module.exports = async function (context, req) {
    context.log('📅 Microsoft Calendar API Request');

    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
        return;
    }

    try {
        const action = req.body.action; // 'list', 'create', 'availability'
        const accessToken = req.body.accessToken; // Token Microsoft Graph

        if (!accessToken) {
            context.res = {
                status: 401,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: { error: "Token Microsoft 365 requis. Connectez-vous d'abord." }
            };
            return;
        }

        let result;

        switch (action) {
            case 'list':
                result = await listEvents(accessToken, req.body.startDate, req.body.endDate);
                break;
            
            case 'create':
                result = await createEvent(accessToken, req.body.event);
                break;
            
            case 'availability':
                result = await checkAvailability(accessToken, req.body.date, req.body.time);
                break;
            
            default:
                throw new Error('Action invalide. Utilisez: list, create, availability');
        }

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: result
        };

    } catch (error) {
        context.log.error('❌ Error:', error);
        
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: {
                error: error.message,
                details: 'Erreur lors de l\'accès à Microsoft Calendar'
            }
        };
    }
};

// 📅 Lister les événements du calendrier
async function listEvents(accessToken, startDate, endDate) {
    const startDateTime = startDate || new Date().toISOString();
    const endDateTime = endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendar/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$orderby=start/dateTime`,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Microsoft Graph Error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
        success: true,
        events: data.value.map(event => ({
            id: event.id,
            subject: event.subject,
            start: event.start.dateTime,
            end: event.end.dateTime,
            location: event.location?.displayName,
            attendees: event.attendees?.map(a => a.emailAddress.name),
            isOnline: event.isOnlineMeeting,
            meetingUrl: event.onlineMeeting?.joinUrl
        })),
        count: data.value.length
    };
}

// 📅 Créer un événement
async function createEvent(accessToken, eventData) {
    const event = {
        subject: eventData.subject,
        start: {
            dateTime: eventData.start,
            timeZone: 'Europe/Paris'
        },
        end: {
            dateTime: eventData.end,
            timeZone: 'Europe/Paris'
        },
        location: eventData.location ? {
            displayName: eventData.location
        } : undefined,
        body: eventData.body ? {
            contentType: 'HTML',
            content: eventData.body
        } : undefined,
        attendees: eventData.attendees?.map(email => ({
            emailAddress: {
                address: email
            },
            type: 'required'
        })),
        isOnlineMeeting: eventData.isOnline || false
    };

    const response = await fetch(
        'https://graph.microsoft.com/v1.0/me/calendar/events',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Microsoft Graph Error: ${error.error?.message || response.statusText}`);
    }

    const created = await response.json();
    
    return {
        success: true,
        event: {
            id: created.id,
            subject: created.subject,
            start: created.start.dateTime,
            end: created.end.dateTime,
            webLink: created.webLink,
            meetingUrl: created.onlineMeeting?.joinUrl
        },
        message: `✅ Événement "${created.subject}" créé avec succès`
    };
}

// 📅 Vérifier disponibilité
async function checkAvailability(accessToken, date, time) {
    // Construire la plage horaire à vérifier (1 heure)
    const startDateTime = new Date(`${date}T${time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendar/calendarView?startDateTime=${startDateTime.toISOString()}&endDateTime=${endDateTime.toISOString()}`,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Microsoft Graph Error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const isFree = data.value.length === 0;

    return {
        success: true,
        isFree: isFree,
        date: date,
        time: time,
        conflicts: data.value.map(event => ({
            subject: event.subject,
            start: event.start.dateTime,
            end: event.end.dateTime
        })),
        message: isFree 
            ? `✅ Vous êtes disponible le ${date} à ${time}`
            : `❌ Vous avez ${data.value.length} événement(s) à ce moment`
    };
}

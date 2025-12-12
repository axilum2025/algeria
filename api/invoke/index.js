// Test PRO
module.exports = async function (context, req) {
    context.log('PRO TEST');
    
    if (req.method === 'OPTIONS') {
        context.res = { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } };
        return;
    }

    const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
    
    if (!groqKey) {
        context.res = { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: { error: "GROQ_API_KEY not configured" } };
        return;
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: req.body.message || 'hello' }], max_tokens: 100 })
        });

        const data = await response.json();
        
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: { response: data.choices[0].message.content, proPlan: true, model: 'llama-3.3-70b', provider: 'Groq' }
        };
    } catch (error) {
        context.res = { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: { error: error.message } };
    }
};

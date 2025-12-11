// Test de configuration Azure
module.exports = async function (context, req) {
    context.log('🔍 Test de configuration');

    const config = {
        azureAiKeyExists: !!process.env.AZURE_AI_API_KEY,
        azureAiKeyLength: process.env.AZURE_AI_API_KEY ? process.env.AZURE_AI_API_KEY.length : 0,
        azureAiKeyPreview: process.env.AZURE_AI_API_KEY ? 
            process.env.AZURE_AI_API_KEY.substring(0, 8) + '...' : 'NOT SET',
        groqKeyExists: !!process.env.GROQ_API_KEY,
        allEnvKeys: Object.keys(process.env).filter(k => 
            k.includes('AZURE') || k.includes('GROQ') || k.includes('API')
        ),
        endpoint: 'https://axilimopenai.cognitiveservices.azure.com',
        deployment: 'gpt-5-mini',
        apiVersion: '2024-12-01-preview'
    };

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: config
    };
};

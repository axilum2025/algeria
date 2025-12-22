const fetch = require('node-fetch');

/**
 * Azure Function - Transcription Audio (Speech-to-Text)
 * Transcrit un audio en texte en utilisant l'API Whisper d'OpenAI
 */
module.exports = async function (context, req) {
    context.log('🎤 Demande de transcription audio reçue');

    try {
        const { audio } = req.body;

        if (!audio) {
            context.res = {
                status: 400,
                body: { error: 'Audio manquant' }
            };
            return;
        }

        // Vérifier la présence de la clé API OpenAI
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) {
            context.log.error('❌ OPENAI_API_KEY non configurée');
            context.res = {
                status: 500,
                body: { error: 'Configuration API manquante' }
            };
            return;
        }

        // Convertir base64 en Buffer
        const audioBuffer = Buffer.from(audio, 'base64');
        context.log(`📊 Taille audio: ${(audioBuffer.length / 1024).toFixed(2)} Ko`);

        // Créer un FormData pour l'upload
        const FormData = require('form-data');
        const formData = new FormData();
        
        // Ajouter le fichier audio
        formData.append('file', audioBuffer, {
            filename: 'audio.webm',
            contentType: 'audio/webm'
        });
        
        // Ajouter le modèle
        formData.append('model', 'whisper-1');
        
        // Ajouter la langue (optionnel)
        formData.append('language', 'fr');

        // Appeler l'API Whisper d'OpenAI
        context.log('📤 Envoi à l\'API Whisper...');
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error(`❌ Erreur Whisper API: ${response.status}`, errorText);
            throw new Error(`Erreur API Whisper: ${response.status}`);
        }

        const result = await response.json();
        const transcribedText = result.text || '';

        context.log(`✅ Transcription réussie: ${transcribedText.substring(0, 100)}...`);

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                text: transcribedText,
                language: result.language || 'fr',
                duration: result.duration || null
            }
        };

    } catch (error) {
        context.log.error('❌ Erreur transcription:', error);
        context.res = {
            status: 500,
            body: { 
                error: 'Erreur lors de la transcription',
                details: error.message 
            }
        };
    }
};

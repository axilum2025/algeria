const axios = require('axios');
const { setCors, getAuthEmail } = require('../utils/auth');

const DEFAULT_VOICE = 'fr-FR-DeniseNeural';
const MAX_CHARS = Number(process.env.AZURE_TTS_MAX_CHARS || 1200);
const AZURE_OUTPUT_FORMAT = process.env.AZURE_TTS_FORMAT || 'audio-24khz-48kbitrate-mono-mp3';

function normalizeText(text) {
  if (!text) return '';
  const t = String(text).trim();
  if (!t) return '';
  return t.slice(0, MAX_CHARS);
}

function escapeSsml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSsml(text, voice) {
  const safeText = escapeSsml(text);
  const voiceName = voice || DEFAULT_VOICE;
  const locale = voiceName.includes('-') ? voiceName.split('-').slice(0, 2).join('-') : 'fr-FR';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<speak version="1.0" xml:lang="${locale}"><voice name="${voiceName}">${safeText}</voice></speak>`;
}

module.exports = async function (context, req) {
  if (req.method && req.method.toUpperCase() === 'OPTIONS') {
    setCors(context, 'POST, OPTIONS');
    context.res = { status: 204, body: '' };
    return;
  }

  setCors(context, 'POST, OPTIONS');

  try {
    const speechKey = process.env.AZURE_SPEECH_KEY || process.env.AZURE_COG_SPEECH_KEY || '';
    const speechRegion = process.env.AZURE_SPEECH_REGION || process.env.AZURE_COG_REGION || '';
    if (!speechKey || !speechRegion) {
      context.res = {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Azure Speech non configuré (clé ou région manquante)' }
      };
      return;
    }

    const body = req.body || {};
    const text = normalizeText(body.text);
    const voice = String(body.voice || DEFAULT_VOICE);
    const quality = String(body.quality || '').toLowerCase();
    const plan = String(body.plan || '').toLowerCase();

    if (!text) {
      context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Texte manquant' } };
      return;
    }

    // Garde simple: Azure seulement pour plans PRO/ENTERPRISE
    if (quality === 'azure' && !(plan === 'pro' || plan === 'enterprise')) {
      context.res = { status: 403, headers: { 'Content-Type': 'application/json' }, body: { error: 'Option Azure réservée au plan PRO/ENTERPRISE' } };
      return;
    }

    // Optionnel: rattacher l'email (si authentifié) pour audit
    const email = getAuthEmail(req);

    const url = `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const ssml = buildSsml(text, voice);

    const response = await axios.post(url, ssml, {
      headers: {
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': AZURE_OUTPUT_FORMAT,
        'Ocp-Apim-Subscription-Key': speechKey
      },
      responseType: 'arraybuffer',
      timeout: 15000
    });

    const audioBase64 = Buffer.from(response.data).toString('base64');

    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: {
        ok: true,
        audioBase64,
        contentType: 'audio/mpeg',
        voice,
        chars: text.length,
        planUsed: plan,
        user: email || null
      }
    };
  } catch (e) {
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Erreur TTS Azure', details: String(e?.message || e) }
    };
  }
};

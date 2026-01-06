const { setCors } = require('../utils/auth');

// Metadata for known models: category + short description for UI clarity
const MODEL_META = {
  'openai/gpt-oss-120b': { category: 'Reasoning / Function calling', description: '120B open-weight, tools & search capable' },
  'openai/gpt-oss-20b': { category: 'Reasoning / Function calling', description: '20B open-weight, tools capable' },
  'openai/gpt-oss-safeguard-20b': { category: 'Safety', description: 'Safety GPT OSS 20B (moderation / guardrail)' },
  'qwen/qwen3-32b': { category: 'Reasoning / Function calling / Multilingual', description: 'Qwen3 32B, strong multilingual + tools' },
  'meta-llama/llama-4-scout-17b-16e-instruct': { category: 'Function calling / Vision', description: 'Llama 4 Scout 17B, tools + vision' },
  'meta-llama/llama-4-maverick-17b-128e-instruct': { category: 'Vision', description: 'Llama 4 Maverick 17B, vision' },
  'llama-3.3-70b-versatile': { category: 'Text to text / Multilingual', description: 'Llama 3.3 70B versatile' },
  'llama-3.1-8b-instant': { category: 'Text to text (fast)', description: 'Llama 3.1 8B instant' },
  'meta-llama/llama-guard-4-12b': { category: 'Safety', description: 'Llama Guard 4 12B (content moderation)' },
  'meta-llama/llama-prompt-guard-2-22m': { category: 'Safety', description: 'Prompt Guard 2 (22M)' },
  'meta-llama/llama-prompt-guard-2-86m': { category: 'Safety', description: 'Prompt Guard 2 (86M)' },
  'moonshotai/kimi-k2-instruct': { category: 'Reasoning / Function calling / Multilingual', description: 'Kimi K2 instruct' },
  'moonshotai/kimi-k2-instruct-0905': { category: 'Reasoning / Function calling / Multilingual', description: 'Kimi K2 instruct 0905' },
  'groq/compound': { category: 'System / Agentic', description: 'Groq Compound system (tools/web/code)' },
  'groq/compound-mini': { category: 'System / Agentic', description: 'Groq Compound Mini (tools/web/code)' },
  'canopylabs/orpheus-arabic-saudi': { category: 'Text to speech (Arabic Saudi)', description: 'Orpheus Arabic Saudi TTS' },
  'canopylabs/orpheus-v1-english': { category: 'Text to speech (English)', description: 'Orpheus V1 English TTS' },
  'whisper-large-v3': { category: 'Speech to text', description: 'Whisper Large v3 STT' },
  'whisper-large-v3-turbo': { category: 'Speech to text', description: 'Whisper Large v3 Turbo STT' }
};

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

module.exports = async function (context, req) {
  setCors(context, 'GET, OPTIONS');

  if (String(req.method || '').toUpperCase() === 'OPTIONS') {
    context.res = { status: 204, body: '' };
    return;
  }

  const pricingRaw = String(process.env.AI_PRICING_JSON || '').trim();
  const pricing = pricingRaw ? safeJsonParse(pricingRaw) : null;
  const pricingCurrency = String(process.env.AI_PRICING_CURRENCY || 'EUR').trim().toUpperCase() || 'EUR';

  const models = [];
  if (pricing && typeof pricing === 'object') {
    Object.keys(pricing).forEach((id) => {
      const row = pricing[id] && typeof pricing[id] === 'object' ? pricing[id] : {};
      const cleanId = String(id || '').trim();
      if (!cleanId) return;
      const meta = MODEL_META[cleanId] || {};
      models.push({
        id: cleanId,
        pricingCurrency,
        in: row.in != null ? Number(row.in) : null,
        out: row.out != null ? Number(row.out) : null,
        category: meta.category || null,
        description: meta.description || null
      });
    });
  }

  models.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      ok: true,
      pricingCurrency,
      models
    }
  };
};

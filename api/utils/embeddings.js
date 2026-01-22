const { InsufficientCreditError, getCredit } = require('./userCredits');
const { assertWithinBudget, computeCostFromUsage, eurosToCents, recordUsage } = require('./aiUsageBudget');
const { isCreditEnforced, PricingMissingError } = require('./aiCreditGuard');
const { generateSimpleEmbedding } = require('./simpleEmbedding');

function getAzureEmbeddingsConfig() {
  const endpoint = String(process.env.AZURE_OPENAI_ENDPOINT || '').trim();
  const apiKey = String(process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_AI_API_KEY || '').trim();
  const deployment = String(
    process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT ||
      process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ||
      ''
  ).trim();
  const apiVersion = String(
    process.env.AZURE_OPENAI_EMBEDDINGS_API_VERSION ||
      process.env.AZURE_OPENAI_API_VERSION ||
      '2024-02-15-preview'
  ).trim();
  const modelId = String(
    process.env.AZURE_OPENAI_EMBEDDINGS_MODEL_ID ||
      process.env.AI_EMBEDDINGS_MODEL_ID ||
      deployment ||
      'aoai-embeddings'
  ).trim();

  return { endpoint, apiKey, deployment, apiVersion, modelId };
}

function isAzureEmbeddingsConfigured() {
  const c = getAzureEmbeddingsConfig();
  return Boolean(c.endpoint && c.apiKey && c.deployment);
}

function estimateTokensForEmbeddingText(text) {
  // Heuristique identique à l'estimation prompt (1 token ~ 3 chars)
  const s = String(text || '');
  return Math.max(0, Math.ceil(s.length / 3));
}

function normalizeVectorToDims(vector, dims) {
  const d = Math.max(8, Number(dims) || 0);
  if (!d) return vector;
  const arr = Array.isArray(vector) ? vector : [];
  if (arr.length === d) return arr;
  if (arr.length > d) return arr.slice(0, d);
  const out = arr.slice(0);
  while (out.length < d) out.push(0);
  return out;
}

async function assertUserHasCreditForEstimate({ userId, modelId, estimatedPromptTokens }) {
  if (!isCreditEnforced()) return { enforced: false };

  const uid = String(userId || 'guest');
  const usage = {
    prompt_tokens: Math.max(0, Number(estimatedPromptTokens || 0)),
    completion_tokens: 0,
    total_tokens: Math.max(0, Number(estimatedPromptTokens || 0))
  };

  const estCost = computeCostFromUsage({ model: modelId, usage });
  if (estCost == null) throw new PricingMissingError(modelId);

  const estCents = eurosToCents(estCost);
  const current = await getCredit(uid, { currency: 'EUR' });
  const balanceCents = Number(current.balanceCents || 0);

  if (balanceCents < estCents || balanceCents <= 0) {
    throw new InsufficientCreditError({ remainingCents: balanceCents, currency: current.currency || 'EUR' });
  }

  return { enforced: true, estimatedCost: estCost, estimatedCents: estCents, balanceCents };
}

async function embedTextsWithAzure(texts, { userId = '', route = '', dims = null } = {}) {
  const cfg = getAzureEmbeddingsConfig();
  if (!cfg.endpoint || !cfg.apiKey || !cfg.deployment) {
    const err = new Error('Azure OpenAI embeddings non configuré');
    err.code = 'AZURE_EMBEDDINGS_NOT_CONFIGURED';
    err.status = 500;
    throw err;
  }

  const inputs = (Array.isArray(texts) ? texts : []).map((t) => String(t || ''));
  const cleaned = inputs.map((t) => t.trim());

  // Budget global (mensuel) si activé
  await assertWithinBudget({ provider: 'AzureOpenAI', route, userId });

  // Crédit utilisateur (précheck approximatif) si activé
  const estimatedPromptTokens = cleaned.reduce((acc, t) => acc + estimateTokensForEmbeddingText(t), 0);
  await assertUserHasCreditForEstimate({ userId, modelId: cfg.modelId, estimatedPromptTokens });

  const start = Date.now();
  const url = `${cfg.endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(cfg.deployment)}/embeddings?api-version=${encodeURIComponent(cfg.apiVersion)}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': cfg.apiKey
    },
    body: JSON.stringify({ input: cleaned })
  });

  const latencyMs = Date.now() - start;
  const rawText = await resp.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (_) {
    data = null;
  }

  if (!resp.ok) {
    const err = new Error(`Azure OpenAI embeddings error ${resp.status}`);
    err.status = resp.status;
    err.details = data || rawText;

    // Enregistre aussi l'échec (best-effort)
    try {
      await recordUsage({
        provider: 'AzureOpenAI',
        model: cfg.modelId,
        route,
        userId,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        latencyMs,
        ok: false
      });
    } catch (_) {}

    throw err;
  }

  const rows = Array.isArray(data?.data) ? data.data : [];
  const vectors = rows
    .map((r) => (Array.isArray(r?.embedding) ? r.embedding.map((x) => Number(x)) : []))
    .map((v) => normalizeVectorToDims(v, dims));

  const usage = {
    prompt_tokens: Number(data?.usage?.prompt_tokens || 0),
    completion_tokens: Number(data?.usage?.completion_tokens || 0),
    total_tokens: Number(data?.usage?.total_tokens || 0)
  };

  // Record + débit (best-effort)
  try {
    await recordUsage({
      provider: 'AzureOpenAI',
      model: cfg.modelId,
      route,
      userId,
      usage,
      latencyMs,
      ok: true
    });
  } catch (_) {}

  return {
    provider: 'azure-openai',
    model: cfg.modelId,
    vectors,
    usage,
    latencyMs
  };
}

async function embedTexts(texts, { userId = '', route = '', dims = null, preferAzure = true } = {}) {
  const arr = Array.isArray(texts) ? texts : [];

  if (preferAzure && isAzureEmbeddingsConfigured()) {
    // Batching simple pour limiter taille requête
    const batchSize = Math.max(1, Math.min(32, Number(process.env.AZURE_OPENAI_EMBEDDINGS_BATCH || 16) || 16));
    const allVectors = [];
    let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    let lastMeta = { provider: 'azure-openai', model: getAzureEmbeddingsConfig().modelId, latencyMs: null };

    for (let i = 0; i < arr.length; i += batchSize) {
      const batch = arr.slice(i, i + batchSize);
      const out = await embedTextsWithAzure(batch, { userId, route, dims });
      lastMeta = { provider: out.provider, model: out.model, latencyMs: out.latencyMs };
      out.vectors.forEach((v) => allVectors.push(v));
      totalUsage.prompt_tokens += Number(out.usage?.prompt_tokens || 0);
      totalUsage.completion_tokens += Number(out.usage?.completion_tokens || 0);
      totalUsage.total_tokens += Number(out.usage?.total_tokens || 0);
    }

    return {
      provider: lastMeta.provider,
      model: lastMeta.model,
      vectors: allVectors,
      usage: totalUsage,
      latencyMs: lastMeta.latencyMs
    };
  }

  // Fallback: simple embedding local (pas de coût)
  const vectors = arr.map((t) => generateSimpleEmbedding(String(t || ''), dims || 100)).map((v) => normalizeVectorToDims(v, dims));
  return { provider: 'simple', model: 'simple', vectors, usage: null, latencyMs: 0 };
}

module.exports = {
  getAzureEmbeddingsConfig,
  isAzureEmbeddingsConfigured,
  estimateTokensForEmbeddingText,
  normalizeVectorToDims,
  embedTexts
};

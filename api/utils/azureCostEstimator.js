function parseNumber(value) {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? n : null;
}

function getEnvNumber(name, fallback = 0) {
  const n = parseNumber(process.env[name]);
  return n == null ? fallback : n;
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function getAzureCostConfig() {
  // Tous les montants ci-dessous sont en EUR par défaut. Ils dépendent fortement:
  // - région Azure
  // - tier/sku (Storage, Vision, etc.)
  // - volume
  // Donc on laisse tout configurable par variables d'env.

  return {
    currency: String(process.env.AZ_COST_CURRENCY || 'EUR').trim().toUpperCase() || 'EUR',

    // FIXE (ex: Azure Static Web Apps plan, monitoring, etc.)
    fixedMonthlyEur: getEnvNumber('AZ_COST_FIXED_MONTHLY_EUR', 0),

    // Azure Table Storage (transactions)
    tableEurPer100kTransactions: getEnvNumber('AZ_COST_TABLE_EUR_PER_100K_TXN', 0),

    // Hypothèse: nombre moyen d'opérations Table par appel IA (usage + monthly + credits + budget)
    tableTransactionsPerAiCall: clamp(getEnvNumber('AZ_COST_TABLE_TXN_PER_AI_CALL', 8), 0, 100),

    // Azure Functions (requests)
    functionsEurPerMillionInvocations: getEnvNumber('AZ_COST_FUNCTIONS_EUR_PER_1M_INVOCATIONS', 0),

    // Hypothèse: 1 invocation function par requête API (souvent vrai en SWA)
    functionsInvocationsPerAiCall: clamp(getEnvNumber('AZ_COST_FUNCTIONS_INVOCATIONS_PER_AI_CALL', 1), 0, 10),

    // Blob Storage (stockage + transactions + egress)
    blobEurPerGbMonth: getEnvNumber('AZ_COST_BLOB_EUR_PER_GB_MONTH', 0),
    blobWriteEurPer10k: getEnvNumber('AZ_COST_BLOB_EUR_PER_10K_WRITE', 0),
    blobReadEurPer10k: getEnvNumber('AZ_COST_BLOB_EUR_PER_10K_READ', 0),
    egressEurPerGb: getEnvNumber('AZ_COST_EGRESS_EUR_PER_GB', 0),

    // Cognitive Services (Vision, Form Recognizer)
    visionEurPer1kTransactions: getEnvNumber('AZ_COST_VISION_EUR_PER_1K_TXN', 0),
    formRecognizerEurPer1kPages: getEnvNumber('AZ_COST_FORMRECOGNIZER_EUR_PER_1K_PAGES', 0),

    // Communication Services Email
    emailEurPer1k: getEnvNumber('AZ_COST_EMAIL_EUR_PER_1K', 0)
  };
}

function estimateAzureOverheadEur({
  aiCalls = 0,
  blobStorageGbMonth = 0,
  blobWrites = 0,
  blobReads = 0,
  egressGb = 0,
  visionTransactions = 0,
  formRecognizerPages = 0,
  emailsSent = 0
} = {}) {
  const cfg = getAzureCostConfig();

  const calls = Math.max(0, Number(aiCalls || 0));

  const tableTransactions = Math.max(0, calls * cfg.tableTransactionsPerAiCall);
  const tableCost = (tableTransactions / 100_000) * cfg.tableEurPer100kTransactions;

  const functionsInvocations = Math.max(0, calls * cfg.functionsInvocationsPerAiCall);
  const functionsCost = (functionsInvocations / 1_000_000) * cfg.functionsEurPerMillionInvocations;

  const blobStorageCost = Math.max(0, Number(blobStorageGbMonth || 0)) * cfg.blobEurPerGbMonth;
  const blobWritesCost = (Math.max(0, Number(blobWrites || 0)) / 10_000) * cfg.blobWriteEurPer10k;
  const blobReadsCost = (Math.max(0, Number(blobReads || 0)) / 10_000) * cfg.blobReadEurPer10k;
  const egressCost = Math.max(0, Number(egressGb || 0)) * cfg.egressEurPerGb;

  const visionCost = (Math.max(0, Number(visionTransactions || 0)) / 1_000) * cfg.visionEurPer1kTransactions;
  const formRecognizerCost = (Math.max(0, Number(formRecognizerPages || 0)) / 1_000) * cfg.formRecognizerEurPer1kPages;
  const emailCost = (Math.max(0, Number(emailsSent || 0)) / 1_000) * cfg.emailEurPer1k;

  const fixed = Math.max(0, Number(cfg.fixedMonthlyEur || 0));

  const total =
    fixed +
    tableCost +
    functionsCost +
    blobStorageCost +
    blobWritesCost +
    blobReadsCost +
    egressCost +
    visionCost +
    formRecognizerCost +
    emailCost;

  return {
    currency: cfg.currency,
    assumptions: {
      tableTransactionsPerAiCall: cfg.tableTransactionsPerAiCall,
      functionsInvocationsPerAiCall: cfg.functionsInvocationsPerAiCall
    },
    inputs: {
      aiCalls: calls,
      blobStorageGbMonth: Math.max(0, Number(blobStorageGbMonth || 0)),
      blobWrites: Math.max(0, Number(blobWrites || 0)),
      blobReads: Math.max(0, Number(blobReads || 0)),
      egressGb: Math.max(0, Number(egressGb || 0)),
      visionTransactions: Math.max(0, Number(visionTransactions || 0)),
      formRecognizerPages: Math.max(0, Number(formRecognizerPages || 0)),
      emailsSent: Math.max(0, Number(emailsSent || 0))
    },
    breakdownEur: {
      fixedMonthly: fixed,
      tableTransactions: tableCost,
      functionsInvocations: functionsCost,
      blobStorage: blobStorageCost,
      blobWrites: blobWritesCost,
      blobReads: blobReadsCost,
      egress: egressCost,
      vision: visionCost,
      formRecognizer: formRecognizerCost,
      email: emailCost
    },
    totalEur: Number(total.toFixed(6))
  };
}

function computeRetailPrice({ costEur, marginPct, fixedEur = 0 } = {}) {
  const c = Math.max(0, Number(costEur || 0));
  const m = clamp(Number(marginPct || 0), 0, 5);
  const f = Math.max(0, Number(fixedEur || 0));

  const price = (c + f) * (1 + m);
  return {
    costEur: c,
    fixedEur: f,
    marginPct: m,
    priceEur: Number(price.toFixed(4)),
    marginEur: Number((price - (c + f)).toFixed(4))
  };
}

module.exports = {
  getAzureCostConfig,
  estimateAzureOverheadEur,
  computeRetailPrice
};

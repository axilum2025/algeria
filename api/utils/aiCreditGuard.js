const { InsufficientCreditError, getCredit, debitCredit } = require('./userCredits');
const { estimateCostFromMessages, computeCostFromUsage, eurosToCents } = require('./aiUsageBudget');

class PricingMissingError extends Error {
  constructor(model) {
    super(`Pricing manquant pour le modèle: ${String(model || '')}`);
    this.name = 'PricingMissingError';
    this.code = 'PRICING_MISSING';
    this.status = 500;
  }
}

function isCreditEnforced() {
  return String(process.env.AI_CREDIT_ENFORCE || '').trim() === '1';
}

async function precheckCredit({ userId, model, messages, maxTokens }) {
  if (!isCreditEnforced()) return { enforced: false };

  const uid = String(userId || 'guest');
  const estCost = estimateCostFromMessages({ model, messages, maxTokens });
  if (estCost == null) throw new PricingMissingError(model);

  const estCents = eurosToCents(estCost);
  const current = await getCredit(uid, { currency: 'EUR' });
  const balanceCents = Number(current.balanceCents || 0);

  if (balanceCents < estCents || balanceCents <= 0) {
    throw new InsufficientCreditError({ remainingCents: balanceCents, currency: current.currency || 'EUR' });
  }

  return {
    enforced: true,
    estimatedCostEur: estCost,
    estimatedCents: estCents,
    balanceCents
  };
}

async function debitAfterUsage({ userId, model, usage }) {
  if (!isCreditEnforced()) return null;

  const uid = String(userId || 'guest');
  const actualCost = computeCostFromUsage({ model, usage });
  if (actualCost == null) return null;

  const cents = eurosToCents(actualCost);
  try {
    const debited = await debitCredit(uid, cents, { currency: 'EUR', allowPartial: true });
    return {
      currency: debited.currency || 'EUR',
      balanceCents: Number(debited.balanceCents || 0),
      balanceEur: Number(((Number(debited.balanceCents || 0)) / 100).toFixed(2)),
      debitedCents: Number(debited.debitedCents || 0)
    };
  } catch (e) {
    if (e instanceof InsufficientCreditError || e?.code === 'INSUFFICIENT_CREDIT') {
      return {
        currency: e.currency || 'EUR',
        balanceCents: Number(e.remainingCents || 0),
        balanceEur: Number(((Number(e.remainingCents || 0)) / 100).toFixed(2)),
        debitedCents: 0
      };
    }
    throw e;
  }
}

module.exports = {
  PricingMissingError,
  precheckCredit,
  debitAfterUsage,
  isCreditEnforced
};

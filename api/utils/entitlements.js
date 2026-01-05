const { getUserByEmail } = require('./userStorage');

const PLAN_ORDER = ['free', 'pro', 'enterprise'];

function normalizePlan(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'enterprise' || s === 'entreprise') return 'enterprise';
  if (s === 'pro') return 'pro';
  return 'free';
}

function planAtLeast(plan, minPlan) {
  const p = normalizePlan(plan);
  const m = normalizePlan(minPlan);
  return PLAN_ORDER.indexOf(p) >= PLAN_ORDER.indexOf(m);
}

function getPlanPriority(plan) {
  const p = normalizePlan(plan);
  if (p === 'enterprise') return 'high';
  return 'normal';
}

// Simple feature matrix (à affiner quand billing finalisé)
function hasFeature(plan, featureKey) {
  const p = normalizePlan(plan);
  const f = String(featureKey || '').trim();

  const matrix = {
    excel_chat: { free: true, pro: true, enterprise: true },
    ms_import: { free: true, pro: true, enterprise: true },
    ms_export: { free: false, pro: true, enterprise: true },
    power_automate: { free: false, pro: true, enterprise: true },
    audit_advanced: { free: false, pro: false, enterprise: true }
  };

  if (!matrix[f]) return planAtLeast(p, 'enterprise'); // défaut: ultra conservateur
  return !!matrix[f][p];
}

async function getUserPlan(email) {
  const e = (email || '').toString().trim().toLowerCase();
  if (!e) return 'free';
  const user = await getUserByEmail(e);
  if (!user) return 'free';
  return normalizePlan(user.plan);
}

module.exports = {
  normalizePlan,
  planAtLeast,
  getPlanPriority,
  hasFeature,
  getUserPlan
};

// Silent web refresh helpers
// Goal: allow certain agents (e.g., HR) to benefit from up-to-date web info
// without exposing links/sources/citations to the end user.

function looksTimeSensitiveForHR(question) {
  const q = String(question || '');
  // Keep this heuristic broad but not too aggressive.
  return /(r[ée]cent|2024|2025|2026|nouveaut[ée]s?|tendance|actualit[ée]s?|benchmark|barom[èe]tre|statistique|chiffres?|march[ée]|salaire|r[ée]mun[ée]ration|compensation|taux|turnover|attrition|d[ée]mission|t[ée]l[ée]travail|remote|ia|g[ée]n[ée]rative|sirh|ats)\b/i.test(q);
}

function looksTimeSensitiveForMarketing(question) {
  const q = String(question || '');
  return /(r[ée]cent|2024|2025|2026|nouveaut[ée]s?|tendance|actualit[ée]s?|benchmark|barom[èe]tre|statistique|chiffres?|march[ée]|cpc|cpm|ctr|roas|cac|ltv|seo|sem|google\s*ads|meta\s*ads|facebook\s*ads|tiktok|linkedin|algorithme|update|core\s*update|serp|cookies?|rgpd|attribution|tracking|ga4|analytics|consent|influence|newsletter)\b/i.test(q);
}

function looksTimeSensitiveForDev(question) {
  const q = String(question || '');
  // Typical dev cases that benefit from up-to-date info: versions, breaking changes, recent releases, security advisories.
  return /(r[ée]cent|2024|2025|2026|latest|derni[èe]re\s+version|nouvelle\s+version|release|changelog|breaking\s+change|d[ée]pr[ée]ci[ée]|deprecated|deprecation|cve|vuln[ée]rabilit[ée]|security\s+advisory|patch|hotfix|migration|upgrade|update)\b/i.test(q)
    || /(node(\.js)?\s*(\d+)?|npm|pnpm|yarn|typescript|react|next\.js|vite|webpack|eslint|prettier|python\s*3\.?\d*|pip|django|fastapi|flask|java\s*\d+|spring|dotnet|\.net|kubernetes|k8s|docker|azure|aws|gcp)\b/i.test(q);
}

function looksTimeSensitiveForExcel(question) {
  const q = String(question || '');
  // Excel is usually stable, but up-to-date info matters for new functions/features and Microsoft 365 changes.
  return /(r[ée]cent|2024|2025|2026|nouveaut[ée]s?|tendance|actualit[ée]s?|update|mise\s*[àa]\s*jour|derni[èe]re\s+version|release|changelog|preview|b[ée]ta|insider)\b/i.test(q)
    || /(excel|microsoft\s*365|office\s*365|power\s*query|power\s*pivot|tcd|tableau\s+crois[ée]\s+dynamique|recherchx|xlookup|dynamic\s+array|tableaux?\s+dynamiques?|lambda\b|let\b|python\s+in\s+excel|copilot\s+excel)\b/i.test(q);
}

function looksTimeSensitiveForAlex(question) {
  const q = String(question || '');
  // Finance/compta cases where freshness matters: regulation changes, rates, standards updates, market data.
  return /(r[ée]cent|2024|2025|2026|nouveaut[ée]s?|tendance|actualit[ée]s?|update|mise\s*[àa]\s*jour|changement|r[ée]forme|nouvelle\s+loi|d[ée]cret|arr[êe]t[ée]|instruction|circulaire)\b/i.test(q)
    || /(tva|taxe|imp[oô]t|fiscal|fiscale|fiscalit[ée]|ir|ibs|ifrs|ias|norme\s+comptable|comptabilit[ée]|plan\s+comptable|pcn|gaap|audit|contr[ôo]le\s+interne|conformit[ée]|aml|kyc|fraude)\b/i.test(q)
    || /(taux|inflation|bce|fed|banque\s+centrale|taux\s+directeur|prix|march[ée]|baril|brent|usd|eur|dinar|da)\b/i.test(q);
}

function looksTimeSensitiveForTony(question) {
  const q = String(question || '');
  // Sales/ops cases where freshness matters: market benchmarks, SaaS pricing trends, platform/policy changes.
  return /(r[ée]cent|2024|2025|2026|nouveaut[ée]s?|tendance|actualit[ée]s?|update|mise\s*[àa]\s*jour|benchmark|barom[èe]tre|statistique|chiffres?|march[ée])\b/i.test(q)
    || /(pricing|tarif|prix|benchmark\s+prix|comparatif|concurrent|concurrence|offre|pack|plan\s+pro|plan\s+free|saas|b2b|b2c|onboarding|activation|churn|r[ée]tention|mrr|arr|cac|ltv|nrr|upsell|cross[-\s]?sell|objection|script|prospection|cold\s*email|cold\s*call|linkedin)\b/i.test(q)
    || /(rgpd|cookies?|tracking|google\s*ads|meta\s*ads|linkedin|tiktok|conditions\s+d'utilisation|policy|api\s+pricing|limitation|quota|modification)\b/i.test(q);
}

function looksTimeSensitiveForTodo(question) {
  const q = String(question || '');
  // Task planning usually doesn't need web, but freshness matters for regulations, platform changes, and time-bound events.
  return /(r[ée]cent|2024|2025|2026|nouveaut[ée]s?|tendance|actualit[ée]s?|deadline|date\s+limite|butoir|calendrier|d[ée]lai|planning)\b/i.test(q)
    || /(loi|d[ée]cret|arr[êe]t[ée]|r[èe]glement|conformit[ée]|rgpd|norme|appel\s+d'offres|ao|march[ée]\s+public|subvention|programme)\b/i.test(q)
    || /(google\s*ads|meta\s*ads|linkedin|tiktok|stripe|paypal|azure|aws|gcp|microsoft\s*365|office\s*365|jira|github|gitlab|notion|slack|teams)\b/i.test(q);
}

function sanitizeWebEvidenceForInternalUse(text) {
  let t = String(text || '');
  if (!t.trim()) return '';

  // Remove any trailing Sources section.
  t = t.replace(/\n\s*Sources\s*:\s*[\s\S]*$/i, '');

  // Remove explicit URL lines and any raw URLs.
  t = t.replace(/\n\s*URL\s*:\s*\S+/gi, '');
  // Stop before common closing punctuation to avoid leaving dangling brackets.
  t = t.replace(/https?:\/\/[^\s\]\)]+/g, '');

  // Clean up empty brackets that can remain after URL stripping (e.g., "[]").
  t = t.replace(/\[\s*\]/g, '');

  // Remove evidence markers.
  t = t.replace(/\[S\d+\]\s*/g, '- ');

  // Remove the public-facing header.
  t = t.replace(/\n?\s*Contexte\s+de\s+recherche\s+web[^\n]*\n?/gi, '');

  // Remove bracketed url remnants like "[ ... ]" (common in snippet mode).
  t = t.replace(/\[[^\]]*\]/g, (m) => {
    // Keep brackets if they look like normal text (rare), but drop if it contained a url.
    return /https?:\/\//i.test(m) ? '' : m;
  });

  // Compact whitespace.
  t = t
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  // Safety cap to keep prompts bounded.
  if (t.length > 10_000) t = t.slice(0, 10_000) + '…';

  return t;
}

function buildSilentWebContext(evidenceText) {
  const cleaned = sanitizeWebEvidenceForInternalUse(evidenceText);
  if (!cleaned) return '';
  return `\n\nContexte interne (infos web à jour; NE PAS citer de sources, NE PAS mentionner la recherche web):\n${cleaned}\n`;
}

module.exports = {
  looksTimeSensitiveForHR,
  looksTimeSensitiveForMarketing,
  looksTimeSensitiveForDev,
  looksTimeSensitiveForExcel,
  looksTimeSensitiveForAlex,
  looksTimeSensitiveForTony,
  looksTimeSensitiveForTodo,
  sanitizeWebEvidenceForInternalUse,
  buildSilentWebContext
};

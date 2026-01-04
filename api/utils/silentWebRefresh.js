// Silent web refresh helpers
// Goal: allow certain agents (e.g., HR) to benefit from up-to-date web info
// without exposing links/sources/citations to the end user.

function looksTimeSensitiveForHR(question) {
  const q = String(question || '');
  // Keep this heuristic broad but not too aggressive.
  return /(r[ée]cent|2024|2025|2026|nouveaut[ée]s?|tendance|actualit[ée]s?|benchmark|barom[èe]tre|statistique|chiffres?|march[ée]|salaire|r[ée]mun[ée]ration|compensation|taux|turnover|attrition|d[ée]mission|t[ée]l[ée]travail|remote|ia|g[ée]n[ée]rative|sirh|ats)\b/i.test(q);
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
  sanitizeWebEvidenceForInternalUse,
  buildSilentWebContext
};

// Lightweight language helpers (no external deps)

function normalizeLang(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return 'fr';

  // Common forms
  if (raw === 'en' || raw.startsWith('en-') || raw.startsWith('en_')) return 'en';
  if (raw === 'fr' || raw.startsWith('fr-') || raw.startsWith('fr_')) return 'fr';

  // Human labels
  if (raw.includes('english') || raw.includes('anglais')) return 'en';
  if (raw.includes('french') || raw.includes('français') || raw.includes('francais')) return 'fr';

  return 'fr';
}

function parseAcceptLanguage(headerValue) {
  const raw = String(headerValue || '').trim();
  if (!raw) return '';
  // "en-US,en;q=0.9,fr;q=0.8" => "en-US"
  const first = raw.split(',')[0] || '';
  return first.split(';')[0].trim();
}

function getLangFromReq(req, { fallback = 'fr' } = {}) {
  const body = req?.body || {};
  const query = req?.query || {};
  const headers = req?.headers || {};

  const candidates = [
    body.lang,
    body.language,
    body.locale,
    query.lang,
    query.language,
    headers['x-language'],
    headers['x-lang'],
    parseAcceptLanguage(headers['accept-language'])
  ].filter(Boolean);

  if (candidates.length === 0) return normalizeLang(fallback);
  return normalizeLang(candidates[0]);
}

function getSearchLang(lang) {
  return normalizeLang(lang) === 'en' ? 'en' : 'fr';
}

function getLocaleFromLang(lang) {
  return normalizeLang(lang) === 'en' ? 'en-US' : 'fr-FR';
}

function getResponseLanguageShort(lang) {
  return normalizeLang(lang) === 'en' ? 'Réponds en anglais' : 'Réponds en français';
}

function getResponseLanguageInstruction(lang, { tone = 'clair et professionnel' } = {}) {
  const base = normalizeLang(lang) === 'en' ? 'Réponds en anglais' : 'Réponds en français';
  const t = String(tone || '').trim();
  if (!t) return `${base}.`;
  return `${base}, ${t}.`;
}

module.exports = {
  normalizeLang,
  getLangFromReq,
  getSearchLang,
  getLocaleFromLang,
  getResponseLanguageShort,
  getResponseLanguageInstruction
};

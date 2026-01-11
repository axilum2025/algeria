// Lightweight language helpers (no external deps)

function normalizeLang(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return 'fr';

  // Common forms (BCP-47 / ISO)
  const base = raw.split('-')[0].split('_')[0];
  const supported = new Set([
    'fr', 'en', 'es', 'de', 'it', 'pt',
    'ar', 'zh', 'ja', 'ko', 'ru',
    'tr', 'nl', 'hi', 'th', 'he', 'el',
    'id', 'vi'
  ]);
  if (supported.has(base)) return base;

  // Human labels (FR + EN)
  const labels = [
    { key: 'en', terms: ['english', 'anglais'] },
    { key: 'fr', terms: ['french', 'français', 'francais'] },
    { key: 'es', terms: ['spanish', 'espagnol', 'español', 'espanol'] },
    { key: 'de', terms: ['german', 'allemand', 'deutsch'] },
    { key: 'it', terms: ['italian', 'italien', 'italiano'] },
    { key: 'pt', terms: ['portuguese', 'portugais', 'português', 'portugues'] },
    { key: 'ar', terms: ['arabic', 'arabe', 'العربية'] },
    { key: 'zh', terms: ['chinese', 'chinois', '中文', 'mandarin'] },
    { key: 'ja', terms: ['japanese', 'japonais', '日本語'] },
    { key: 'ko', terms: ['korean', 'coréen', 'coreen', '한국어'] },
    { key: 'ru', terms: ['russian', 'russe', 'русский'] },
    { key: 'tr', terms: ['turkish', 'turc', 'türkçe', 'turkce'] },
    { key: 'nl', terms: ['dutch', 'néerlandais', 'neerlandais', 'nederlands'] },
    { key: 'hi', terms: ['hindi', 'हिन्दी', 'हिंदी'] },
    { key: 'th', terms: ['thai', 'thaï', 'thaï', 'ไทย'] },
    { key: 'he', terms: ['hebrew', 'hébreu', 'hebreu', 'עברית'] },
    { key: 'el', terms: ['greek', 'grec', 'ελληνικά', 'ελληνικα'] },
    { key: 'id', terms: ['indonesian', 'indonésien', 'indonesien', 'bahasa indonesia'] },
    { key: 'vi', terms: ['vietnamese', 'vietnamien', 'tiếng việt', 'tieng viet'] }
  ];

  for (const l of labels) {
    if (l.terms.some(t => raw.includes(String(t).toLowerCase()))) return l.key;
  }

  return 'fr';
}

function getLanguageNameFr(lang) {
  switch (normalizeLang(lang)) {
    case 'en': return 'anglais';
    case 'fr': return 'français';
    case 'es': return 'espagnol';
    case 'de': return 'allemand';
    case 'it': return 'italien';
    case 'pt': return 'portugais';
    case 'ar': return 'arabe';
    case 'zh': return 'chinois';
    case 'ja': return 'japonais';
    case 'ko': return 'coréen';
    case 'ru': return 'russe';
    case 'tr': return 'turc';
    case 'nl': return 'néerlandais';
    case 'hi': return 'hindi';
    case 'th': return 'thaï';
    case 'he': return 'hébreu';
    case 'el': return 'grec';
    case 'id': return 'indonésien';
    case 'vi': return 'vietnamien';
    default: return 'français';
  }
}

function detectLangByScript(text) {
  const s = String(text || '');
  if (!s) return '';

  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(s)) return 'ar';
  if (/[\u3040-\u30FF]/.test(s)) return 'ja';
  // Kanji are shared with Chinese; only treat as Chinese when no kana is present.
  if (/[\u4E00-\u9FFF]/.test(s)) return 'zh';
  if (/[\uAC00-\uD7AF]/.test(s)) return 'ko';
  if (/[\u0400-\u04FF]/.test(s)) return 'ru';
  if (/[\u0900-\u097F]/.test(s)) return 'hi';
  if (/[\u0E00-\u0E7F]/.test(s)) return 'th';
  if (/[\u0590-\u05FF]/.test(s)) return 'he';
  if (/[\u0370-\u03FF]/.test(s)) return 'el';

  return '';
}

function detectLangByGreeting(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const s = raw.toLowerCase();

  // English greetings (support no-space variants)
  if (/\b(good\s*morning|good\s*afternoon|good\s*evening)\b/i.test(raw)) return 'en';
  if (/\b(hello|hi|hey|good\s*day)\b/i.test(raw)) return 'en';

  // French greetings
  if (/\b(bonjour|bonsoir|salut|coucou|bonne\s*nuit)\b/i.test(raw)) return 'fr';

  // Spanish greetings
  if (/\b(hola|buenas|buenos\s*d[ií]as|buenas\s*tardes|buenas\s*noches)\b/i.test(raw)) return 'es';

  // Portuguese greetings
  if (/\b(ol[áa]|bom\s*dia|boa\s*tarde|boa\s*noite)\b/i.test(raw)) return 'pt';

  // Italian greetings
  if (/\b(ciao|buongiorno|buona\s*sera|buonanotte)\b/i.test(raw)) return 'it';

  // German greetings
  if (/\b(hallo|guten\s*morgen|guten\s*tag|guten\s*abend)\b/i.test(raw)) return 'de';

  // Turkish greetings
  if (/\b(merhaba|g[üu]nayd[ıi]n|iyi\s*ak[sş]amlar)\b/i.test(raw)) return 'tr';

  // Dutch greetings
  if (/\b(hallo|goedemorgen|goedenavond)\b/i.test(raw)) return 'nl';

  // Indonesian greetings
  if (/\b(halo|selamat\s*pagi|selamat\s*siang|selamat\s*malam)\b/i.test(raw)) return 'id';

  // Vietnamese greetings
  if (/\b(xin\s*ch[àa]o|ch[àa]o)\b/i.test(raw)) return 'vi';

  return '';
}

function scoreLatinLang(text) {
  const s = ` ${String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim()} `;
  if (!s.trim()) return null;

  const scores = {
    fr: 0,
    en: 0,
    es: 0,
    de: 0,
    it: 0,
    pt: 0,
    nl: 0,
    tr: 0,
    id: 0,
    vi: 0
  };

  const addHits = (lang, words, weight = 1) => {
    for (const w of words) {
      if (!w) continue;
      const token = ` ${String(w).toLowerCase()} `;
      if (s.includes(token)) scores[lang] += weight;
    }
  };

  // Stopwords / markers (small, high-signal list)
  addHits('en', ['the', 'and', 'you', 'your', 'please', 'thanks', 'what', 'why', 'how', 'hello', 'hi', 'hey', 'morning'], 2);
  addHits('fr', ['le', 'la', 'les', 'des', 'est', 'vous', 'merci', 'bonjour', 'pourquoi', 'comment', 'avec'], 2);
  addHits('es', ['hola', 'gracias', 'por', 'para', 'cómo', 'como', 'qué', 'que', 'usted', 'buenos', 'buenas'], 2);
  addHits('de', ['und', 'der', 'die', 'das', 'bitte', 'danke', 'warum', 'wie', 'hallo'], 2);
  addHits('it', ['ciao', 'grazie', 'perché', 'perche', 'come', 'che', 'buongiorno'], 2);
  addHits('pt', ['olá', 'ola', 'obrigado', 'obrigada', 'porquê', 'porque', 'como', 'você', 'voce'], 2);
  addHits('nl', ['hallo', 'dank', 'alstublieft', 'waarom', 'hoe', 'jij', 'u'], 2);
  addHits('tr', ['merhaba', 'teşekkür', 'tesekkur', 'lütfen', 'lutfen', 'neden', 'nasıl', 'nasil'], 2);
  addHits('id', ['halo', 'terima', 'kasih', 'kenapa', 'bagaimana', 'anda'], 2);
  addHits('vi', ['xin', 'chào', 'chao', 'cảm', 'cam', 'ơn', 'on', 'tại', 'sao', 'bạn', 'ban'], 2);

  // Diacritics / punctuation hints
  if (/[¿¡ñ]/.test(text)) scores.es += 3;
  if (/[çœæ]/i.test(text)) scores.fr += 2;
  if (/[ßäöü]/i.test(text)) scores.de += 3;
  if (/[ãõ]/i.test(text)) scores.pt += 2;
  if (/[ğışçöü]/i.test(text)) scores.tr += 3;
  if (/[ăâđêôơư]/i.test(text)) scores.vi += 3;

  // Pick winner
  let best = null;
  let bestScore = 0;
  let secondScore = 0;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestScore) {
      secondScore = bestScore;
      best = k;
      bestScore = v;
    } else if (v > secondScore) {
      secondScore = v;
    }
  }

  if (!best) return null;
  if (bestScore < 2) return null; // too weak
  return { lang: best, score: bestScore, secondScore };
}

function detectLangFromText(text, { fallback = 'fr' } = {}) {
  const raw = String(text || '').trim();
  if (!raw) return normalizeLang(fallback);

  const byGreeting = detectLangByGreeting(raw);
  if (byGreeting) return normalizeLang(byGreeting);

  const byScript = detectLangByScript(raw);
  if (byScript) return normalizeLang(byScript);

  const scored = scoreLatinLang(raw);
  if (scored && scored.lang) return normalizeLang(scored.lang);

  return normalizeLang(fallback);
}

function detectLangFromTextDetailed(text, { fallback = 'fr' } = {}) {
  const raw = String(text || '').trim();
  if (!raw) {
    return { lang: normalizeLang(fallback), confidence: 'low', reason: 'empty' };
  }

  const byGreeting = detectLangByGreeting(raw);
  if (byGreeting) {
    return { lang: normalizeLang(byGreeting), confidence: 'high', reason: 'greeting' };
  }

  const byScript = detectLangByScript(raw);
  if (byScript) {
    return { lang: normalizeLang(byScript), confidence: 'high', reason: 'script' };
  }

  const scored = scoreLatinLang(raw);
  if (scored && scored.lang) {
    const delta = Math.max(0, (scored.score || 0) - (scored.secondScore || 0));
    const confidence = (scored.score >= 4 || delta >= 2) ? 'high' : 'medium';
    return { lang: normalizeLang(scored.lang), confidence, reason: 'latin-score', score: scored.score, delta };
  }

  return { lang: normalizeLang(fallback), confidence: 'low', reason: 'fallback' };
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
  const l = normalizeLang(lang);
  if (l === 'en') return 'Respond in English';
  if (l === 'fr') return 'Réponds en français';
  return `Réponds en ${getLanguageNameFr(l)}`;
}

function getResponseLanguageInstruction(lang, { tone = 'clair et professionnel' } = {}) {
  const l = normalizeLang(lang);

  // For English, use an English instruction to avoid the model "sticking" to French
  // when the rest of the system prompt is in French.
  if (l === 'en') {
    const rawTone = String(tone || '').toLowerCase();
    let englishTone = 'in a clear and professional tone';
    if (rawTone.includes('actionnable') || rawTone.includes('actionable')) englishTone = 'in a clear and actionable way';
    else if (rawTone.includes('orienté') || rawTone.includes('résultat') || rawTone.includes('result')) englishTone = 'in a clear, results-oriented way';
    else if (rawTone.includes('pédagog') || rawTone.includes('pedagog') || rawTone.includes('précis') || rawTone.includes('precis')) englishTone = 'in a clear and precise, educational way';
    else if (rawTone.includes('direct')) englishTone = 'directly and clearly';
    else if (rawTone.includes('structur')) englishTone = 'clearly and in a structured way';
    else if (rawTone.includes('concret') || rawTone.includes('concret')) englishTone = 'with concrete steps';
    else if (rawTone.includes('naturel')) englishTone = 'naturally and clearly';

    return `Respond in English, ${englishTone}. Do not respond in French unless the user explicitly asks.`;
  }

  const base = l === 'fr' ? 'Réponds en français' : `Réponds en ${getLanguageNameFr(l)}`;
  const t = String(tone || '').trim();
  if (!t) return `${base}.`;
  return `${base}, ${t}.`;
}

module.exports = {
  normalizeLang,
  detectLangFromText,
  detectLangFromTextDetailed,
  getLanguageNameFr,
  getLangFromReq,
  getSearchLang,
  getLocaleFromLang,
  getResponseLanguageShort,
  getResponseLanguageInstruction
};

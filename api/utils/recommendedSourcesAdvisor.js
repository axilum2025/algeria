const { assertWithinBudget, recordUsage } = require('./aiUsageBudget');
const { precheckCredit, debitAfterUsage } = require('./aiCreditGuard');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

function normalizeLang(lang) {
  const raw = String(lang || '').toLowerCase();
  return raw.startsWith('en') ? 'en' : 'fr';
}

function safeLower(s) {
  return String(s || '').toLowerCase();
}

function parseHost(url) {
  try {
    const u = new URL(String(url || ''));
    return String(u.hostname || '').toLowerCase();
  } catch (_) {
    return '';
  }
}

function uniqueByHost(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const host = parseHost(e?.url);
    if (!host) continue;
    if (seen.has(host)) continue;
    seen.add(host);
    out.push(e);
  }
  return out;
}

function getCatalog(lang) {
  const isEn = normalizeLang(lang) === 'en';

  const wiki = isEn ? 'https://en.wikipedia.org/' : 'https://fr.wikipedia.org/';

  // Each entry: id, label, url, tags, hosts
  // Goals: auditable, topic-coherent, broad coverage.
  return [
    // General
    { id: 'wikipedia', label: isEn ? 'Wikipedia (starting point)' : 'Wikipédia (point de départ)', url: wiki, tags: ['general', 'science', 'history', 'geography', 'tech'], hosts: ['wikipedia.org', 'en.wikipedia.org', 'fr.wikipedia.org'] },
    { id: 'britannica', label: 'Encyclopædia Britannica', url: 'https://www.britannica.com/', tags: ['general', 'science', 'history', 'geography'], hosts: ['britannica.com', 'www.britannica.com'] },
    { id: 'larousse', label: 'Larousse', url: 'https://www.larousse.fr/', tags: ['general', 'language'], hosts: ['larousse.fr', 'www.larousse.fr'] },

    // Science / space / astronomy / physics
    { id: 'nasa', label: isEn ? 'NASA (official)' : 'NASA (officiel)', url: 'https://www.nasa.gov/', tags: ['science', 'space', 'physics'], hosts: ['nasa.gov', 'www.nasa.gov'] },
    { id: 'esa', label: isEn ? 'ESA (official)' : 'ESA (officiel)', url: 'https://www.esa.int/', tags: ['science', 'space', 'physics'], hosts: ['esa.int', 'www.esa.int'] },
    { id: 'cern', label: 'CERN (official)', url: 'https://home.cern/', tags: ['science', 'physics'], hosts: ['home.cern'] },
    { id: 'eso', label: 'ESO (official)', url: 'https://www.eso.org/', tags: ['science', 'space', 'astronomy'], hosts: ['eso.org', 'www.eso.org'] },
    { id: 'iau', label: 'IAU (official)', url: 'https://www.iau.org/', tags: ['science', 'space', 'astronomy'], hosts: ['iau.org', 'www.iau.org'] },
    { id: 'nso', label: 'National Solar Observatory (official)', url: 'https://nso.edu/', tags: ['science', 'space', 'astronomy'], hosts: ['nso.edu', 'www.nso.edu'] },
    { id: 'cnrs', label: 'CNRS (officiel)', url: 'https://www.cnrs.fr/', tags: ['science', 'physics', 'tech', 'france'], hosts: ['cnrs.fr', 'www.cnrs.fr'] },
    { id: 'inria', label: 'Inria (officiel)', url: 'https://www.inria.fr/', tags: ['tech', 'ai', 'computer_science', 'france'], hosts: ['inria.fr', 'www.inria.fr'] },
    { id: 'iupac', label: 'IUPAC (official)', url: 'https://iupac.org/', tags: ['science', 'chemistry', 'standards'], hosts: ['iupac.org', 'www.iupac.org'] },
    { id: 'ieee', label: 'IEEE (official)', url: 'https://www.ieee.org/', tags: ['tech', 'standards', 'computer_science'], hosts: ['ieee.org', 'www.ieee.org'] },
    { id: 'iso', label: 'ISO (official)', url: 'https://www.iso.org/', tags: ['tech', 'standards', 'policy'], hosts: ['iso.org', 'www.iso.org'] },

    // Environment / climate / earth
    { id: 'ipcc', label: 'IPCC (official)', url: 'https://www.ipcc.ch/', tags: ['climate', 'environment', 'science', 'policy'], hosts: ['ipcc.ch', 'www.ipcc.ch'] },
    { id: 'unep', label: 'UNEP (official)', url: 'https://www.unep.org/', tags: ['environment', 'policy', 'international'], hosts: ['unep.org', 'www.unep.org'] },
    { id: 'wmo', label: 'WMO (official)', url: 'https://wmo.int/', tags: ['climate', 'environment', 'science', 'international'], hosts: ['wmo.int', 'www.wmo.int'] },
    { id: 'noaa', label: 'NOAA (official)', url: 'https://www.noaa.gov/', tags: ['climate', 'environment', 'science', 'weather', 'ocean'], hosts: ['noaa.gov', 'www.noaa.gov'] },
    { id: 'usgs', label: 'USGS (official)', url: 'https://www.usgs.gov/', tags: ['environment', 'geology', 'science', 'earthquakes', 'maps'], hosts: ['usgs.gov', 'www.usgs.gov'] },
    { id: 'meteo_france', label: 'Météo-France (officiel)', url: 'https://meteofrance.com/', tags: ['climate', 'environment', 'weather', 'science', 'france'], hosts: ['meteofrance.com', 'www.meteofrance.com'] },
    { id: 'brgm', label: 'BRGM (officiel)', url: 'https://www.brgm.fr/', tags: ['environment', 'geology', 'science', 'france'], hosts: ['brgm.fr', 'www.brgm.fr'] },
    { id: 'ifremer', label: 'Ifremer (officiel)', url: 'https://www.ifremer.fr/', tags: ['environment', 'ocean', 'science', 'france'], hosts: ['ifremer.fr', 'www.ifremer.fr'] },

    // Energy
    { id: 'iea', label: 'IEA (official)', url: 'https://www.iea.org/', tags: ['energy', 'economy', 'policy', 'international'], hosts: ['iea.org', 'www.iea.org'] },
    { id: 'eia', label: 'U.S. EIA (official)', url: 'https://www.eia.gov/', tags: ['energy', 'stats', 'economy'], hosts: ['eia.gov', 'www.eia.gov'] },
    { id: 'irena', label: 'IRENA (official)', url: 'https://www.irena.org/', tags: ['energy', 'climate', 'international'], hosts: ['irena.org', 'www.irena.org'] },
    { id: 'iaea', label: 'IAEA (official)', url: 'https://www.iaea.org/', tags: ['energy', 'nuclear', 'science', 'international'], hosts: ['iaea.org', 'www.iaea.org'] },
    { id: 'iea_electricity', label: 'IEA — Electricity (official)', url: 'https://www.iea.org/topics/electricity', tags: ['energy', 'stats', 'policy'], hosts: ['iea.org', 'www.iea.org'] },

    // Health / medicine
    { id: 'who', label: isEn ? 'WHO (official)' : 'OMS (officiel)', url: 'https://www.who.int/', tags: ['health', 'medical', 'international'], hosts: ['who.int', 'www.who.int'] },
    { id: 'cdc', label: 'CDC (official)', url: 'https://www.cdc.gov/', tags: ['health', 'medical', 'international'], hosts: ['cdc.gov', 'www.cdc.gov'] },
    { id: 'nih', label: 'NIH (official)', url: 'https://www.nih.gov/', tags: ['health', 'medical'], hosts: ['nih.gov', 'www.nih.gov'] },
    { id: 'pubmed', label: 'PubMed (NCBI)', url: 'https://pubmed.ncbi.nlm.nih.gov/', tags: ['health', 'medical', 'science'], hosts: ['pubmed.ncbi.nlm.nih.gov'] },
    { id: 'clinicaltrials', label: 'ClinicalTrials.gov (official)', url: 'https://clinicaltrials.gov/', tags: ['health', 'medical', 'science'], hosts: ['clinicaltrials.gov', 'www.clinicaltrials.gov'] },
    { id: 'cochrane', label: 'Cochrane (evidence-based)', url: 'https://www.cochrane.org/', tags: ['health', 'medical', 'science'], hosts: ['cochrane.org', 'www.cochrane.org'] },
    { id: 'fda', label: 'FDA (official)', url: 'https://www.fda.gov/', tags: ['health', 'medical', 'drugs', 'food'], hosts: ['fda.gov', 'www.fda.gov'] },
    { id: 'ema', label: 'EMA (official)', url: 'https://www.ema.europa.eu/', tags: ['health', 'medical', 'drugs'], hosts: ['ema.europa.eu', 'www.ema.europa.eu'] },
    { id: 'ecdc', label: 'ECDC (official)', url: 'https://www.ecdc.europa.eu/', tags: ['health', 'medical', 'international'], hosts: ['ecdc.europa.eu', 'www.ecdc.europa.eu'] },
    { id: 'ilo', label: 'ILO (official)', url: 'https://www.ilo.org/', tags: ['employment', 'law', 'policy', 'international', 'stats'], hosts: ['ilo.org', 'www.ilo.org'] },
    { id: 'fao', label: 'FAO (official)', url: 'https://www.fao.org/', tags: ['agriculture', 'food', 'international', 'stats', 'policy'], hosts: ['fao.org', 'www.fao.org'] },

    // France health
    { id: 'inserm', label: 'INSERM (officiel)', url: 'https://www.inserm.fr/', tags: ['health', 'medical', 'science', 'france'], hosts: ['inserm.fr', 'www.inserm.fr'] },
    { id: 'has', label: 'HAS (officiel)', url: 'https://www.has-sante.fr/', tags: ['health', 'medical', 'policy', 'france'], hosts: ['has-sante.fr', 'www.has-sante.fr'] },
    { id: 'anses', label: 'ANSES (officiel)', url: 'https://www.anses.fr/', tags: ['health', 'food', 'environment', 'science', 'france'], hosts: ['anses.fr', 'www.anses.fr'] },
    { id: 'ameli', label: 'Assurance Maladie (ameli.fr)', url: 'https://www.ameli.fr/', tags: ['health', 'medical', 'civic', 'france'], hosts: ['ameli.fr', 'www.ameli.fr'] },

    // Law / civic (FR + EU + EN anchors)
    { id: 'service_public', label: 'Service-Public.fr (officiel)', url: 'https://www.service-public.fr/', tags: ['law', 'civic', 'finance', 'tax', 'france'], hosts: ['service-public.fr', 'www.service-public.fr'] },
    { id: 'legifrance', label: 'Légifrance (officiel)', url: 'https://www.legifrance.gouv.fr/', tags: ['law', 'civic', 'france'], hosts: ['legifrance.gouv.fr', 'www.legifrance.gouv.fr'] },
    { id: 'justice_gouv', label: 'Justice (officiel)', url: 'https://www.justice.gouv.fr/', tags: ['law', 'civic', 'policy', 'france'], hosts: ['justice.gouv.fr', 'www.justice.gouv.fr'] },
    { id: 'cnil', label: 'CNIL (officiel)', url: 'https://www.cnil.fr/', tags: ['privacy', 'law', 'tech', 'france'], hosts: ['cnil.fr', 'www.cnil.fr'] },
    { id: 'eur_lex', label: 'EUR-Lex (official)', url: 'https://eur-lex.europa.eu/', tags: ['law', 'policy', 'international', 'eu'], hosts: ['eur-lex.europa.eu'] },
    { id: 'usa_gov', label: 'USA.gov (official)', url: 'https://www.usa.gov/', tags: ['law', 'civic'], hosts: ['usa.gov', 'www.usa.gov'] },
    { id: 'gov_uk', label: 'GOV.UK (official)', url: 'https://www.gov.uk/', tags: ['law', 'civic', 'policy'], hosts: ['gov.uk', 'www.gov.uk'] },
    { id: 'europa', label: 'Europa.eu (official)', url: 'https://european-union.europa.eu/', tags: ['policy', 'eu', 'law', 'international'], hosts: ['european-union.europa.eu', 'europa.eu', 'www.europa.eu'] },

    // Economy / finance / stats
    { id: 'insee', label: 'INSEE (officiel)', url: 'https://www.insee.fr/', tags: ['stats', 'economy', 'finance', 'france'], hosts: ['insee.fr', 'www.insee.fr'] },
    { id: 'eurostat', label: 'Eurostat (official)', url: 'https://ec.europa.eu/eurostat', tags: ['stats', 'economy', 'policy', 'eu'], hosts: ['ec.europa.eu'] },
    { id: 'worldbank', label: isEn ? 'World Bank (official)' : 'Banque mondiale (officiel)', url: 'https://www.worldbank.org/', tags: ['economy', 'finance', 'stats', 'international', 'policy'], hosts: ['worldbank.org', 'www.worldbank.org'] },
    { id: 'imf', label: 'IMF (official)', url: 'https://www.imf.org/', tags: ['economy', 'finance', 'international', 'policy', 'stats'], hosts: ['imf.org', 'www.imf.org'] },
    { id: 'oecd', label: 'OECD (official)', url: 'https://www.oecd.org/', tags: ['economy', 'stats', 'education', 'policy', 'international'], hosts: ['oecd.org', 'www.oecd.org'] },
    { id: 'ecb', label: 'European Central Bank (official)', url: 'https://www.ecb.europa.eu/', tags: ['finance', 'economy', 'policy', 'eu'], hosts: ['ecb.europa.eu', 'www.ecb.europa.eu'] },
    { id: 'bis', label: 'BIS (official)', url: 'https://www.bis.org/', tags: ['finance', 'economy', 'international', 'policy'], hosts: ['bis.org', 'www.bis.org'] },
    { id: 'banque_de_france', label: 'Banque de France (officiel)', url: 'https://www.banque-france.fr/', tags: ['finance', 'economy', 'france'], hosts: ['banque-france.fr', 'www.banque-france.fr'] },
    { id: 'impots', label: 'impots.gouv.fr (officiel)', url: 'https://www.impots.gouv.fr/', tags: ['finance', 'tax', 'law', 'france'], hosts: ['impots.gouv.fr', 'www.impots.gouv.fr'] },
    { id: 'urssaf', label: 'URSSAF (officiel)', url: 'https://www.urssaf.fr/', tags: ['employment', 'finance', 'law', 'france'], hosts: ['urssaf.fr', 'www.urssaf.fr'] },
    { id: 'wto', label: 'WTO (official)', url: 'https://www.wto.org/', tags: ['economy', 'international', 'policy'], hosts: ['wto.org', 'www.wto.org'] },
    { id: 'itu', label: 'ITU (official)', url: 'https://www.itu.int/', tags: ['tech', 'telecom', 'standards', 'international', 'policy'], hosts: ['itu.int', 'www.itu.int'] },

    // Tech / standards / cybersecurity
    { id: 'nist', label: 'NIST (official)', url: 'https://www.nist.gov/', tags: ['tech', 'cybersecurity', 'standards'], hosts: ['nist.gov', 'www.nist.gov'] },
    { id: 'cisa', label: 'CISA (official)', url: 'https://www.cisa.gov/', tags: ['cybersecurity', 'tech', 'policy'], hosts: ['cisa.gov', 'www.cisa.gov'] },
    { id: 'anssi', label: 'ANSSI (officiel)', url: 'https://www.ssi.gouv.fr/', tags: ['cybersecurity', 'tech', 'policy'], hosts: ['ssi.gouv.fr', 'www.ssi.gouv.fr'] },
    { id: 'enisa', label: 'ENISA (official)', url: 'https://www.enisa.europa.eu/', tags: ['cybersecurity', 'tech', 'policy'], hosts: ['enisa.europa.eu', 'www.enisa.europa.eu'] },
    { id: 'mitre_cve', label: 'MITRE CVE', url: 'https://cve.mitre.org/', tags: ['cybersecurity', 'tech'], hosts: ['cve.mitre.org'] },
    { id: 'owasp', label: 'OWASP', url: 'https://owasp.org/', tags: ['cybersecurity', 'tech'], hosts: ['owasp.org', 'www.owasp.org'] },
    { id: 'ietf', label: 'IETF (standards)', url: 'https://www.ietf.org/', tags: ['tech', 'standards', 'internet'], hosts: ['ietf.org', 'www.ietf.org'] },
    { id: 'w3c', label: 'W3C (standards)', url: 'https://www.w3.org/', tags: ['tech', 'standards', 'internet'], hosts: ['w3.org', 'www.w3.org'] },
    { id: 'mdn', label: 'MDN Web Docs', url: 'https://developer.mozilla.org/', tags: ['tech', 'web'], hosts: ['developer.mozilla.org'] },
    { id: 'python', label: 'Python.org (official)', url: 'https://www.python.org/', tags: ['tech', 'computer_science'], hosts: ['python.org', 'www.python.org'] },
    { id: 'nodejs', label: 'Node.js (official)', url: 'https://nodejs.org/', tags: ['tech', 'computer_science'], hosts: ['nodejs.org', 'www.nodejs.org'] },

    // International / policy / humanitarian
    { id: 'un', label: isEn ? 'United Nations (official)' : 'Nations Unies (officiel)', url: 'https://www.un.org/', tags: ['policy', 'international', 'human_rights', 'civic'], hosts: ['un.org', 'www.un.org'] },
    { id: 'ohchr', label: 'OHCHR (official)', url: 'https://www.ohchr.org/', tags: ['human_rights', 'law', 'policy', 'international'], hosts: ['ohchr.org', 'www.ohchr.org'] },
    { id: 'unhcr', label: 'UNHCR (official)', url: 'https://www.unhcr.org/', tags: ['international', 'policy', 'human_rights', 'migration'], hosts: ['unhcr.org', 'www.unhcr.org'] },
    { id: 'unesco', label: 'UNESCO (official)', url: 'https://www.unesco.org/', tags: ['education', 'culture', 'policy', 'international'], hosts: ['unesco.org', 'www.unesco.org'] },
    { id: 'iom', label: 'IOM (official)', url: 'https://www.iom.int/', tags: ['migration', 'international', 'policy'], hosts: ['iom.int', 'www.iom.int'] },
    { id: 'unodc', label: 'UNODC (official)', url: 'https://www.unodc.org/', tags: ['law', 'policy', 'international', 'crime', 'stats'], hosts: ['unodc.org', 'www.unodc.org'] },

    // Sports
    { id: 'ioc', label: 'International Olympic Committee (official)', url: 'https://olympics.com/ioc', tags: ['sports', 'international'], hosts: ['olympics.com'] },
    { id: 'fifa', label: 'FIFA (official)', url: 'https://www.fifa.com/', tags: ['sports', 'international'], hosts: ['fifa.com', 'www.fifa.com'] },
    { id: 'uefa', label: 'UEFA (official)', url: 'https://www.uefa.com/', tags: ['sports', 'international'], hosts: ['uefa.com', 'www.uefa.com'] },
    { id: 'wada', label: 'WADA (official)', url: 'https://www.wada-ama.org/', tags: ['sports', 'health', 'policy'], hosts: ['wada-ama.org', 'www.wada-ama.org'] }
  ];
}

function detectTopicTags({ text, evidenceClaims } = {}) {
  const t = safeLower(text);
  const tags = new Set();

  const claims = Array.isArray(evidenceClaims) ? evidenceClaims : [];
  for (const c of claims) {
    const type = String(c?.type || '').toUpperCase();
    if (type === 'MEDICAL') { tags.add('health'); tags.add('medical'); }
    if (type === 'LEGAL') { tags.add('law'); tags.add('civic'); }
    if (type === 'TEMPORAL') { tags.add('history'); }
    if (type === 'NUMERIC') { tags.add('stats'); }
  }

  // Broad keyword heuristics
  if (/\b(e\s*=\s*mc\^?2|relativit|physique|quantique|astronom|cosmolog|gravitation|chimie|math(ématique)?s?|photon|atome|molécule)\b/i.test(t)) {
    tags.add('science');
    tags.add('physics');
  }
  if (/\b(nasa|esa|système solaire|planète|galax|soleil|lune|mars|jupiter|saturn|astronom)\b/i.test(t)) {
    tags.add('space');
    tags.add('science');
  }
  if (/\b(climat|climatique|réchauffement|carbone|co2|gaz à effet de serre|giec|ipcc|météo|tempête|ouragan|sécheresse|inondation|biodiversité|pollution)\b/i.test(t)) {
    tags.add('climate');
    tags.add('environment');
    tags.add('science');
  }
  if (/\b(énergie|pétrole|gaz|électricité|nucléaire|renouvelable|solaire|éolien|hydro|charbon)\b/i.test(t)) {
    tags.add('energy');
  }
  if (/\b(symptôme|diagnostic|traitement|médicament|vaccin|maladie|virus|bactérie|cancer|diabète|infection|santé)\b/i.test(t)) {
    tags.add('health');
    tags.add('medical');
  }
  if (/\b(alimentation|nutrition|sécurité alimentaire|additif|intoxication)\b/i.test(t)) {
    tags.add('food');
    tags.add('health');
  }
  if (/\b(loi|article\s+\d+|décret|code\s+(civil|pénal|du travail)|juridique|illégal|légal|justice)\b/i.test(t)) {
    tags.add('law');
    tags.add('civic');
  }
  if (/\b(rgpd|gdpr|données personnelles|privacy|cnil|cookie)\b/i.test(t)) {
    tags.add('privacy');
    tags.add('law');
    tags.add('tech');
  }
  if (/\b(cyber|cybersécurité|sécurité informatique|vulnérabilit|cve|phishing|ransomware|malware|owasp|nist|anssi)\b/i.test(t)) {
    tags.add('cybersecurity');
    tags.add('tech');
  }
  if (/\b(taxe|impôt|tva|facture|bilan|comptabilité|revenu|dépense|budget|inflation|taux d'intérêt|crédit|banque)\b/i.test(t)) {
    tags.add('finance');
    tags.add('economy');
    tags.add('stats');
  }
  if (/\b(chômage|emploi|contrat|salaire|cotisation|urssaf|retraite|travail)\b/i.test(t)) {
    tags.add('employment');
    tags.add('law');
    tags.add('finance');
  }
  if (/\b(école|université|éducation|enseignement|programme|exam(en)?|bac|formation)\b/i.test(t)) {
    tags.add('education');
    tags.add('policy');
  }
  if (/\b(guerre|armée|défense|terrorisme|conflit|géopolitique|onu|nations unies|diplomatie)\b/i.test(t)) {
    tags.add('international');
    tags.add('policy');
  }
  if (/\b(art|musique|cinéma|littérature|peinture|patrimoine|culture|unesco)\b/i.test(t)) {
    tags.add('culture');
  }
  if (/\b(sport|football|coupe du monde|jo|olympique|fifa|uefa|dopage)\b/i.test(t)) {
    tags.add('sports');
  }
  if (/\b(géographie|carte|latitude|longitude|sism(e|ique)|tremblement de terre|volcan)\b/i.test(t)) {
    tags.add('geography');
    tags.add('science');
  }
  if (/\b(api|javascript|node\.js|python|react|sql|postgres|docker|kubernetes|ia|machine learning|llm)\b/i.test(t)) {
    tags.add('tech');
    tags.add('computer_science');
    tags.add('ai');
  }

  // Région/pays : activer les sources nationales uniquement si pertinent.
  if (/\b(france|français|francaise|république française|paris|hexagone|gouv\.fr|service-public|légifrance|insee|urssaf|impots\.gouv)\b/i.test(t)) {
    tags.add('france');
  }

  if (tags.size === 0) tags.add('general');
  return [...tags];
}

function scoreEntry(entry, tags) {
  const entryTags = Array.isArray(entry?.tags) ? entry.tags : [];
  let s = 0;
  for (const tag of tags) {
    if (entryTags.includes(tag)) s += 3;
  }

  const hasHealthTag = entryTags.includes('health') || entryTags.includes('medical');
  const wantsHealth = tags.includes('health') || tags.includes('medical');
  if (hasHealthTag && !wantsHealth) s -= 4;

  const hasLawTag = entryTags.includes('law') || entryTags.includes('civic');
  const wantsLaw = tags.includes('law') || tags.includes('civic');
  if (hasLawTag && !wantsLaw) s -= 4;

  const hasFinanceTag = entryTags.includes('finance') || entryTags.includes('economy') || entryTags.includes('tax') || entryTags.includes('stats');
  const wantsFinance = tags.includes('finance') || tags.includes('economy') || tags.includes('tax') || tags.includes('stats');
  if (hasFinanceTag && !wantsFinance) s -= 2;

  const hasEnergyTag = entryTags.includes('energy');
  const wantsEnergy = tags.includes('energy');
  if (hasEnergyTag && !wantsEnergy) s -= 3;

  const isFranceSpecific = entryTags.includes('france');
  const wantsFrance = tags.includes('france');
  if (isFranceSpecific && !wantsFrance) s -= 4;

  if (tags.includes('space') && entryTags.includes('space')) s += 2;
  if (tags.includes('space') && entryTags.includes('astronomy')) s += 2;
  if (tags.includes('physics') && entryTags.includes('physics')) s += 2;
  if (tags.includes('cybersecurity') && entryTags.includes('cybersecurity')) s += 2;

  if (entryTags.includes('general')) s += 1;
  return s;
}

function pickHeuristic({ lang, text, evidenceClaims, max = 5 } = {}) {
  const catalog = getCatalog(lang);
  const tags = detectTopicTags({ text, evidenceClaims });

  const ranked = catalog
    .map(e => ({ ...e, _score: scoreEntry(e, tags) }))
    .sort((a, b) => (b._score - a._score));

  const picked = uniqueByHost(ranked).slice(0, max);

  return {
    method: 'heuristic',
    tags,
    notes: '',
    suggestedDomains: [],
    sources: picked.map(e => `${e.label} — ${e.url}`)
  };
}

function buildAiPrompt({ lang, tags, catalog }) {
  const isEn = normalizeLang(lang) === 'en';
  const items = (Array.isArray(catalog) ? catalog : []).map((e) => {
    const id = String(e.id);
    const label = String(e.label);
    const url = String(e.url);
    const et = Array.isArray(e.tags) ? e.tags.join(', ') : '';
    return `- ${id}: ${label} (${url}) [tags: ${et}]`;
  }).join('\n');

  if (isEn) {
    return `You select the best authoritative sources for auditing a text.

INPUT TOPIC TAGS:
${tags.join(', ')}

CATALOG (choose from these only):
${items}

RULES:
- Select 3 to 5 items ONLY from the catalog.
- Prefer official / authoritative domains for the topic tags.
- If the topic is legal/medical, prioritize official institutions.
- You MAY suggest up to 3 additional authoritative domains NOT in the catalog (audit-only).
- Output ONLY valid JSON.

EXPECTED JSON:
{\n  "selectedIds": ["id1", "id2"],\n  "suggestedDomains": [{"name": "...", "url": "https://...", "reason": "...", "tags": ["..."]}],\n  "notes": "short"\n}`;
  }

  return `Tu sélectionnes les meilleures sources autoritatives pour auditer un texte.

TAGS DE SUJET:
${tags.join(', ')}

CATALOGUE (choisir uniquement dedans) :
${items}

RÈGLES:
- Sélectionne 3 à 5 éléments UNIQUEMENT depuis le catalogue.
- Privilégie les domaines officiels/autoritatifs selon les tags.
- Si juridique/médical, priorise les institutions officielles.
- Tu PEUX suggérer jusqu'à 3 domaines additionnels autoritatifs NON présents dans le catalogue (audit uniquement).
- Réponds UNIQUEMENT en JSON valide.

JSON ATTENDU:
{\n  "selectedIds": ["id1", "id2"],\n  "suggestedDomains": [{"name": "...", "url": "https://...", "reason": "...", "tags": ["..."]}],\n  "notes": "court"\n}`;
}

async function callGroqSelect({ userId, prompt }) {
  const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY non configurée');

  await assertWithinBudget({ provider: 'Groq', route: 'recommendedSourcesAdvisor', userId: userId || '' });

  const messages = [
    { role: 'system', content: 'Reply only valid JSON.' },
    { role: 'user', content: prompt }
  ];

  await precheckCredit({
    userId: userId || 'guest',
    model: GROQ_MODEL,
    messages,
    maxTokens: 280
  });

  const startedAt = Date.now();
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.0,
      max_tokens: 280,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  await debitAfterUsage({ userId: userId || 'guest', model: data?.model || GROQ_MODEL, usage: data?.usage });

  try {
    await recordUsage({
      provider: 'Groq',
      model: data?.model || GROQ_MODEL,
      route: 'recommendedSourcesAdvisor',
      userId: String(userId || ''),
      usage: data?.usage,
      latencyMs: Date.now() - startedAt,
      ok: true
    });
  } catch (_) {
    // best-effort
  }

  const text = data?.choices?.[0]?.message?.content || '';
  return JSON.parse(text);
}

async function callGeminiSelect({ prompt }) {
  const geminiKey = process.env.APPSETTING_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('GEMINI_API_KEY non configurée');

  const res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 280,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Pas de JSON valide dans la réponse Gemini');
  return JSON.parse(jsonMatch[0]);
}

function sanitizeSelectedIds(selectedIds, catalog) {
  const allowed = new Set((Array.isArray(catalog) ? catalog : []).map(e => String(e.id)));
  const arr = Array.isArray(selectedIds) ? selectedIds : [];
  const out = [];
  for (const id of arr) {
    const sid = String(id || '').trim();
    if (!sid) continue;
    if (!allowed.has(sid)) continue;
    if (out.includes(sid)) continue;
    out.push(sid);
    if (out.length >= 6) break;
  }
  return out;
}

function sanitizeSuggestedDomains(suggestedDomains, catalog) {
  const arr = Array.isArray(suggestedDomains) ? suggestedDomains : [];
  const out = [];
  const seenHost = new Set();

  const catalogHosts = new Set(
    (Array.isArray(catalog) ? catalog : [])
      .flatMap(e => Array.isArray(e?.hosts) ? e.hosts : [])
      .map(h => String(h || '').toLowerCase())
      .filter(Boolean)
  );

  for (const item of arr) {
    const name = String(item?.name || '').replace(/\s+/g, ' ').trim();
    const url = String(item?.url || '').trim();
    const reason = String(item?.reason || '').replace(/\s+/g, ' ').trim();
    const tags = Array.isArray(item?.tags) ? item.tags.map(t => String(t || '').trim()).filter(Boolean).slice(0, 8) : [];
    if (!name || !url) continue;
    if (!/^https:\/\//i.test(url)) continue;

    const host = parseHost(url);
    if (!host || host.length < 4) continue;
    if (seenHost.has(host)) continue;

    let isAlreadyKnown = false;
    for (const ch of catalogHosts) {
      if (host === ch || host.endsWith(`.${ch}`)) { isAlreadyKnown = true; break; }
    }
    if (isAlreadyKnown) continue;

    if (/(facebook|x\.com|twitter|tiktok|instagram|youtube|reddit|medium\.com|blogspot|wordpress\.com)/i.test(host)) continue;

    if (!/\.(gov|gouv|int|edu|org|eu|fr|uk)$/.test(host) && !/(\.gov\.)/.test(host)) continue;

    seenHost.add(host);
    out.push({ name, url, reason, tags });
    if (out.length >= 3) break;
  }

  return out;
}

async function pickWithAiFromCatalog({ userId, lang, text, evidenceClaims, max = 5 } = {}) {
  const catalog = getCatalog(lang);
  const tags = detectTopicTags({ text, evidenceClaims });
  const prompt = buildAiPrompt({ lang, tags, catalog });

  let out = null;
  try {
    out = await callGroqSelect({ userId, prompt });
  } catch (_) {
    try {
      out = await callGeminiSelect({ prompt });
    } catch (_) {
      out = null;
    }
  }

  if (!out) return null;

  const selected = sanitizeSelectedIds(out?.selectedIds, catalog);
  if (selected.length < 3) return null;

  const suggestedDomains = sanitizeSuggestedDomains(out?.suggestedDomains, catalog);

  const byId = new Map(catalog.map(e => [String(e.id), e]));
  const picked = uniqueByHost(selected.map(id => byId.get(id)).filter(Boolean)).slice(0, max);
  if (picked.length < 3) return null;

  return {
    method: 'ai_catalog',
    tags,
    notes: String(out?.notes || ''),
    suggestedDomains,
    sources: picked.map(e => `${e.label} — ${e.url}`)
  };
}

function hasAnyAiKey() {
  const groqKey = process.env.APPSETTING_GROQ_API_KEY || process.env.GROQ_API_KEY;
  const geminiKey = process.env.APPSETTING_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  return !!(groqKey || geminiKey);
}

async function getRecommendedSourcesForAudit({ userId, lang, text, evidenceClaims, max = 5, preferAi = true } = {}) {
  const normalized = normalizeLang(lang);
  const content = String(text || '').trim();

  if (preferAi && hasAnyAiKey()) {
    const aiPicked = await pickWithAiFromCatalog({ userId, lang: normalized, text: content, evidenceClaims, max });
    if (aiPicked && Array.isArray(aiPicked.sources) && aiPicked.sources.length) {
      return aiPicked;
    }
  }

  return pickHeuristic({ lang: normalized, text: content, evidenceClaims, max });
}

module.exports = {
  getRecommendedSourcesForAudit,
  detectTopicTags,
  getCatalog,
  normalizeLang
};

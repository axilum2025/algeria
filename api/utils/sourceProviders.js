// Source providers for evidence-backed answers (Wesh)
// - Wikipedia (no key)
// - NewsAPI.org (optional key)
// - Semantic Scholar (no key, optional key)

function withTimeout(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}

function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
}

function maxSourceIndexFromContext(ctx) {
  const text = String(ctx || '');
  let max = 0;
  const re = /\[S(\d+)\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

function formatEvidenceBlock({ id, title, url, snippet, extracts }) {
  const safeTitle = normalizeWhitespace(title) || '(sans titre)';
  const safeUrl = String(url || '').trim();
  let out = `\n[S${id}] ${safeTitle} — ${safeUrl}\n`;
  const sn = normalizeWhitespace(snippet);
  if (sn) out += `Snippet: ${sn}\n`;

  const ex = Array.isArray(extracts) ? extracts.map(normalizeWhitespace).filter(Boolean) : [];
  if (ex.length) {
    out += 'Extraits:\n';
    ex.slice(0, 3).forEach((e) => {
      out += `- ${e}\n`;
    });
  }
  return out;
}

function appendEvidenceContext(existingContext, sources, { header } = {}) {
  const list = Array.isArray(sources) ? sources.filter(Boolean) : [];
  if (list.length === 0) return String(existingContext || '');

  let ctx = String(existingContext || '');
  let nextId = maxSourceIndexFromContext(ctx) + 1;

  // If no header yet, start a new evidence context.
  if (!ctx.trim()) {
    ctx = header || '\n\nContexte de recherche web (preuves; cite [S#] dans la réponse) :\n';
    nextId = 1;
  }

  list.forEach((s) => {
    ctx += formatEvidenceBlock({
      id: nextId,
      title: s.title,
      url: s.url,
      snippet: s.snippet,
      extracts: s.extracts
    });
    nextId += 1;
  });

  return ctx;
}

async function searchWikipedia(query, {
  lang = 'fr',
  limit = 2,
  timeoutMs = 5000
} = {}) {
  const q = normalizeWhitespace(query);
  if (!q) return [];

  const { signal, clear } = withTimeout(timeoutMs);
  try {
    // Search titles first
    const searchUrl = `https://${lang}.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`;
    const searchResp = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal
    });

    if (!searchResp.ok) return [];
    const searchData = await searchResp.json();
    const pages = Array.isArray(searchData?.pages) ? searchData.pages : [];

    const top = pages.slice(0, limit);
    const results = [];

    for (const p of top) {
      const title = p?.title || p?.key || '';
      if (!title) continue;

      // Get summary/extract
      const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const sumResp = await fetch(summaryUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal
      });

      if (!sumResp.ok) continue;
      const sum = await sumResp.json();

      const pageUrl = sum?.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s/g, '_'))}`;
      const extract = normalizeWhitespace(sum?.extract || '');

      results.push({
        title: sum?.title || title,
        url: pageUrl,
        snippet: p?.description || 'Résumé Wikipédia',
        extracts: extract ? [extract.slice(0, 700)] : []
      });
    }

    return results;
  } catch (_) {
    return [];
  } finally {
    clear();
  }
}

async function searchNewsApi(query, {
  apiKey,
  language = 'fr',
  pageSize = 3,
  timeoutMs = 5000
} = {}) {
  const q = normalizeWhitespace(query);
  const key = String(apiKey || '').trim();
  if (!q || !key) return [];

  const { signal, clear } = withTimeout(timeoutMs);
  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&pageSize=${encodeURIComponent(pageSize)}&language=${encodeURIComponent(language)}&sortBy=publishedAt`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'X-Api-Key': key },
      signal
    });

    if (!resp.ok) return [];
    const data = await resp.json();
    const articles = Array.isArray(data?.articles) ? data.articles : [];

    return articles.slice(0, pageSize).map((a) => {
      const title = a?.title || '(sans titre)';
      const url = a?.url || '';
      const source = a?.source?.name ? `NewsAPI: ${a.source.name}` : 'NewsAPI';
      const publishedAt = a?.publishedAt ? `Publié: ${String(a.publishedAt).slice(0, 10)}` : '';
      const snippet = normalizeWhitespace([source, publishedAt].filter(Boolean).join(' • '));

      // Important: do not scrape/paywall news pages here; keep to API-provided description.
      const desc = normalizeWhitespace(a?.description || a?.content || '');
      const extracts = desc ? [desc.slice(0, 700)] : [];

      return { title, url, snippet, extracts };
    }).filter(r => r.url);
  } catch (_) {
    return [];
  } finally {
    clear();
  }
}

async function searchSemanticScholar(query, {
  apiKey,
  limit = 2,
  timeoutMs = 5000
} = {}) {
  const q = normalizeWhitespace(query);
  const lim = Math.max(1, Math.min(10, Number(limit) || 2));
  const key = String(apiKey || '').trim();
  if (!q) return [];

  const { signal, clear } = withTimeout(timeoutMs);
  try {
    const fields = [
      'title',
      'url',
      'abstract',
      'authors',
      'year',
      'venue',
      'citationCount',
      'isOpenAccess',
      'openAccessPdf'
    ].join(',');

    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=${encodeURIComponent(lim)}&offset=0&fields=${encodeURIComponent(fields)}`;

    const headers = { 'Accept': 'application/json' };
    if (key) headers['x-api-key'] = key;

    const resp = await fetch(url, {
      method: 'GET',
      headers,
      signal
    });

    if (!resp.ok) return [];
    const data = await resp.json();
    const papers = Array.isArray(data?.data) ? data.data : [];

    return papers.slice(0, lim).map((p) => {
      const title = normalizeWhitespace(p?.title || '(sans titre)');
      const venue = normalizeWhitespace(p?.venue || '');
      const year = p?.year ? String(p.year) : '';
      const citationCount = Number.isFinite(p?.citationCount) ? p.citationCount : null;

      const authors = Array.isArray(p?.authors) ? p.authors.map(a => normalizeWhitespace(a?.name)).filter(Boolean) : [];
      const authorsShort = authors.slice(0, 3).join(', ');

      const oaUrl = p?.openAccessPdf?.url ? String(p.openAccessPdf.url) : '';
      const paperUrl = String(p?.url || '').trim();
      const url = paperUrl || oaUrl;

      const parts = ['Semantic Scholar'];
      if (venue) parts.push(venue);
      if (year) parts.push(year);
      if (citationCount !== null) parts.push(`Citations: ${citationCount}`);
      if (authorsShort) parts.push(`Auteurs: ${authorsShort}`);

      const snippet = normalizeWhitespace(parts.join(' • '));
      const abs = normalizeWhitespace(p?.abstract || '');
      const extracts = abs ? [abs.slice(0, 900)] : [];

      return {
        title,
        url,
        snippet,
        extracts
      };
    }).filter(r => r.url);
  } catch (_) {
    return [];
  } finally {
    clear();
  }
}

module.exports = {
  appendEvidenceContext,
  searchWikipedia,
  searchNewsApi,
  searchSemanticScholar
};

// Web evidence builder (Perplexity-like lite)
// - Fetches pages from search results
// - Extracts readable text
// - Selects the most relevant passages

const cheerio = require('cheerio');

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function withTimeout(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}

async function fetchHtml(url, { timeoutMs = 7000, maxBytes = 1_200_000 } = {}) {
  const { signal, clear } = withTimeout(timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        // A simple UA helps avoid 403 on some sites.
        'User-Agent': 'AxilumWesh/1.0 (+https://example.invalid)'
      },
      signal
    });

    if (!resp.ok) {
      return { ok: false, reason: `HTTP ${resp.status}` };
    }

    const contentType = String(resp.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return { ok: false, reason: `Unsupported content-type: ${contentType || 'unknown'}` };
    }

    // Read streaming up to maxBytes (keeps first bytes, avoids failing on large pages).
    let buf;
    let truncated = false;
    if (resp.body && typeof resp.body.getReader === 'function') {
      const reader = resp.body.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.length === 0) continue;

        const remaining = maxBytes - total;
        if (remaining <= 0) {
          truncated = true;
          break;
        }

        if (value.length > remaining) {
          chunks.push(Buffer.from(value.subarray(0, remaining)));
          total += remaining;
          truncated = true;
          break;
        }

        chunks.push(Buffer.from(value));
        total += value.length;
      }
      buf = Buffer.concat(chunks);
    } else {
      buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length > maxBytes) {
        buf = buf.subarray(0, maxBytes);
        truncated = true;
      }
    }

    const html = buf.toString('utf8');
    return { ok: true, html, contentType, truncated };
  } catch (e) {
    const msg = String(e?.name === 'AbortError' ? 'timeout' : (e?.message || e));
    return { ok: false, reason: msg };
  } finally {
    clear();
  }
}

function extractMainText(html) {
  const $ = cheerio.load(html);

  $('script, style, noscript, svg, canvas, iframe').remove();

  const title = normalizeWhitespace($('title').first().text()) || null;

  const metaDescription = normalizeWhitespace(
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    ''
  ) || null;

  const main = $('main').first();
  const article = $('article').first();
  const root = (main && main.length ? main : (article && article.length ? article : $('body')));

  // Prefer structured blocks; fallback to plain text.
  const blocks = [];

  // Seed with meta description when available (often a concise summary).
  if (metaDescription && metaDescription.length >= 60) {
    blocks.push(metaDescription);
  }

  root.find('h1,h2,h3,p,li').each((_, el) => {
    const t = normalizeWhitespace($(el).text());
    if (t.length >= 60) blocks.push(t);
  });

  let text = blocks.length ? blocks.join('\n') : normalizeWhitespace(root.text());
  // Safety cap: keep extraction bounded for scoring + prompt context.
  if (text.length > 120_000) text = text.slice(0, 120_000);
  return { title, text };
}

function generateSimpleEmbedding(text, dims = 128) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const emb = new Array(dims).fill(0);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dims;
    emb[idx] += 1;
  }

  const mag = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
  return mag > 0 ? emb.map(v => v / mag) : emb;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function chunkText(text, { maxChars = 900, overlap = 120 } = {}) {
  const t = String(text || '').trim();
  if (!t) return [];

  // Prefer paragraph/line-based chunking when possible (better semantic locality).
  const lines = t.includes('\n') ? t.split(/\n+/).map(normalizeWhitespace).filter(Boolean) : [t];
  const chunks = [];

  let current = '';
  let carry = [];
  for (const line of lines) {
    if (!line) continue;

    // flush if next line would overflow
    if (current && (current.length + 1 + line.length) > maxChars) {
      const cleaned = normalizeWhitespace(current);
      if (cleaned.length >= 120) chunks.push(cleaned);

      // overlap: keep last ~2 lines
      carry = carry.slice(-2);
      current = carry.length ? carry.join(' ') : '';
    }

    current = current ? `${current} ${line}` : line;
    carry.push(line);
  }

  const final = normalizeWhitespace(current);
  if (final.length >= 120) chunks.push(final);

  // Fallback if overlap/line logic produced nothing
  if (chunks.length === 0) {
    const cleaned = normalizeWhitespace(t.slice(0, maxChars));
    if (cleaned.length) chunks.push(cleaned);
  }

  return chunks;
}

function extractKeywords(text) {
  const stop = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'et', 'ou', 'en', 'dans', 'sur', 'pour', 'par',
    'avec', 'sans', 'plus', 'moins', 'est', 'sont', 'etre', 'être', 'au', 'aux', 'ce', 'ces', 'cette',
    'que', 'qui', 'quoi', 'dont', 'où', 'comment', 'pourquoi', 'quel', 'quelle', 'quels', 'quelles'
  ]);

  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stop.has(w))
  );
}

function keywordOverlapScore(question, passage) {
  const q = extractKeywords(question);
  if (q.size === 0) return 0;
  const p = extractKeywords(passage);
  let hit = 0;
  for (const w of q) if (p.has(w)) hit += 1;
  return hit / Math.min(q.size, 12);
}

function scorePassage(question, passage) {
  const qEmb = generateSimpleEmbedding(question);
  const pEmb = generateSimpleEmbedding(passage);
  const cos = cosineSimilarity(qEmb, pEmb);
  const kw = keywordOverlapScore(question, passage);
  // Mix: keep semantic signal but ensure keyword anchoring.
  return (0.65 * cos) + (0.35 * kw);
}

function pickTopPassages(question, text, { topK = 4 } = {}) {
  const chunks = chunkText(text);
  if (chunks.length === 0) return [];

  // Slightly prefer earlier passages: definitions/summaries are usually near the top.
  const denom = Math.max(1, chunks.length - 1);
  const scored = chunks.map((c, idx) => {
    const base = scorePassage(question, c);
    const positionBonus = 0.08 * (1 - (idx / denom));
    return { passage: c, score: base + positionBonus };
  });

  return scored
    .sort((x, y) => y.score - x.score)
    .slice(0, topK)
    .map(x => x.passage);
}

async function buildWebEvidenceContext({ question, searchResults, timeoutMs = 7000, maxSources = 3 } = {}) {
  const q = String(question || '').trim();
  const results = Array.isArray(searchResults) ? searchResults.slice(0, maxSources) : [];
  if (!q || results.length === 0) return '';

  const settled = await Promise.allSettled(results.map(async (r) => {
    const url = String(r?.url || '').trim();
    if (!url) return { ok: false, url: null, reason: 'missing url' };

    const fetched = await fetchHtml(url, { timeoutMs });
    if (!fetched.ok) {
      return {
        ok: false,
        url,
        title: r?.title || null,
        description: r?.description || null,
        reason: fetched.reason
      };
    }

    const extracted = extractMainText(fetched.html);
    return {
      ok: true,
      url,
      title: extracted.title || r?.title || null,
      description: r?.description || null,
      text: extracted.text || ''
    };
  }));

  const sources = settled
    .map(s => s.status === 'fulfilled' ? s.value : ({ ok: false, reason: String(s.reason || 'failed') }))
    .filter(Boolean);

  let ctx = '\n\nContexte de recherche web (preuves; cite [S#] dans la réponse) :\n';

  sources.forEach((src, idx) => {
    const sId = `S${idx + 1}`;
    const title = normalizeWhitespace(src.title || '') || '(sans titre)';
    const url = src.url || '';

    ctx += `\n[${sId}] ${title} — ${url}\n`;

    if (src.description) {
      ctx += `Snippet: ${normalizeWhitespace(src.description)}\n`;
    }

    if (src.ok && src.text) {
      const passages = pickTopPassages(q, src.text, { topK: 3 });
      if (passages.length) {
        ctx += 'Extraits:\n';
        passages.forEach(p => {
          ctx += `- ${p}\n`;
        });
      } else {
        ctx += 'Extrait: (aucun passage exploitable)\n';
      }
    } else {
      ctx += `Note: lecture page impossible (${src.reason || 'unknown'})\n`;
    }
  });

  return ctx;
}

module.exports = {
  buildWebEvidenceContext
};

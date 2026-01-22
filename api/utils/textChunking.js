function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function chunkText(text, { maxChars = 1200, overlap = 150 } = {}) {
  const t = String(text || '').trim();
  if (!t) return [];

  const paragraphs = t
    .split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(Boolean);

  const chunks = [];
  let buf = '';

  const flush = () => {
    const out = normalizeWhitespace(buf);
    if (out) chunks.push(out);
    buf = '';
  };

  for (const p of paragraphs.length ? paragraphs : [t]) {
    const candidate = buf ? `${buf}\n\n${p}` : p;
    if (candidate.length <= maxChars) {
      buf = candidate;
      continue;
    }

    if (buf) flush();

    if (p.length <= maxChars) {
      buf = p;
      continue;
    }

    // Hard split very long paragraphs.
    let start = 0;
    while (start < p.length) {
      const end = Math.min(p.length, start + maxChars);
      const slice = p.slice(start, end);
      chunks.push(normalizeWhitespace(slice));
      if (end >= p.length) break;
      start = Math.max(0, end - overlap);
    }
  }

  if (buf) flush();
  return chunks;
}

module.exports = { chunkText };

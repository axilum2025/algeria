function generateSimpleEmbedding(text, dims = 100) {
  const d = Math.max(8, Number(dims) || 100);
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const emb = new Array(d).fill(0);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % d;
    emb[idx] += 1;
  }

  const mag = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
  return mag > 0 ? emb.map(v => v / mag) : emb;
}

module.exports = { generateSimpleEmbedding };

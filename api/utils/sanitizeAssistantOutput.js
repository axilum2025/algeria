// Post-processes assistant output so the UI can render it reliably.
// - Removes reasoning tags (handled elsewhere for some providers)
// - Converts Markdown tables into bullet lists / text (UI does not render tables well)

const { stripModelReasoning } = require('./stripModelReasoning');

function splitTableRow(line) {
  // Accept rows with or without leading/trailing pipes.
  const trimmed = String(line || '').trim();
  const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return withoutEdges.split('|').map((c) => c.trim());
}

function isSeparatorRow(line) {
  // Typical Markdown separator: | --- | :---: | ---: |
  const s = String(line || '').trim();
  if (!s.includes('-')) return false;
  const re = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;
  return re.test(s);
}

function looksLikeTableHeader(line) {
  const s = String(line || '').trim();
  // At least 2 columns and some pipes.
  const parts = splitTableRow(s);
  return s.includes('|') && parts.filter(Boolean).length >= 2;
}

function convertMarkdownTablesToBullets(text) {
  const input = String(text || '');
  if (!input.includes('|')) return input;

  const lines = input.split(/\r?\n/);
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = i + 1 < lines.length ? lines[i + 1] : '';

    // Detect start of a markdown table: header row + separator row.
    if (looksLikeTableHeader(line) && isSeparatorRow(next)) {
      const headerCells = splitTableRow(line);

      // Gather table rows until a non-table-ish line.
      const tableLines = [line, next];
      let j = i + 2;
      for (; j < lines.length; j++) {
        const l = lines[j];
        // Stop on empty line or line without pipes (table ended)
        if (!String(l || '').trim()) break;
        if (!String(l).includes('|')) break;
        tableLines.push(l);
      }

      const dataLines = tableLines.slice(2).filter((l) => !isSeparatorRow(l));
      const bulletLines = [];

      for (const dl of dataLines) {
        const cells = splitTableRow(dl);
        const pairs = [];
        for (let k = 0; k < Math.max(headerCells.length, cells.length); k++) {
          const h = (headerCells[k] || '').trim();
          const v = (cells[k] || '').trim();
          if (!h && !v) continue;
          if (h && v) pairs.push(`${h}: ${v}`);
          else if (v) pairs.push(v);
        }
        const lineOut = pairs.join(' ; ').trim();
        if (lineOut) bulletLines.push(`- ${lineOut}`);
      }

      // If there are no data rows, at least preserve the headers.
      if (bulletLines.length === 0) {
        const cols = headerCells.map((c) => c.trim()).filter(Boolean);
        if (cols.length) bulletLines.push(`Colonnes: ${cols.join(' | ')}`);
      }

      // Add a blank line before converted bullets if needed.
      if (out.length && out[out.length - 1].trim()) out.push('');
      out.push(...bulletLines);
      if (j < lines.length && lines[j].trim()) out.push('');

      i = j - 1; // continue from end of table block
      continue;
    }

    out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function sanitizeAssistantOutput(text) {
  let out = stripModelReasoning(text);
  out = convertMarkdownTablesToBullets(out);
  return String(out || '').trim();
}

module.exports = {
  sanitizeAssistantOutput,
  convertMarkdownTablesToBullets
};

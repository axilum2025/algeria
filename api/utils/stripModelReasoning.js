// Removes common "reasoning" / chain-of-thought artifacts from model outputs.
// We never want to display internal reasoning to end users.

function stripTaggedBlocks(input, tagName) {
  const s = String(input || '');
  const lower = s.toLowerCase();
  const openIdx = lower.indexOf(`<${tagName}`);
  const closeIdx = lower.indexOf(`</${tagName}>`);

  // If the model opened a tag but never closed it, treat everything from the opening tag
  // as non-user-visible (safer than leaking reasoning).
  if (openIdx !== -1 && closeIdx === -1) {
    return s.slice(0, openIdx);
  }

  // Remove well-formed tagged blocks.
  const re = new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}\\s*>`, 'gi');
  return s.replace(re, '');
}

function stripModelReasoning(text) {
  const original = String(text || '');

  let out = original;
  out = stripTaggedBlocks(out, 'think');
  out = stripTaggedBlocks(out, 'analysis');

  // Some models wrap reasoning in fenced code blocks.
  out = out.replace(/```\s*(thinking|think|analysis)\s*[\s\S]*?```/gi, '');

  // As a last-pass, remove any stray opening/closing tags.
  out = out.replace(/<\/?(think|analysis)\b[^>]*>/gi, '');

  out = String(out || '').trim();

  // If stripping removed everything but we do have a closing </think>, keep the tail after it.
  if (!out) {
    const idx = original.toLowerCase().lastIndexOf('</think>');
    if (idx !== -1) {
      const tail = original.slice(idx + '</think>'.length).trim();
      if (tail) return tail;
    }
  }

  return out;
}

module.exports = {
  stripModelReasoning
};

function sanitizeUserIdForBlobPrefix(userId) {
  const raw = String(userId || '').trim();
  if (!raw) return '';

  // Emails classiques: a-zA-Z0-9 @ . _ + -
  // On remplace tout le reste (slash/backslash inclus) pour éviter toute injection de chemin.
  const safe = raw.replace(/[^A-Za-z0-9@._+-]/g, '_');

  // Limiter pour éviter des noms de blobs trop longs
  return safe.length > 180 ? safe.slice(0, 180) : safe;
}

function buildUsersBlobName(userId, blobName) {
  const uid = sanitizeUserIdForBlobPrefix(userId);
  const name = String(blobName || '').replace(/^\/+/, '');
  return uid ? `users/${uid}/${name}` : name;
}

function buildUsersPrefix(userId) {
  const uid = sanitizeUserIdForBlobPrefix(userId);
  return uid ? `users/${uid}/` : undefined;
}

function buildDirectPrefix(userId) {
  const uid = sanitizeUserIdForBlobPrefix(userId);
  return uid ? `${uid}/` : undefined;
}

module.exports = {
  sanitizeUserIdForBlobPrefix,
  buildUsersBlobName,
  buildUsersPrefix,
  buildDirectPrefix
};

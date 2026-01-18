const crypto = require('crypto');

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecodeToString(b64url) {
  const b64 = String(b64url).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64').toString('utf8');
}

function signToken(payload, secret, expiresInSeconds = 60 * 60 * 24 * 30) {
  if (!secret) throw new Error('AXILUM_AUTH_SECRET manquant');
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = Object.assign({}, payload, {
    iat: now,
    exp: now + expiresInSeconds
  });

  const h = base64UrlEncode(JSON.stringify(header));
  const p = base64UrlEncode(JSON.stringify(fullPayload));
  const toSign = `${h}.${p}`;
  const sig = crypto.createHmac('sha256', secret).update(toSign).digest();
  const s = base64UrlEncode(sig);
  return `${toSign}.${s}`;
}

function verifyToken(token, secret) {
  if (!secret) throw new Error('AXILUM_AUTH_SECRET manquant');
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;

  const toSign = `${h}.${p}`;
  const expected = base64UrlEncode(crypto.createHmac('sha256', secret).update(toSign).digest());
  const sig = String(s);
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (expectedBuf.length !== sigBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, sigBuf)) return null;

  let payload = null;
  try {
    payload = JSON.parse(base64UrlDecodeToString(p));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return null;
  return payload;
}

function decodePrincipal(headerValue) {
  if (!headerValue) return null;
  try {
    const raw = Buffer.from(headerValue, 'base64').toString('utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getAuthEmail(req) {
  // 1) Azure Static Web Apps Auth header
  const principalHeader = req.headers && (req.headers['x-ms-client-principal'] || req.headers['X-MS-CLIENT-PRINCIPAL']);
  const principal = decodePrincipal(principalHeader);
  if (principal && (principal.userDetails || principal.email)) {
    return String(principal.userDetails || principal.email).toLowerCase();
  }

  // 2) Bearer token
  const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  if (m) {
    const secret = process.env.AXILUM_AUTH_SECRET;
    const payload = verifyToken(m[1], secret);
    if (payload && (payload.email || payload.sub)) {
      return String(payload.email || payload.sub).toLowerCase();
    }
  }

  // 3) Dev fallback header
  const devEmail = req.headers && (req.headers['x-axilum-user-email'] || req.headers['X-AXILUM-USER-EMAIL']);
  if (devEmail && process.env.NODE_ENV !== 'production') {
    return String(devEmail).toLowerCase();
  }

  return null;
}

function setCors(context, allowMethods = 'GET, POST, OPTIONS') {
  context.res = context.res || {};
  context.res.headers = Object.assign({}, context.res.headers, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': allowMethods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
}

function requireAuth(context, req) {
  const email = getAuthEmail(req);
  if (!email) {
    setCors(context);
    context.res.status = 401;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { error: 'Non authentifié' };
    return null;
  }
  return email;
}

module.exports = {
  signToken,
  verifyToken,
  getAuthEmail,
  requireAuth,
  setCors
};

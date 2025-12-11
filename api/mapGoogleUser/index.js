const { createUser, userExists } = require('../utils/userStorage');

function decodePrincipal(headerValue) {
  if (!headerValue) return null;
  try {
    const raw = Buffer.from(headerValue, 'base64').toString('utf8');
    const obj = JSON.parse(raw);
    return obj;
  } catch (err) {
    return null;
  }
}

module.exports = async function (context, req) {
  context.log('🔁 mapGoogleUser triggered');
  try {
    const principalHeader = req.headers && (req.headers['x-ms-client-principal'] || req.headers['X-MS-CLIENT-PRINCIPAL']);
    const principal = decodePrincipal(principalHeader);

    if (!principal) {
      context.res = { status: 400, body: JSON.stringify({ error: 'No client principal header' }) };
      return;
    }

    // Principal shape: { identityProvider, userId, userDetails, userRoles }
    const provider = principal.identityProvider || 'unknown';
    const userId = principal.userId || principal.user_id || principal.sub;
    const email = principal.userDetails || principal.email;
    const username = email || `${provider}:${userId}`;

    const exists = await userExists(username);
    if (!exists) {
      const profile = {
        provider,
        providerId: userId,
        displayName: principal.userDetails || username
      };
      await createUser(username, profile);
      context.log(`Created user ${username}`);
      context.res = { status: 201, body: JSON.stringify({ created: true, username }) };
      return;
    }

    context.res = { status: 200, body: JSON.stringify({ created: false, username }) };
  } catch (err) {
    context.log.error('Error in mapGoogleUser', err);
    context.res = { status: 500, body: JSON.stringify({ error: 'internal' }) };
  }
};

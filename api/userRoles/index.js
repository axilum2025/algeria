const { getRoles } = require('../utils/userStorage');

module.exports = async function (context, req) {
  context.log('Get user roles triggered');
  try {
    const username = (req.query && req.query.username) || (req.body && req.body.username);
    if (!username) {
      context.res = { status: 400, body: JSON.stringify({ error: 'username requis' }) };
      return;
    }
    const roles = await getRoles(username);
    context.res = { status: 200, body: JSON.stringify({ username, roles }) };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: JSON.stringify({ error: 'internal' }) };
  }
};

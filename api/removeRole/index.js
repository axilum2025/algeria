const { removeRole } = require('../utils/userStorage');

module.exports = async function (context, req) {
  context.log('Remove role triggered');
  try {
    const { username, role } = req.body || {};
    if (!username || !role) {
      context.res = { status: 400, body: JSON.stringify({ error: 'username et role requis' }) };
      return;
    }
    const roles = await removeRole(username, role);
    context.res = { status: 200, body: JSON.stringify({ success: true, username, roles }) };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: JSON.stringify({ error: 'internal' }) };
  }
};

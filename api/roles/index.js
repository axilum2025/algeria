const { listAllRoles } = require('../utils/userStorage');

module.exports = async function (context, req) {
  context.log('List roles triggered');
  try {
    const roles = await listAllRoles();
    context.res = { status: 200, body: JSON.stringify({ roles }) };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: JSON.stringify({ error: 'internal' }) };
  }
};

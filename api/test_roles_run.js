const assign = require('./assignRole/index.js');
const remove = require('./removeRole/index.js');
const userRoles = require('./userRoles/index.js');

const logger = (...args) => console.log(...args);
logger.warn = console.warn.bind(console);
logger.error = console.error.bind(console);

(async () => {
  const ctx = { log: logger, res: null };
  // create user
  const create = require('./generateInstantCode/index.js');
  await create(ctx, { body: { username: 'bob2', displayName: 'Bob2' } });
  console.log('CREATE', ctx.res);

  // assign role
  await assign(ctx, { body: { username: 'bob2', role: 'admin' } });
  console.log('ASSIGN', ctx.res);

  // list roles
  await userRoles(ctx, { body: { username: 'bob2' } });
  console.log('USER ROLES', ctx.res);

  // remove role
  await remove(ctx, { body: { username: 'bob2', role: 'admin' } });
  console.log('REMOVE', ctx.res);

  // list roles after
  await userRoles(ctx, { body: { username: 'bob2' } });
  console.log('USER ROLES AFTER', ctx.res);

  // list all roles
  const roles = require('./roles/index.js');
  await roles(ctx, {});
  console.log('ALL ROLES', ctx.res);
})();

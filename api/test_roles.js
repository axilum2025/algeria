const assign = require('./assignRole/index.js');
const remove = require('./removeRole/index.js');
const userRoles = require('./userRoles/index.js');




































})();  console.log('ALL ROLES', ctx.res);  await roles(ctx, {});  const roles = require('./roles/index.js');  // list all roles  console.log('USER ROLES AFTER', ctx.res);  await userRoles(ctx, { body: { username: 'bob' } });  // list roles after  console.log('REMOVE', ctx.res);  await remove(ctx, { body: { username: 'bob', role: 'admin' } });  // remove role  console.log('USER ROLES', ctx.res);  await userRoles(ctx, { body: { username: 'bob' } });  // list roles  console.log('ASSIGN', ctx.res);  await assign(ctx, { body: { username: 'bob', role: 'admin' } });  // assign role  console.log('CREATE', ctx.res);  await create(ctx, { body: { username: 'bob', displayName: 'Bob' } });  const create = require('./generateInstantCode/index.js');  // create user  const ctx = { log: logger, res: null };(async () => {logger.error = console.error.bind(console);logger.warn = console.warn.bind(console);const logger = (...args) => console.log(...args);const userRoles = require('./userRoles/index.js');const remove = require('./removeRole/index.js');const remove = require('./removeRole/index.js');
const userRoles = require('./userRoles/index.js');

const logger = (...args) => console.log(...args);
logger.warn = console.warn.bind(console);
logger.error = console.error.bind(console);

(async () => {
  const ctx = { log: logger, res: null };
  // create user
  const create = require('./generateInstantCode/index.js');
  await create(ctx, { body: { username: 'bob', displayName: 'Bob' } });
  console.log('CREATE', ctx.res);

  // assign role
  await assign(ctx, { body: { username: 'bob', role: 'admin' } });
  console.log('ASSIGN', ctx.res);

  // list roles
  await userRoles(ctx, { body: { username: 'bob' } });
  console.log('USER ROLES', ctx.res);

  // remove role
  await remove(ctx, { body: { username: 'bob', role: 'admin' } });
  console.log('REMOVE', ctx.res);

  // list roles after
  await userRoles(ctx, { body: { username: 'bob' } });
  console.log('USER ROLES AFTER', ctx.res);

  // list all roles
  const roles = require('./roles/index.js');
  await roles(ctx, {});
  console.log('ALL ROLES', ctx.res);
})();

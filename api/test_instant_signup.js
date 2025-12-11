const gen = require('./generateInstantCode/index.js');
const verify = require('./verifyInstantCode/index.js');

const logger = (...args) => console.log(...args);
logger.warn = console.warn.bind(console);
logger.error = console.error.bind(console);

(async () => {
  const ctx = { log: logger, res: null };
  // Generate
  await gen(ctx, { body: { username: 'alice', displayName: 'Alice' } });
  console.log('GEN RESPONSE', ctx.res);

  // Extract code
  const body = JSON.parse(ctx.res.body);
  const code = body.code;

  // Verify (create user)
  await verify(ctx, { body: { username: 'alice', code, password: 'secret123', displayName: 'Alice' } });
  console.log('VERIFY RESPONSE', ctx.res);

  // Try duplicate
  await gen(ctx, { body: { username: 'alice' } });
  console.log('GEN AGAIN RESPONSE', ctx.res);
})();

const func = require('./sendVerificationEmail/index.js');

const logger = (...args) => console.log(...args);
logger.warn = console.warn.bind(console);
logger.error = console.error.bind(console);
const context = {
  log: logger,
  res: null
};

const req = { body: { email: 'test@example.com', name: 'Test User' } };

(async () => {
  try {
    await func(context, req);
    console.log('--- Function response ---');
    console.log(context.res);
  } catch (err) {
    console.error('Function invocation failed:', err);
  }
})();

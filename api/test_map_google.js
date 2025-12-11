const func = require('./mapGoogleUser/index.js');

const principal = {
  identityProvider: 'google',
  userId: 'google-12345',
  userDetails: 'test.user@example.com',
  userRoles: []
};

const header = Buffer.from(JSON.stringify(principal)).toString('base64');

const logger = (...args) => console.log(...args);
logger.warn = console.warn.bind(console);
logger.error = console.error.bind(console);
const context = { log: logger, res: null };
const req = { headers: { 'x-ms-client-principal': header } };

(async () => {
  await func(context, req);
  console.log('RESP:', context.res);
})();

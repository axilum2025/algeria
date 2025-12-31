// 🧪 Smoke test /team auto (sans dev-server)
// Usage:
//   node api/test_team_auto.js --pro "question..."
//   node api/test_team_auto.js --free "question..."
// Options:
//   --agents "dev,marketing"  (sinon auto)
//   --history                 (ajoute un mini historique)
//
// Prérequis: définir GROQ_API_KEY dans api/.env (ou api/.env.local)

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const envLocalPath = path.join(__dirname, '.env.local');

  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
  if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath, override: true });
}

function makeContext(name) {
  const logFn = (...args) => console.log(`[${name}]`, ...args);
  logFn.info = (...args) => console.log(`[${name}]`, ...args);
  logFn.warn = (...args) => console.warn(`[${name}]`, ...args);
  logFn.error = (...args) => console.error(`[${name}]`, ...args);

  return {
    log: logFn,
    res: null
  };
}

function parseArgs(argv) {
  const args = { mode: 'pro', agents: 'auto', question: '', includeHistory: false };
  const rest = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pro') args.mode = 'pro';
    else if (a === '--free') args.mode = 'free';
    else if (a === '--agents') args.agents = String(argv[++i] || '').trim() || 'auto';
    else if (a === '--history') args.includeHistory = true;
    else rest.push(a);
  }

  args.question = rest.join(' ').trim();
  return args;
}

async function main() {
  loadEnv();

  const args = parseArgs(process.argv.slice(2));
  if (!args.question) {
    console.error('Usage: node api/test_team_auto.js --pro|--free [--agents "dev,marketing"] [--history] "question..."');
    process.exitCode = 1;
    return;
  }

  const handler = args.mode === 'free'
    ? require('./invokeFree/index')
    : require('./invoke/index');

  const history = args.includeHistory
    ? [
        { role: 'user', content: 'Contexte: on prépare un lancement produit.' },
        { role: 'assistant', content: 'OK, je note.' }
      ]
    : [];

  const req = {
    method: 'POST',
    body: {
      message: args.question,
      chatType: 'orchestrator',
      teamAgents: args.agents,
      teamQuestion: args.question,
      history
    },
    query: {}
  };

  const context = makeContext(args.mode.toUpperCase());
  await handler(context, req);

  const res = context.res;
  if (!res) {
    throw new Error('Aucune réponse (context.res est null)');
  }

  const body = res.body || {};
  console.log('\n=== Résultat ===');
  console.log('status:', res.status);
  if (body.error) console.log('error:', body.error);
  if (body.responseTime) console.log('responseTime:', body.responseTime);
  if (body.orchestratorAgents) console.log('orchestratorAgents:', body.orchestratorAgents);
  if (typeof body.hallucinationIndex !== 'undefined') console.log('hallucinationIndex:', body.hallucinationIndex);

  const responseText = typeof body.response === 'string' ? body.response : JSON.stringify(body.response || body, null, 2);
  console.log('\n--- response (preview) ---');
  console.log(responseText.slice(0, 1200));
}

main().catch((err) => {
  console.error('Test échoué:', err);
  process.exitCode = 1;
});

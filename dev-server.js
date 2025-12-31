const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Charger les variables d'environnement depuis api/.env (+ surcharge locale api/.env.local)
const dotenv = require('dotenv');
const envPath = path.join(__dirname, 'api', '.env');
const envLocalPath = path.join(__dirname, 'api', '.env.local');

let loadedAnyEnv = false;
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  loadedAnyEnv = true;
  console.log('✅ Variables d\'environnement chargées depuis api/.env');
}

// Permet de stocker les secrets localement sans les committer
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
  loadedAnyEnv = true;
  console.log('✅ Variables d\'environnement chargées depuis api/.env.local (override)');
}

if (!loadedAnyEnv) {
  console.warn('⚠️  Fichier api/.env(.local) non trouvé - Mode développement sans configuration locale');
}

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  console.log('Serving static files from', publicDir);
} else {
  console.warn('Warning: public directory not found at', publicDir);
}

// Dynamically load Azure Function style handlers from api/<fn>/index.js
const apiRoot = path.join(__dirname, 'api');
const routeMap = {}; // Map custom routes to handlers

if (fs.existsSync(apiRoot)) {
  const entries = fs.readdirSync(apiRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  entries.forEach(name => {
    const handlerPath = path.join(apiRoot, name, 'index.js');
    const functionJsonPath = path.join(apiRoot, name, 'function.json');
    
    if (fs.existsSync(handlerPath)) {
      try {
        const handler = require(handlerPath);
        let route = `/api/${name}`;
        
        // Check if there's a custom route in function.json
        if (fs.existsSync(functionJsonPath)) {
          const functionConfig = JSON.parse(fs.readFileSync(functionJsonPath, 'utf8'));
          const httpBinding = functionConfig.bindings?.find(b => b.type === 'httpTrigger');
          if (httpBinding && httpBinding.route) {
            route = `/api/${httpBinding.route}`;
          }
        }
        
        // Convert Azure Function route syntax to Express
        // Example: "tasks/{action?}" -> "tasks/:action?"
        const expressRoute = route.replace(/{([^}]+)}/g, ':$1');
        
        console.log(`Mounting ${expressRoute} -> ${handlerPath}`);
        routeMap[expressRoute] = { handler, name };

        app.all(expressRoute, async (req, res) => {
          console.log(`[dev-server] 📨 Request received: ${req.method} ${req.path}`, {
            query: req.query,
            headers: {
              'content-type': req.headers['content-type'],
              'accept': req.headers['accept']
            }
          });

          const logFn = (...args) => console.log(`[${name}]`, ...args);
          logFn.info = (...args) => console.log(`[${name}]`, ...args);
          logFn.warn = (...args) => console.warn(`[${name}]`, ...args);
          logFn.error = (...args) => console.error(`[${name}]`, ...args);
          logFn.verbose = (...args) => console.debug(`[${name}]`, ...args);

          const context = {
            log: logFn,
            invocationId: Date.now().toString(),
            bindings: {},
            res: null
          };

          const reqObj = {
            method: req.method,
            headers: req.headers,
            query: req.query,
            params: req.params, // Include route parameters
            body: req.body
          };

          try {
            await handler(context, reqObj);

            if (context.res) {
              const status = context.res.status || 200;
              const headers = context.res.headers || {};
              console.log(`[dev-server] 📤 Sending response:`, {
                status,
                headers,
                bodyType: typeof context.res.body,
                bodyPreview: typeof context.res.body === 'string' ? context.res.body.slice(0, 100) : 'object'
              });

              if (headers) Object.entries(headers).forEach(([k, v]) => res.set(k, v));
              
              // Always set CORS headers
              res.set('Access-Control-Allow-Origin', '*');
              res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
              res.set('Access-Control-Allow-Headers', 'Content-Type');
              
              if (typeof context.res.body === 'object') {
                return res.status(status).json(context.res.body);
              }
              return res.status(status).send(context.res.body);
            }

            console.log(`[dev-server] ⚠️ No context.res, sending default response`);
            res.status(200).json({ ok: true });
          } catch (err) {
            console.error(`[dev-server] 💥 Handler error for ${name}:`, err);
            res.status(500).json({ error: String(err.message || err) });
          }
        });
      } catch (err) {
        console.warn('Failed to load handler', handlerPath, err.message);
      }
    }
  });
  
  console.log(`Loaded ${Object.keys(routeMap).length} API routes`);
} else {
  console.warn('No api functions directory found at', apiRoot);
}

// Health + route introspection
app.get('/__health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/__routes', (req, res) => res.json({ count: Object.keys(routeMap).length, routes: Object.keys(routeMap) }));

// All other routes: if file exists in public serve it, else fallback to index.html
app.use((req, res, next) => {
  const requested = path.join(publicDir, req.path === '/' ? 'index.html' : req.path);
  if (fs.existsSync(requested) && fs.statSync(requested).isFile()) return res.sendFile(requested);
  if (fs.existsSync(path.join(publicDir, 'index.html'))) return res.sendFile(path.join(publicDir, 'index.html'));
  next();
});

app.listen(PORT, () => {
  console.log(`Dev server listening on http://localhost:${PORT}`);
  console.log('Static root:', publicDir);
});

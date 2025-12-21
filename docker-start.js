const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Charger dynamiquement les Azure Functions depuis le dossier api avec support des routes function.json
const apiRoot = path.join(__dirname, 'api');
const apiFunctions = fs.readdirSync(apiRoot)
  .filter(item => {
    const dir = path.join(apiRoot, item);
    const stat = fs.statSync(dir);
    return stat.isDirectory() && fs.existsSync(path.join(dir, 'index.js'));
  });

apiFunctions.forEach(functionName => {
  try {
    const functionDir = path.join(apiRoot, functionName);
    const functionPath = path.join(functionDir, 'index.js');
    const functionJsonPath = path.join(functionDir, 'function.json');
    const functionModule = require(functionPath);

    // Route par défaut
    let route = `/api/${functionName}`;
    // Route custom via function.json
    if (fs.existsSync(functionJsonPath)) {
      try {
        const fnConfig = JSON.parse(fs.readFileSync(functionJsonPath, 'utf8'));
        const httpBinding = (fnConfig.bindings || []).find(b => b.type === 'httpTrigger');
        if (httpBinding && httpBinding.route) {
          route = `/api/${httpBinding.route}`;
        }
      } catch (e) {
        console.warn(`Warn: invalid function.json for ${functionName}:`, e.message);
      }
    }

    // Convert `{param}` to Express `:param`
    const expressRoute = route.replace(/{([^}]+)}/g, ':$1');

    app.all(expressRoute, async (req, res) => {
      const context = {
        log: console,
        res: { status: 200, headers: {}, body: null }
      };

      try {
        await functionModule(context, req);

        // CORS par défaut
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');

        res.status(context.res.status || 200);
        if (context.res.headers) {
          Object.entries(context.res.headers).forEach(([k, v]) => res.setHeader(k, v));
        }
        const body = context.res.body ?? { message: 'Success' };
        if (typeof body === 'object') return res.json(body);
        return res.send(body);
      } catch (error) {
        console.error(`Error in ${functionName}:`, error);
        res.status(500).json({ error: error.message || String(error) });
      }
    });

    console.log(`✓ Mounted function: ${expressRoute}`);
  } catch (error) {
    console.error(`Failed to load function ${functionName}:`, error.message);
  }
});

// Route par défaut pour SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
  console.log(`⚡ Azure Functions available at: /api/*`);
});

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5173;

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

// Dynamically load Azure Function style handlers from api/api/<fn>/index.js
const apiRoot = path.join(__dirname, 'api', 'api');
if (fs.existsSync(apiRoot)) {
  const entries = fs.readdirSync(apiRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  entries.forEach(name => {
    const handlerPath = path.join(apiRoot, name, 'index.js');
    if (fs.existsSync(handlerPath)) {
      try {
        const handler = require(handlerPath);
        const route = `/api/${name}`;
        console.log(`Mounting ${route} -> ${handlerPath}`);

        app.all(route, async (req, res) => {
          const logFn = (...args) => console.log('[info]', ...args);
          logFn.info = (...args) => console.log('[info]', ...args);
          logFn.warn = (...args) => console.warn('[warn]', ...args);
          logFn.error = (...args) => console.error('[error]', ...args);
          logFn.verbose = (...args) => console.debug('[debug]', ...args);

          const context = {
            log: logFn,
            invocationId: null,
            bindings: {},
            res: null
          };

          const reqObj = {
            method: req.method,
            headers: req.headers,
            query: req.query,
            body: req.body
          };

          try {
            // Some handlers expect (context, req)
            await handler(context, reqObj);

            if (context.res) {
              const status = context.res.status || 200;
              const headers = context.res.headers || {};
              if (headers) Object.entries(headers).forEach(([k, v]) => res.set(k, v));
              // If body is an object, send JSON
              if (typeof context.res.body === 'object') return res.status(status).json(context.res.body);
              return res.status(status).send(context.res.body);
            }

            // Fallback: return 200 with empty
            res.status(200).json({ ok: true });
          } catch (err) {
            console.error('Handler error for', name, err);
            res.status(500).json({ error: String(err.message || err) });
          }
        });
      } catch (err) {
        console.warn('Failed to load handler', handlerPath, err.message);
      }
    }
  });
} else {
  console.warn('No api functions directory found at', apiRoot);
}

// A basic health endpoint
app.get('/__health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

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

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Charger dynamiquement les Azure Functions depuis le dossier api
const apiFunctions = fs.readdirSync('./api')
  .filter(item => {
    const stat = fs.statSync(path.join('./api', item));
    return stat.isDirectory() && fs.existsSync(path.join('./api', item, 'index.js'));
  });

// Monter chaque fonction Azure comme endpoint
apiFunctions.forEach(functionName => {
  try {
    const functionPath = path.join(__dirname, 'api', functionName, 'index.js');
    const functionModule = require(functionPath);
    
    app.all(`/api/${functionName}`, async (req, res) => {
      const context = {
        log: console.log,
        req: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          query: req.query,
          body: req.body
        },
        res: {
          status: 200,
          headers: {},
          body: null
        }
      };

      try {
        await functionModule(context, req);
        
        // Envoyer la réponse
        res.status(context.res.status || 200);
        
        if (context.res.headers) {
          Object.keys(context.res.headers).forEach(key => {
            res.setHeader(key, context.res.headers[key]);
          });
        }
        
        res.send(context.res.body || { message: 'Success' });
      } catch (error) {
        console.error(`Error in ${functionName}:`, error);
        res.status(500).json({ error: error.message });
      }
    });
    
    console.log(`✓ Mounted function: /api/${functionName}`);
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

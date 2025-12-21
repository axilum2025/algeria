const fs = require('fs');
const path = require('path');
const { uploadBuffer, buildBlobUrl } = require('../utils/storage');

module.exports = async function (context, req) {
  const setCors = () => {
    context.res = context.res || {};
    context.res.headers = Object.assign({}, context.res.headers, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
  };

  if (req.method === 'OPTIONS') {
    setCors();
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  try {
    const body = req.body || {};
    const period = body.period || 'periode-courante';
    const format = body.format || 'pdf'; // we will generate a JSON/HTML stub and return a URL

    // Prepare minimal report content
    const now = new Date();
    const reportData = {
      period,
      generatedAt: now.toISOString(),
      kpis: {
        revenue: 1250000,
        expenses: 840000,
        netIncome: 410000,
        margin: 32.8
      },
      notes: ['Rapport généré automatiquement (stub)', 'Connecter à source comptable pour données réelles']
    };

    // Write to public/reports directory as a JSON file for demo
    const publicDir = path.join(__dirname, '..', '..', 'public');
    const reportsDir = path.join(publicDir, 'reports');
    try { if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true }); } catch {}
    const filename = `finance-report-${period}-${now.getTime()}.json`;
    const filePath = path.join(reportsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2));

    let url = `/reports/${filename}`;
    let azureUrl = null;
    try {
      const buf = Buffer.from(JSON.stringify(reportData));
      azureUrl = await uploadBuffer('reports', filename, buf, 'application/json');
      if (azureUrl) url = azureUrl;
    } catch {}

    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { url, period, format, size: fs.statSync(filePath).size, azureUrl };
  } catch (err) {
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { error: err.message || String(err) };
  }
};

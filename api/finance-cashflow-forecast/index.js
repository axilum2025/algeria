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
    const horizonDays = Number(body.horizonDays || 90);
    const method = body.method || 'direct';

    // Simple baseline forecast: sinusoidal seasonality + drift
    const base = Number(body.base || 100000); // baseline cash in/out per day
    const drift = Number(body.drift || 150); // daily drift
    const variance = Number(body.variance || 4000);

    const series = [];
    for (let d = 0; d < horizonDays; d++) {
      const season = Math.sin((2 * Math.PI * d) / 30) * 0.25; // monthly seasonality
      const value = Math.round(base * (1 + season) + drift * d + (variance * (Math.sin(d * 2.3) * 0.5)));
      series.push({ day: d + 1, netCashflow: value });
    }

    const summary = `Projection ${horizonDays} jours (${method}), tendance: ${(series[series.length - 1].netCashflow - series[0].netCashflow) >= 0 ? 'positive' : 'négative'}`;

    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { summary, horizonDays, method, series };
  } catch (err) {
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { error: err.message || String(err) };
  }
};

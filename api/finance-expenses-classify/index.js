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
    const expenses = Array.isArray(req.body?.expenses) ? req.body.expenses : [];

    const rules = [
      { key: /resto|restaurant|repas|food|café/i, cat: 'Frais de repas' },
      { key: /saas|logiciel|software|licence|license|abonnement/i, cat: 'Logiciels & Abonnements' },
      { key: /transport|uber|taxi|carburant|fuel|essence/i, cat: 'Transport' },
      { key: /matériel|hardware|équipement|device/i, cat: 'Matériel & Équipement' },
      { key: /marketing|ads|publicité|facebook|google|campagne/i, cat: 'Marketing & Publicité' },
      { key: /loyer|rent|bureau|office/i, cat: 'Loyer & Bureau' }
    ];

    const categories = expenses.map((e, idx) => {
      const desc = String(e.description || '').toLowerCase();
      const amount = Number(e.amount || 0);
      let category = 'Autres';

      for (const r of rules) {
        if (r.key.test(desc)) { category = r.cat; break; }
      }

      return { index: idx, description: e.description || '', amount, category };
    });

    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { categories, rules: rules.map(r => r.cat) };
  } catch (err) {
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { error: err.message || String(err) };
  }
};

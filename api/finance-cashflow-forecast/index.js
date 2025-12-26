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
    const method = body.method || 'historical'; // 'historical', 'trend', 'seasonal'
    
    // Données historiques (factures passées)
    const historicalInvoices = Array.isArray(body.historicalInvoices) ? body.historicalInvoices : [];
    const recurringExpenses = Array.isArray(body.recurringExpenses) ? body.recurringExpenses : [];

    // Si pas de données historiques, utiliser modèle baseline
    if (historicalInvoices.length === 0) {
      return generateBaselineForecast(context, horizonDays, setCors);
    }

    // Analyse de l'historique
    const analysis = analyzeHistoricalData(historicalInvoices);
    
    // Génération prévisions basées sur historique
    const forecast = generateForecast(analysis, horizonDays, recurringExpenses, method);

    // Identification des risques
    const risks = identifyRisks(forecast, analysis);

    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = {
      summary: generateSummary(forecast, horizonDays, analysis),
      horizonDays,
      method,
      forecast,
      analysis: {
        historicalDataPoints: historicalInvoices.length,
        averageMonthlyIncome: Math.round(analysis.avgMonthlyIncome),
        averageMonthlyExpenses: Math.round(analysis.avgMonthlyExpenses),
        averageMonthlyNetCashflow: Math.round(analysis.avgMonthlyNetCashflow),
        trend: analysis.trend,
        volatility: analysis.volatility,
        topVendors: analysis.topVendors.slice(0, 5)
      },
      risks,
      recommendations: generateRecommendations(forecast, risks, analysis)
    };
  } catch (err) {
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { error: err.message || String(err) };
  }
};

function analyzeHistoricalData(invoices) {
  // Grouper par mois
  const monthlyData = {};
  const vendorTotals = {};

  invoices.forEach(inv => {
    const amount = parseFloat(inv.amount) || 0;
    const date = new Date(inv.date || inv.invoiceDate || Date.now());
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const vendor = inv.vendor || 'Unknown';
    const type = inv.type || (amount > 0 ? 'income' : 'expense');

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expenses: 0, net: 0 };
    }

    if (type === 'income' || amount > 0) {
      monthlyData[monthKey].income += Math.abs(amount);
    } else {
      monthlyData[monthKey].expenses += Math.abs(amount);
    }
    monthlyData[monthKey].net = monthlyData[monthKey].income - monthlyData[monthKey].expenses;

    // Analyse par fournisseur
    if (!vendorTotals[vendor]) {
      vendorTotals[vendor] = { total: 0, count: 0 };
    }
    vendorTotals[vendor].total += Math.abs(amount);
    vendorTotals[vendor].count++;
  });

  const months = Object.keys(monthlyData).sort();
  const values = months.map(m => monthlyData[m]);

  // Calcul tendance
  const avgIncome = values.reduce((sum, v) => sum + v.income, 0) / values.length;
  const avgExpenses = values.reduce((sum, v) => sum + v.expenses, 0) / values.length;
  const avgNet = avgIncome - avgExpenses;

  // Tendance (régression linéaire simple)
  let trend = 'stable';
  if (values.length > 1) {
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((sum, v) => sum + v.net, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v.net, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg * 1.1) trend = 'croissante';
    else if (secondAvg < firstAvg * 0.9) trend = 'décroissante';
  }

  // Volatilité
  const variance = values.reduce((sum, v) => sum + Math.pow(v.net - avgNet, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const volatility = (stdDev / Math.abs(avgNet)) * 100;

  return {
    avgMonthlyIncome: avgIncome,
    avgMonthlyExpenses: avgExpenses,
    avgMonthlyNetCashflow: avgNet,
    trend,
    volatility: volatility.toFixed(1) + '%',
    monthlyData: values,
    topVendors: Object.entries(vendorTotals).map(([vendor, data]) => ({
      vendor,
      total: Math.round(data.total),
      count: data.count,
      avgTransaction: Math.round(data.total / data.count)
    })).sort((a, b) => b.total - a.total)
  };
}

function generateForecast(analysis, horizonDays, recurringExpenses, method) {
  const dailyIncome = analysis.avgMonthlyIncome / 30;
  const dailyExpenses = analysis.avgMonthlyExpenses / 30;
  const dailyNet = dailyIncome - dailyExpenses;

  const forecast = [];
  let cumulativeCash = 0;

  for (let day = 1; day <= horizonDays; day++) {
    // Revenus (avec saisonnalité)
    const seasonalFactor = 1 + 0.2 * Math.sin((2 * Math.PI * day) / 30); // Cycle mensuel
    const projectedIncome = dailyIncome * seasonalFactor;

    // Dépenses (base + récurrentes)
    let projectedExpenses = dailyExpenses;
    
    // Ajouter dépenses récurrentes
    recurringExpenses.forEach(exp => {
      if (day % (exp.frequencyDays || 30) === 0) {
        projectedExpenses += exp.amount || 0;
      }
    });

    const netCashflow = projectedIncome - projectedExpenses;
    cumulativeCash += netCashflow;

    forecast.push({
      day,
      date: new Date(Date.now() + day * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      projectedIncome: Math.round(projectedIncome),
      projectedExpenses: Math.round(projectedExpenses),
      netCashflow: Math.round(netCashflow),
      cumulativeCash: Math.round(cumulativeCash),
      confidence: Math.max(0.5, 1 - (day / horizonDays) * 0.5) // Confiance décroît avec le temps
    });
  }

  return forecast;
}

function identifyRisks(forecast, analysis) {
  const risks = [];

  // Risque de trésorerie négative
  const negativeDays = forecast.filter(f => f.cumulativeCash < 0);
  if (negativeDays.length > 0) {
    risks.push({
      type: 'NEGATIVE_CASHFLOW',
      severity: 'critical',
      description: `Trésorerie négative prévue à partir du jour ${negativeDays[0].day}`,
      impact: `${negativeDays.length} jours avec trésorerie négative`,
      recommendation: 'Prévoir financement ou réduire dépenses'
    });
  }

  // Risque de volatilité élevée
  const volatilityValue = parseFloat(analysis.volatility);
  if (volatilityValue > 50) {
    risks.push({
      type: 'HIGH_VOLATILITY',
      severity: 'warning',
      description: `Volatilité élevée: ${analysis.volatility}`,
      recommendation: 'Diversifier sources de revenus pour stabiliser'
    });
  }

  // Tendance décroissante
  if (analysis.trend === 'décroissante') {
    risks.push({
      type: 'DECLINING_TREND',
      severity: 'warning',
      description: 'Tendance décroissante détectée sur historique',
      recommendation: 'Analyser causes et mettre en place actions correctives'
    });
  }

  return risks;
}

function generateSummary(forecast, horizonDays, analysis) {
  const finalCash = forecast[forecast.length - 1].cumulativeCash;
  const avgDailyCashflow = forecast.reduce((sum, f) => sum + f.netCashflow, 0) / forecast.length;
  
  return `Prévision ${horizonDays} jours (méthode historique): Trésorerie finale ${finalCash}€, flux moyen ${Math.round(avgDailyCashflow)}€/jour, tendance ${analysis.trend}`;
}

function generateRecommendations(forecast, risks, analysis) {
  const recommendations = [];

  if (risks.length === 0) {
    recommendations.push('✅ Situation de trésorerie saine sur la période prévue.');
  } else {
    recommendations.push(`⚠️ ${risks.length} risque(s) identifié(s) nécessitant attention.`);
  }

  if (forecast[forecast.length - 1].cumulativeCash < 10000) {
    recommendations.push('Maintenir réserve de trésorerie minimum 10 000€.');
  }

  if (analysis.trend === 'croissante') {
    recommendations.push('📈 Tendance positive: Opportunité d\'investissement ou expansion.');
  }

  recommendations.push('Actualiser prévisions mensuellement avec nouvelles données.');

  return recommendations;
}

function generateBaselineForecast(context, horizonDays, setCors) {
  // Modèle simple sans historique
  const base = 3000; // Base quotidienne
  const forecast = [];
  let cumulative = 0;

  for (let day = 1; day <= horizonDays; day++) {
    const seasonal = 1 + 0.2 * Math.sin((2 * Math.PI * day) / 30);
    const value = Math.round(base * seasonal);
    cumulative += value;
    forecast.push({ day, netCashflow: value, cumulativeCash: cumulative, confidence: 0.3 });
  }

  setCors();
  context.res.status = 200;
  context.res.headers['Content-Type'] = 'application/json';
  context.res.body = {
    summary: `Prévision ${horizonDays} jours (modèle baseline). Importez des factures historiques pour prévisions précises.`,
    horizonDays,
    method: 'baseline',
    forecast,
    warning: 'Prévisions basées sur modèle générique. Uploadez des factures pour analyse personnalisée.',
    recommendation: 'Importez au moins 3 mois de factures pour prévisions fiables.'
  };
}

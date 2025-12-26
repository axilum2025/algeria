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
    // Accepte soit un array de transactions, soit un array de factures
    const invoices = Array.isArray(req.body?.invoices) ? req.body.invoices : [];
    const transactions = Array.isArray(req.body?.transactions) ? req.body.transactions : invoices;

    if (transactions.length === 0) {
      setCors();
      context.res.status = 200;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { 
        alerts: [], 
        summary: 'Aucune transaction fournie. Uploadez des factures pour analyser.',
        recommendation: 'Utilisez le bouton Upload pour importer vos factures.'
      };
      return;
    }

    const alerts = [];
    const seen = new Map();
    const vendors = new Map();

    // Configuration des seuils (adaptable par pays/secteur)
    const HIGH_AMOUNT_THRESHOLD = req.body.highAmountThreshold || 10000; // €
    const DUPLICATE_WINDOW_DAYS = 7;

    transactions.forEach((t, idx) => {
      const amount = Math.abs(parseFloat(t.amount) || 0);
      const vendor = String(t.vendor || t.vendorName || '').trim().toLowerCase();
      const date = new Date(t.date || t.invoiceDate || Date.now());
      const invoiceNumber = t.invoiceNumber || t.invoiceId || '';

      // 1. Montant anormalement élevé
      if (amount >= HIGH_AMOUNT_THRESHOLD) {
        alerts.push({ 
          type: 'HIGH_AMOUNT', 
          severity: 'warning',
          index: idx, 
          amount, 
          vendor: t.vendor || vendor,
          description: `Montant élevé: ${amount}€ pour ${t.vendor || vendor}`,
          recommendation: 'Vérifier justificatif et autorisation'
        });
      }

      // 2. Détection de doublons (même fournisseur + montant proche dans une fenêtre)
      const key = `${vendor}|${Math.round(amount)}`;
      if (seen.has(key)) {
        const prevTrx = seen.get(key);
        const prevDate = new Date(prevTrx.date);
        const daysDiff = Math.abs((date - prevDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= DUPLICATE_WINDOW_DAYS) {
          alerts.push({ 
            type: 'POTENTIAL_DUPLICATE', 
            severity: 'high',
            index: idx, 
            amount, 
            vendor: t.vendor || vendor,
            previousIndex: prevTrx.idx,
            daysBetween: Math.round(daysDiff),
            description: `Possible doublon: ${amount}€ à ${t.vendor || vendor} (${Math.round(daysDiff)}j d'écart)`,
            recommendation: 'Comparer les numéros de facture et justificatifs'
          });
        }
      } else {
        seen.set(key, { idx, date: date.toISOString(), amount });
      }

      // 3. Transactions le week-end (inhabituel pour certains fournisseurs)
      const day = date.getDay();
      if ((day === 0 || day === 6) && amount > 500) {
        alerts.push({ 
          type: 'WEEKEND_TRANSACTION', 
          severity: 'info',
          index: idx, 
          vendor: t.vendor || vendor, 
          amount,
          date: date.toISOString().split('T')[0],
          description: `Transaction week-end: ${amount}€ à ${t.vendor || vendor}`,
          recommendation: 'Vérifier si normal pour ce fournisseur'
        });
      }

      // 4. Analyse de patterns par fournisseur
      if (!vendors.has(vendor)) {
        vendors.set(vendor, { count: 0, total: 0, amounts: [] });
      }
      const vData = vendors.get(vendor);
      vData.count++;
      vData.total += amount;
      vData.amounts.push(amount);

      // Détection de montants inhabituels pour ce fournisseur (après 3+ transactions)
      if (vData.count > 3) {
        const avg = vData.total / vData.count;
        const deviation = Math.abs(amount - avg) / avg;
        
        if (deviation > 2.0) { // Montant > 200% de la moyenne
          alerts.push({
            type: 'UNUSUAL_AMOUNT_FOR_VENDOR',
            severity: 'warning',
            index: idx,
            vendor: t.vendor || vendor,
            amount,
            averageAmount: Math.round(avg),
            deviation: Math.round(deviation * 100) + '%',
            description: `Montant inhabituel pour ${t.vendor || vendor}: ${amount}€ (moyenne: ${Math.round(avg)}€)`,
            recommendation: 'Vérifier la nature de cette prestation'
          });
        }
      }

      // 5. Numéros de facture suspects (doublons)
      if (invoiceNumber) {
        const dupInvoice = transactions.find((other, otherIdx) => 
          otherIdx !== idx && 
          (other.invoiceNumber || other.invoiceId) === invoiceNumber
        );
        if (dupInvoice) {
          alerts.push({
            type: 'DUPLICATE_INVOICE_NUMBER',
            severity: 'critical',
            index: idx,
            invoiceNumber,
            vendor: t.vendor || vendor,
            description: `Numéro de facture dupliqué: ${invoiceNumber}`,
            recommendation: 'URGENT: Vérifier avec le fournisseur'
          });
        }
      }
    });

    // Statistiques globales
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);
    const avgAmount = totalAmount / transactions.length;
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const highAlerts = alerts.filter(a => a.severity === 'high').length;
    const warningAlerts = alerts.filter(a => a.severity === 'warning').length;

    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { 
      alerts,
      summary: {
        totalTransactions: transactions.length,
        totalAmount: Math.round(totalAmount),
        averageAmount: Math.round(avgAmount),
        alertsCount: alerts.length,
        criticalAlerts,
        highAlerts,
        warningAlerts,
        riskLevel: criticalAlerts > 0 ? 'CRITICAL' : highAlerts > 0 ? 'HIGH' : warningAlerts > 0 ? 'MEDIUM' : 'LOW'
      },
      vendorAnalysis: Array.from(vendors.entries()).map(([vendor, data]) => ({
        vendor,
        transactionCount: data.count,
        totalSpent: Math.round(data.total),
        averageAmount: Math.round(data.total / data.count),
        minAmount: Math.min(...data.amounts),
        maxAmount: Math.max(...data.amounts)
      })).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10),
      recommendations: [
        alerts.length === 0 ? 'Aucune anomalie détectée dans les transactions analysées.' : `${alerts.length} alerte(s) détectée(s) nécessitant votre attention.`,
        criticalAlerts > 0 ? `⚠️ ${criticalAlerts} alerte(s) CRITIQUE(S) à traiter immédiatement.` : null,
        highAlerts > 0 ? `${highAlerts} alerte(s) de priorité haute à vérifier.` : null,
        'Vérifiez régulièrement les doublons et montants inhabituels.',
        'Configurez des seuils adaptés à votre secteur d\'activité.'
      ].filter(Boolean)
    };
  } catch (err) {
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { error: err.message || String(err) };
  }
};

const PDFDocument = require('pdfkit');
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
    const format = body.format || 'pdf';
    const invoices = Array.isArray(body.invoices) ? body.invoices : [];
    const reportType = body.reportType || 'summary'; // 'summary', 'detailed', 'vat', 'cashflow'

    // Si pas de factures, retourner message d'info
    if (invoices.length === 0) {
      setCors();
      context.res.status = 200;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = {
        message: 'Aucune facture fournie. Uploadez des factures pour générer un rapport.',
        recommendation: 'Utilisez le bouton Upload pour importer vos factures.',
        reportType
      };
      return;
    }

    // Analyse des données
    const analysis = analyzeInvoicesForReport(invoices);
    
    // Génération du rapport selon le type
    let pdfBuffer;
    if (format === 'pdf') {
      pdfBuffer = await generatePDFReport(reportType, analysis, period);
    } else {
      // JSON format
      pdfBuffer = Buffer.from(JSON.stringify(analysis, null, 2));
    }

    // Upload vers Azure Blob Storage
    const filename = `finance-report-${reportType}-${period}-${Date.now()}.${format}`;
    const mimeType = format === 'pdf' ? 'application/pdf' : 'application/json';
    const azureUrl = await uploadBuffer('reports', filename, pdfBuffer, mimeType);

    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = {
      url: azureUrl,
      period,
      format,
      reportType,
      size: pdfBuffer.length,
      invoicesAnalyzed: invoices.length,
      summary: analysis.summary,
      generatedAt: new Date().toISOString()
    };
  } catch (err) {
    context.log('[Report Generation Error]', err);
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { error: err.message || String(err) };
  }
};

function analyzeInvoicesForReport(invoices) {
  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalVAT = 0;
  const vendors = {};
  const categories = {};
  const monthly = {};

  invoices.forEach(inv => {
    const amount = parseFloat(inv.amount) || 0;
    const vendor = inv.vendor || 'Unknown';
    const type = inv.type || (amount > 0 ? 'income' : 'expense');
    const date = new Date(inv.date || inv.invoiceDate || Date.now());
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const category = inv.category || 'Non classifié';

    // Revenus vs Dépenses
    if (type === 'income' || amount > 0) {
      totalRevenue += Math.abs(amount);
    } else {
      totalExpenses += Math.abs(amount);
    }

    // TVA (estimation 6% des montants)
    const vatAmount = Math.abs(amount) * 0.06;
    totalVAT += vatAmount;

    // Par fournisseur
    if (!vendors[vendor]) {
      vendors[vendor] = { count: 0, total: 0 };
    }
    vendors[vendor].count++;
    vendors[vendor].total += Math.abs(amount);

    // Par catégorie
    if (!categories[category]) {
      categories[category] = { count: 0, total: 0 };
    }
    categories[category].count++;
    categories[category].total += Math.abs(amount);

    // Par mois
    if (!monthly[monthKey]) {
      monthly[monthKey] = { income: 0, expenses: 0 };
    }
    if (type === 'income' || amount > 0) {
      monthly[monthKey].income += Math.abs(amount);
    } else {
      monthly[monthKey].expenses += Math.abs(amount);
    }
  });

  const netIncome = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  return {
    summary: {
      totalRevenue: Math.round(totalRevenue),
      totalExpenses: Math.round(totalExpenses),
      netIncome: Math.round(netIncome),
      totalVAT: Math.round(totalVAT),
      margin: margin.toFixed(1) + '%',
      invoiceCount: invoices.length
    },
    topVendors: Object.entries(vendors).map(([vendor, data]) => ({
      vendor,
      count: data.count,
      total: Math.round(data.total)
    })).sort((a, b) => b.total - a.total).slice(0, 10),
    categoryBreakdown: Object.entries(categories).map(([category, data]) => ({
      category,
      count: data.count,
      total: Math.round(data.total),
      percentage: ((data.total / (totalRevenue + totalExpenses)) * 100).toFixed(1) + '%'
    })).sort((a, b) => b.total - a.total),
    monthlyTrend: Object.entries(monthly).sort().map(([month, data]) => ({
      month,
      income: Math.round(data.income),
      expenses: Math.round(data.expenses),
      net: Math.round(data.income - data.expenses)
    }))
  };
}

async function generatePDFReport(reportType, analysis, period) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // En-tête
    doc.fontSize(24).font('Helvetica-Bold').text('RAPPORT FINANCIER', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Période: ${period}`, { align: 'center' });
    doc.text(`Date de génération: ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });
    doc.text(`Type de rapport: ${reportType}`, { align: 'center' });
    doc.moveDown(2);

    // Résumé Financier
    doc.fontSize(16).font('Helvetica-Bold').text('RÉSUMÉ FINANCIER');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');
    doc.text(`Revenus totaux: ${analysis.summary.totalRevenue.toLocaleString('fr-FR')} €`, { continued: false });
    doc.text(`Dépenses totales: ${analysis.summary.totalExpenses.toLocaleString('fr-FR')} €`);
    doc.text(`Résultat net: ${analysis.summary.netIncome.toLocaleString('fr-FR')} €`, { 
      color: analysis.summary.netIncome >= 0 ? 'green' : 'red' 
    });
    doc.fillColor('black');
    doc.text(`Marge: ${analysis.summary.margin}`);
    doc.text(`TVA collectée/déductible: ${analysis.summary.totalVAT.toLocaleString('fr-FR')} €`);
    doc.text(`Nombre de factures: ${analysis.summary.invoiceCount}`);
    doc.moveDown(2);

    // Top Fournisseurs
    doc.fontSize(16).font('Helvetica-Bold').text('TOP 10 FOURNISSEURS');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    analysis.topVendors.forEach((v, idx) => {
      doc.text(`${idx + 1}. ${v.vendor}: ${v.total.toLocaleString('fr-FR')} € (${v.count} facture${v.count > 1 ? 's' : ''})`);
    });
    doc.moveDown(2);

    // Répartition par Catégorie
    doc.fontSize(16).font('Helvetica-Bold').text('RÉPARTITION PAR CATÉGORIE');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    analysis.categoryBreakdown.forEach(cat => {
      doc.text(`${cat.category}: ${cat.total.toLocaleString('fr-FR')} € (${cat.percentage})`);
    });
    doc.moveDown(2);

    // Tendance Mensuelle
    if (analysis.monthlyTrend && analysis.monthlyTrend.length > 0) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('TENDANCE MENSUELLE');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      
      analysis.monthlyTrend.forEach(m => {
        doc.text(`${m.month}: Revenus ${m.income.toLocaleString('fr-FR')} € | Dépenses ${m.expenses.toLocaleString('fr-FR')} € | Net ${m.net.toLocaleString('fr-FR')} €`);
      });
    }

    // Pied de page
    doc.moveDown(3);
    doc.fontSize(8).text('Rapport généré automatiquement par Axilum Finance AI', { align: 'center', color: 'gray' });
    doc.text('Pour toute question, contactez votre expert-comptable.', { align: 'center', color: 'gray' });

    doc.end();
  });
}
  } catch (err) {
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { error: err.message || String(err) };
  }
};

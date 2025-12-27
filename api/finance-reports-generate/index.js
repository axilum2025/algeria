const PDFDocument = require('pdfkit');
const { uploadBuffer, buildBlobUrl } = require('../utils/storage');

module.exports = async function (context, req) {
  // Initialiser context.res dès le début
  context.res = {
    status: 200,
    headers: {},
    body: null
  };

  const setCors = () => {
    context.res.headers = Object.assign({}, context.res.headers, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  };

  // Toujours définir les headers CORS dès le début
  setCors();

  context.log('[Finance Reports] Request received:', { 
    method: req.method, 
    headers: req.headers,
    bodyKeys: Object.keys(req.body || {})
  });

  if (req.method === 'OPTIONS') {
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

    context.log('[Finance Reports] 📊 Processing request:', { 
      period, 
      format, 
      reportType, 
      invoicesCount: invoices.length 
    });

    // Si pas de factures, retourner message d'info
    if (invoices.length === 0) {
      context.log('[Finance Reports] ℹ️ No invoices provided, returning info message');
      context.res.status = 200;
      context.res.body = {
        message: 'Aucune facture fournie. Uploadez des factures pour générer un rapport.',
        recommendation: 'Utilisez le bouton Upload pour importer vos factures.',
        reportType
      };
      context.log('[Finance Reports] ✅ Response prepared:', context.res);
      return;
    }

    // Analyse des données
    const analysis = analyzeInvoicesForReport(invoices);
    context.log('[Finance Reports] 📈 Analysis completed:', { summary: analysis.summary });
    
    // Génération du rapport selon le type
    let pdfBuffer;
    if (format === 'pdf') {
      context.log('[Finance Reports] 📄 Generating PDF report...');
      pdfBuffer = await generatePDFReport(reportType, analysis, period);
      context.log('[Finance Reports] ✅ PDF generated, size:', pdfBuffer.length, 'bytes');
    } else {
      // JSON format
      pdfBuffer = Buffer.from(JSON.stringify(analysis, null, 2));
      context.log('[Finance Reports] 📋 JSON report generated');
    }

    // Upload vers Azure Blob Storage
    const filename = `finance-report-${reportType}-${period}-${Date.now()}.${format}`;
    const mimeType = format === 'pdf' ? 'application/pdf' : 'application/json';
    context.log('[Finance Reports] ☁️ Uploading to Azure:', { filename, mimeType });
    const azureUrl = await uploadBuffer('reports', filename, pdfBuffer, mimeType);
    context.log('[Finance Reports] ✅ Upload successful:', azureUrl);

    context.res.status = 200;
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
    context.log('[Finance Reports] 🎉 Success! Response prepared:', context.res);
  } catch (err) {
    context.log('[Report Generation Error]', err);
    context.res.status = 500;
    context.res.body = { error: err.message || String(err) };
    context.log('[Finance Reports] ❌ Error response prepared:', context.res);
  }
};

function analyzeInvoicesForReport(invoices) {
  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalVAT = 0;
  const vendors = {};
  const categories = {};
  const monthly = {};
  const invoicesByType = { income: [], expense: [] };

  invoices.forEach(inv => {
    const amount = Math.abs(parseFloat(inv.amount) || 0);
    const vendor = inv.vendor || inv.supplier || 'Fournisseur inconnu';
    // Le type est PRIORITAIRE - si absent, on déduit de keywords
    let type = inv.type || 'expense'; // Par défaut dépense
    
    // Détection intelligente si type manquant
    if (!inv.type) {
      const vendorLower = vendor.toLowerCase();
      const keywords = ['client', 'vente', 'facture client', 'revenue'];
      if (keywords.some(k => vendorLower.includes(k))) {
        type = 'income';
      }
    }

    // Parser la date correctement
    let date;
    const dateStr = inv.date || inv.invoiceDate || inv.created_at;
    if (dateStr) {
      date = new Date(dateStr);
      // Vérifier si la date est valide
      if (isNaN(date.getTime())) {
        date = new Date();
      }
    } else {
      date = new Date();
    }
    
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const category = inv.category || inv.type || 'Non classifié';

    // Classification revenus vs dépenses basée UNIQUEMENT sur le type
    if (type === 'income') {
      totalRevenue += amount;
      invoicesByType.income.push(inv);
    } else {
      totalExpenses += amount;
      invoicesByType.expense.push(inv);
    }

    // TVA - Utiliser les données réelles de la facture
    let vatAmount = 0;
    
    // 1. Priorité: Champ totalTax extrait de la facture
    if (inv.extractedFields && inv.extractedFields.totalTax) {
      vatAmount = Math.abs(parseFloat(inv.extractedFields.totalTax) || 0);
    }
    // 2. Sinon: Champ Tax dans fields
    else if (inv.fields && inv.fields.Tax) {
      vatAmount = Math.abs(parseFloat(inv.fields.Tax) || 0);
    }
    // 3. Sinon: Calculer depuis invoiceTotal et subTotal si disponibles
    else if (inv.extractedFields && inv.extractedFields.invoiceTotal && inv.extractedFields.subTotal) {
      const total = parseFloat(inv.extractedFields.invoiceTotal) || 0;
      const subtotal = parseFloat(inv.extractedFields.subTotal) || 0;
      vatAmount = Math.abs(total - subtotal);
    }
    // 4. Sinon: Utiliser le champ vat/tva direct si présent
    else if (inv.vat || inv.tva) {
      vatAmount = Math.abs(parseFloat(inv.vat || inv.tva) || 0);
    }
    // 5. Pas de TVA détectée - laisser à 0 (ne pas estimer)
    
    totalVAT += vatAmount;

    // Par fournisseur avec type
    if (!vendors[vendor]) {
      vendors[vendor] = { count: 0, total: 0, type: type };
    }
    vendors[vendor].count++;
    vendors[vendor].total += amount;

    // Par catégorie
    if (!categories[category]) {
      categories[category] = { count: 0, total: 0, income: 0, expenses: 0 };
    }
    categories[category].count++;
    categories[category].total += amount;
    if (type === 'income') {
      categories[category].income += amount;
    } else {
      categories[category].expenses += amount;
    }

    // Par mois
    if (!monthly[monthKey]) {
      monthly[monthKey] = { income: 0, expenses: 0 };
    }
    if (type === 'income') {
      monthly[monthKey].income += amount;
    } else {
      monthly[monthKey].expenses += amount;
    }
  });

  const netIncome = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
  const totalAmount = totalRevenue + totalExpenses;

  return {
    summary: {
      totalRevenue: Math.round(totalRevenue),
      totalExpenses: Math.round(totalExpenses),
      netIncome: Math.round(netIncome),
      totalVAT: Math.round(totalVAT),
      margin: margin.toFixed(1) + '%',
      invoiceCount: invoices.length,
      incomeCount: invoicesByType.income.length,
      expenseCount: invoicesByType.expense.length
    },
    topVendors: Object.entries(vendors).map(([vendor, data]) => ({
      vendor,
      count: data.count,
      total: Math.round(data.total),
      type: data.type === 'income' ? 'Client' : 'Fournisseur'
    })).sort((a, b) => b.total - a.total).slice(0, 10),
    categoryBreakdown: Object.entries(categories).map(([category, data]) => ({
      category,
      count: data.count,
      total: Math.round(data.total),
      income: Math.round(data.income),
      expenses: Math.round(data.expenses),
      percentage: totalAmount > 0 ? ((data.total / totalAmount) * 100).toFixed(1) + '%' : '0%'
    })).sort((a, b) => b.total - a.total),
    monthlyTrend: Object.entries(monthly).sort().map(([month, data]) => ({
      month,
      income: Math.round(data.income),
      expenses: Math.round(data.expenses),
      net: Math.round(data.income - data.expenses)
    })),
    invoiceDetails: invoices.map(inv => ({
      vendor: inv.vendor || 'Inconnu',
      amount: Math.abs(parseFloat(inv.amount) || 0),
      vat: inv.extractedFields?.totalTax || inv.fields?.Tax || 0,
      total: inv.extractedFields?.invoiceTotal || inv.amount,
      date: inv.date || inv.invoiceDate,
      number: inv.invoiceNumber || inv.extractedFields?.invoiceId || 'N/A',
      type: inv.type || 'expense',
      category: inv.category || 'Non classifié'
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
    
    // Box pour le résumé
    const summaryY = doc.y;
    doc.rect(50, summaryY - 5, 500, 150).stroke();
    doc.moveDown(0.5);
    
    doc.text(`Revenus totaux: ${analysis.summary.totalRevenue.toLocaleString('fr-FR')} €`, { continued: false });
    doc.text(`Dépenses totales: ${analysis.summary.totalExpenses.toLocaleString('fr-FR')} €`);
    
    // Résultat net avec couleur
    const netIncome = analysis.summary.netIncome;
    doc.fillColor(netIncome >= 0 ? 'green' : 'red')
       .text(`Résultat net: ${netIncome.toLocaleString('fr-FR')} €`);
    doc.fillColor('black');
    
    doc.text(`Marge: ${analysis.summary.margin}`);
    doc.text(`TVA collectée/déductible: ${analysis.summary.totalVAT.toLocaleString('fr-FR')} €`);
    doc.text(`Nombre de factures: ${analysis.summary.invoiceCount} (${analysis.summary.incomeCount} revenus, ${analysis.summary.expenseCount} dépenses)`);
    doc.moveDown(2);

    // Top Fournisseurs/Clients
    doc.fontSize(16).font('Helvetica-Bold').text('TOP 10 FOURNISSEURS & CLIENTS');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    analysis.topVendors.forEach((v, idx) => {
      doc.text(`${idx + 1}. ${v.vendor} [${v.type}]: ${v.total.toLocaleString('fr-FR')} € (${v.count} facture${v.count > 1 ? 's' : ''})`);
    });
    doc.moveDown(2);

    // Répartition par Catégorie
    doc.fontSize(16).font('Helvetica-Bold').text('RÉPARTITION PAR CATÉGORIE');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    analysis.categoryBreakdown.forEach(cat => {
      const details = cat.income > 0 && cat.expenses > 0 
        ? ` (Revenus: ${cat.income.toLocaleString('fr-FR')}€, Dépenses: ${cat.expenses.toLocaleString('fr-FR')}€)`
        : cat.income > 0 ? ' (Revenus)' : ' (Dépenses)';
      doc.text(`${cat.category}: ${cat.total.toLocaleString('fr-FR')} € ${details} - ${cat.percentage}`);
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

    // NOUVEAU: Détail complet des factures
    if (analysis.invoiceDetails && analysis.invoiceDetails.length > 0) {
      doc.addPage();
      doc.fontSize(18).font('Helvetica-Bold').text('DÉTAIL DES FACTURES', { align: 'center' });
      doc.moveDown(1);
      
      // Trier par date
      const sortedInvoices = [...analysis.invoiceDetails].sort((a, b) => 
        new Date(b.date || 0) - new Date(a.date || 0)
      );

      sortedInvoices.forEach((inv, idx) => {
        // Nouvelle page tous les 6 factures pour éviter débordement
        if (idx > 0 && idx % 6 === 0) {
          doc.addPage();
        }

        const invType = inv.type === 'income' ? 'REVENU' : 'DÉPENSE';
        const typeColor = inv.type === 'income' ? 'green' : 'red';
        
        // En-tête facture
        doc.fontSize(12).font('Helvetica-Bold')
           .fillColor(typeColor)
           .text(`${idx + 1}. ${inv.vendor} [${invType}]`);
        doc.fillColor('black');
        
        // Détails
        doc.fontSize(9).font('Helvetica');
        doc.text(`   Numéro: ${inv.number}`);
        doc.text(`   Date: ${inv.date ? new Date(inv.date).toLocaleDateString('fr-FR') : 'N/A'}`);
        doc.text(`   Catégorie: ${inv.category}`);
        
        // Montants détaillés
        const amount = parseFloat(inv.amount) || 0;
        const vat = parseFloat(inv.vat) || 0;
        const total = parseFloat(inv.total) || amount;
        const htAmount = vat > 0 ? total - vat : amount;
        
        doc.text(`   Montant HT: ${htAmount.toLocaleString('fr-FR')} €`);
        if (vat > 0) {
          const vatRate = htAmount > 0 ? ((vat / htAmount) * 100).toFixed(1) : '0';
          doc.text(`   TVA/IVA (${vatRate}%): ${vat.toLocaleString('fr-FR')} €`);
        } else {
          doc.text(`   TVA/IVA: Non détectée`);
        }
        doc.font('Helvetica-Bold').text(`   Total TTC: ${total.toLocaleString('fr-FR')} €`);
        
        doc.moveDown(0.8);
        doc.font('Helvetica');
        
        // Ligne de séparation
        if (idx < sortedInvoices.length - 1) {
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown(0.5);
        }
      });
    }

    // Pied de page
    doc.moveDown(3);
    doc.fontSize(8).text('Rapport généré automatiquement par Axilum Finance AI', { align: 'center', color: 'gray' });
    doc.text('Pour toute question, contactez votre expert-comptable.', { align: 'center', color: 'gray' });

    doc.end();
  });
}

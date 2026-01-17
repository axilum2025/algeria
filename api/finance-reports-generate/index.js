const PDFDocument = require('pdfkit');
const { getLangFromReq, getLocaleFromLang } = require('../utils/lang');
const { uploadBuffer, buildBlobUrl } = require('../utils/storage');
const { getAuthEmail, setCors } = require('../utils/auth');
const { checkUserCanAddBytes, buildQuotaExceededBody } = require('../utils/storageQuota');

module.exports = async function (context, req) {
  // Initialiser context.res avec CORS
  setCors(context, 'POST, OPTIONS');
  context.res.headers['Content-Type'] = 'application/json';
  context.res.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  context.res.headers['Pragma'] = 'no-cache';
  context.res.headers['Expires'] = '0';

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
    // Auth obligatoire pour générer un rapport
    const userId = getAuthEmail(req);
    if (!userId) {
      context.res.status = 401;
      context.res.body = { error: 'Non authentifié' };
      return;
    }

    const lang = getLangFromReq(req);
    const locale = getLocaleFromLang(lang);
    const body = req.body || {};
    const period = body.period || 'periode-courante';
    const format = body.format || 'pdf';
    const invoices = Array.isArray(body.invoices) ? body.invoices : [];
    const reportType = body.reportType || 'summary'; // 'summary', 'detailed', 'vat', 'cashflow'
    const companyInfo = body.companyInfo || {}; // Informations de l'entreprise

    context.log('[Finance Reports] 📊 Processing request:', { 
      userId,
      period, 
      format, 
      reportType, 
      invoicesCount: invoices.length,
      hasCompanyInfo: !!companyInfo.companyName
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
      pdfBuffer = await generatePDFReport(reportType, analysis, period, companyInfo);
      context.log('[Finance Reports] ✅ PDF generated, size:', pdfBuffer.length, 'bytes');
    } else {
      // JSON format
      pdfBuffer = Buffer.from(JSON.stringify(analysis, null, 2));
      context.log('[Finance Reports] 📋 JSON report generated');
    }

    // Upload vers Azure Blob Storage avec préfixe userId pour isolation
    const filename = `finance-report-${reportType}-${period}-${Date.now()}.${format}`;
    const mimeType = format === 'pdf' ? 'application/pdf' : 'application/json';
    context.log('[Finance Reports] ☁️ Uploading to Azure:', { filename, mimeType, userId });

    const quotaCheck = await checkUserCanAddBytes(userId, pdfBuffer.length);
    if (!quotaCheck.ok) {
      context.res.status = 413;
      context.res.body = buildQuotaExceededBody(quotaCheck);
      context.log('[Finance Reports] ❌ Quota exceeded, blocking upload');
      return;
    }

    const azureUrl = await uploadBuffer('reports', filename, pdfBuffer, mimeType, userId);
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
        // Essayer format DD/MM/YYYY ou similaire
        const parts = dateStr.toString().match(/(\d{1,2})[\\/\-\s]+(\w+|\d{1,2})[\\/\-\s]+(\d{4})/);
        if (parts) {
          // Mapper les mois portugais
          const monthMap = {
            'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
            'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11,
            'de': null
          };
          const month = isNaN(parts[2]) ? (monthMap[parts[2].toLowerCase()] ?? 0) : parseInt(parts[2]) - 1;
          date = new Date(parts[3], month, parts[1]);
        }
        if (isNaN(date.getTime())) {
          date = new Date();
        }
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

  // Calcul de la trésorerie (simplifié)
  const cashFlow = totalRevenue - totalExpenses; // Flux net
  const averageInvoiceAmount = invoices.length > 0 ? totalAmount / invoices.length : 0;
  const averageExpenseAmount = invoicesByType.expense.length > 0 ? 
    totalExpenses / invoicesByType.expense.length : 0;
  const averageRevenueAmount = invoicesByType.income.length > 0 ? 
    totalRevenue / invoicesByType.income.length : 0;

  // Ratios financiers (KPIs)
  const expenseRatio = totalAmount > 0 ? (totalExpenses / totalAmount) * 100 : 0;
  const revenueRatio = totalAmount > 0 ? (totalRevenue / totalAmount) * 100 : 0;
  const vatRatio = totalAmount > 0 ? (totalVAT / totalAmount) * 100 : 0;
  
  // Analyse de croissance (si plusieurs mois) - basée sur le résultat net
  const monthlyData = Object.entries(monthly).sort();
  let growthRate = null;
  let trend = 'stable';
  
  if (monthlyData.length >= 2) {
    const firstMonth = monthlyData[0][1];
    const lastMonth = monthlyData[monthlyData.length - 1][1];
    const firstNet = firstMonth.income - firstMonth.expenses;
    const lastNet = lastMonth.income - lastMonth.expenses;
    
    // Calculer la croissance basée sur le résultat net
    if (Math.abs(firstNet) > 0) {
      growthRate = ((lastNet - firstNet) / Math.abs(firstNet)) * 100;
      // Déterminer la tendance basée sur l'évolution du résultat
      if (lastNet > firstNet && growthRate > 5) {
        trend = 'croissance';
      } else if (lastNet < firstNet && growthRate < -5) {
        trend = 'décroissance';
      } else {
        trend = 'stable';
      }
    } else if (lastNet > 0) {
      trend = 'croissance';
      growthRate = 100;
    }
  }

  return {
    summary: {
      totalRevenue: Math.round(totalRevenue),
      totalExpenses: Math.round(totalExpenses),
      netIncome: Math.round(netIncome),
      totalVAT: Math.round(totalVAT),
      margin: totalRevenue > 0 ? margin.toFixed(1) + '%' : 'N/A',
      invoiceCount: invoices.length,
      incomeCount: invoicesByType.income.length,
      expenseCount: invoicesByType.expense.length,
      averageInvoice: Math.round(averageInvoiceAmount),
      cashFlow: Math.round(cashFlow)
    },
    kpis: {
      expenseRatio: expenseRatio.toFixed(1) + '%',
      revenueRatio: revenueRatio.toFixed(1) + '%',
      vatRatio: vatRatio.toFixed(1) + '%',
      averageExpense: Math.round(averageExpenseAmount),
      averageRevenue: Math.round(averageRevenueAmount),
      growthRate: growthRate !== null ? growthRate.toFixed(1) + '%' : 'N/A',
      trend: trend,
      profitability: netIncome >= 0 ? 'Rentable' : 'Déficitaire'
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

async function generatePDFReport(reportType, analysis, period, companyInfo = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      margin: 50,
      bufferPages: true,
      autoFirstPage: false
    });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    
    // Ajouter la première page
    doc.addPage();

    // En-tête avec logo et informations entreprise
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#1e40af').text('RAPPORT FINANCIER', { align: 'center' });
    doc.moveDown(0.5);
    
    // Informations de l'entreprise si disponibles
    if (companyInfo.companyName) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text(companyInfo.companyName, { align: 'center' });
      if (companyInfo.address) {
        doc.fontSize(10).font('Helvetica').text(companyInfo.address, { align: 'center' });
      }
      if (companyInfo.city) {
        doc.text(companyInfo.city, { align: 'center' });
      }
      if (companyInfo.phone || companyInfo.email) {
        const contact = [companyInfo.phone, companyInfo.email].filter(Boolean).join(' • ');
        doc.text(contact, { align: 'center' });
      }
      if (companyInfo.taxId) {
        doc.fontSize(9).fillColor('gray').text(`NIF: ${companyInfo.taxId}`, { align: 'center' });
      }
      doc.moveDown(1);
      doc.moveTo(100, doc.y).lineTo(500, doc.y).stroke();
      doc.moveDown(1);
    }
    
    doc.fontSize(12).font('Helvetica').text(`Période: ${period}`, { align: 'center' });
    doc.text(`Date de génération: ${new Date().toLocaleDateString(locale)}`, { align: 'center' });
    doc.text(`Type de rapport: ${reportType}`, { align: 'center' });
    doc.moveDown(2);

    // Résumé Financier
    doc.fontSize(16).font('Helvetica-Bold').text('RÉSUMÉ FINANCIER');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');
    
    doc.text(`Revenus totaux: ${analysis.summary.totalRevenue.toLocaleString(locale)} €`, { continued: false });
    doc.text(`Dépenses totales: ${analysis.summary.totalExpenses.toLocaleString(locale)} €`);
    
    // Résultat net avec couleur
    const netIncome = analysis.summary.netIncome;
    doc.fillColor(netIncome >= 0 ? 'green' : 'red')
       .text(`Résultat net: ${netIncome.toLocaleString(locale)} €`);
    doc.fillColor('black');
    
    doc.text(`Marge: ${analysis.summary.margin}`);
    doc.text(`TVA collectée/déductible: ${analysis.summary.totalVAT.toLocaleString(locale)} €`);
    doc.text(`Nombre de factures: ${analysis.summary.invoiceCount} (${analysis.summary.incomeCount} revenus, ${analysis.summary.expenseCount} dépenses)`);
    doc.moveDown(2);

    // NOUVEAU: Indicateurs Clés (KPIs)
    doc.fontSize(16).font('Helvetica-Bold').text('INDICATEURS CLÉS DE PERFORMANCE (KPIs)');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    
    // N'afficher les ratios que s'ils ont du sens
    if (analysis.summary.totalRevenue > 0) {
      doc.text(`Ratio dépenses/total: ${analysis.kpis.expenseRatio}`);
      doc.text(`Ratio revenus/total: ${analysis.kpis.revenueRatio}`);
    } else {
      doc.text(`Total dépenses: ${analysis.summary.totalExpenses.toLocaleString(locale)} €`);
      doc.fillColor('gray').text(`(Aucun revenu pour calculer des ratios)`).fillColor('black');
    }
    doc.text(`Ratio TVA/total: ${analysis.kpis.vatRatio}`);
    doc.text(`Montant moyen par facture: ${analysis.summary.averageInvoice.toLocaleString(locale)} €`);
    if (analysis.summary.expenseCount > 0) {
      doc.text(`Dépense moyenne: ${analysis.kpis.averageExpense.toLocaleString(locale)} €`);
    }
    if (analysis.summary.incomeCount > 0) {
      doc.text(`Revenu moyen: ${analysis.kpis.averageRevenue.toLocaleString(locale)} €`);
    }
    doc.font('Helvetica-Bold');
    doc.fillColor(analysis.kpis.profitability === 'Rentable' ? 'green' : 'red')
       .text(`Rentabilité: ${analysis.kpis.profitability}`);
    doc.fillColor('black').font('Helvetica');
    
    if (analysis.kpis.growthRate !== 'N/A') {
      const growthColor = analysis.kpis.trend === 'croissance' ? 'green' : 
                          analysis.kpis.trend === 'décroissance' ? 'red' : 'orange';
      doc.fillColor(growthColor)
         .text(`Tendance: ${analysis.kpis.trend} (${analysis.kpis.growthRate})`);
      doc.fillColor('black');
    }
    doc.moveDown(2);

    // NOUVEAU: Analyse de Trésorerie
    doc.fontSize(16).font('Helvetica-Bold').text('ANALYSE DE TRÉSORERIE');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    
    doc.text(`Flux de trésorerie net: ${analysis.summary.cashFlow.toLocaleString(locale)} €`);
    doc.text(`Total encaissements (revenus): ${analysis.summary.totalRevenue.toLocaleString(locale)} €`);
    doc.text(`Total décaissements (dépenses): ${analysis.summary.totalExpenses.toLocaleString(locale)} €`);
    
    const cashPosition = analysis.summary.cashFlow >= 0 ? 'Positive' : 'Négative';
    const cashColor = analysis.summary.cashFlow >= 0 ? 'green' : 'red';
    doc.fillColor(cashColor)
       .text(`Position de trésorerie: ${cashPosition}`);
    doc.fillColor('black');
    
    if (analysis.summary.cashFlow < 0) {
      doc.fontSize(9).fillColor('red')
         .text('⚠️ Attention: La trésorerie est négative. Surveillez vos liquidités.');
      doc.fillColor('black').fontSize(11);
    }
    doc.moveDown(2);

    // Top Fournisseurs/Clients
    doc.fontSize(16).font('Helvetica-Bold').text('TOP 10 FOURNISSEURS & CLIENTS');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    analysis.topVendors.forEach((v, idx) => {
      doc.text(`${idx + 1}. ${v.vendor} [${v.type}]: ${v.total.toLocaleString(locale)} € (${v.count} facture${v.count > 1 ? 's' : ''})`);
    });
    doc.moveDown(2);

    // Répartition par Catégorie
    doc.fontSize(16).font('Helvetica-Bold').text('RÉPARTITION PAR CATÉGORIE');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    analysis.categoryBreakdown.forEach(cat => {
      const details = cat.income > 0 && cat.expenses > 0 
        ? ` (Revenus: ${cat.income.toLocaleString(locale)}€, Dépenses: ${cat.expenses.toLocaleString(locale)}€)`
        : cat.income > 0 ? ' (Revenus)' : ' (Dépenses)';
      doc.text(`${cat.category}: ${cat.total.toLocaleString(locale)} € ${details} - ${cat.percentage}`);
    });
    doc.moveDown(2);

    // Tendance Mensuelle
    if (analysis.monthlyTrend && analysis.monthlyTrend.length > 0) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('TENDANCE MENSUELLE');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      
      analysis.monthlyTrend.forEach(m => {
        doc.text(`${m.month}: Revenus ${m.income.toLocaleString(locale)} € | Dépenses ${m.expenses.toLocaleString(locale)} € | Net ${m.net.toLocaleString(locale)} €`);
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
        doc.text(`   Date: ${inv.date ? new Date(inv.date).toLocaleDateString(locale) : 'N/A'}`);
        doc.text(`   Catégorie: ${inv.category}`);
        
        // Montants détaillés
        const amount = parseFloat(inv.amount) || 0;
        const vat = parseFloat(inv.vat) || 0;
        const total = parseFloat(inv.total) || amount;
        const htAmount = vat > 0 ? total - vat : amount;
        
        doc.text(`   Montant HT: ${htAmount.toLocaleString(locale)} €`);
        if (vat > 0) {
          const vatRate = htAmount > 0 ? ((vat / htAmount) * 100).toFixed(1) : '0';
          doc.text(`   TVA/IVA (${vatRate}%): ${vat.toLocaleString(locale)} €`);
        } else {
          doc.text(`   TVA/IVA: Non détectée`);
        }
        doc.font('Helvetica-Bold').text(`   Total TTC: ${total.toLocaleString(locale)} €`);
        
        doc.moveDown(0.8);
        doc.font('Helvetica');
        
        // Ligne de séparation
        if (idx < sortedInvoices.length - 1) {
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown(0.5);
        }
      });
    }

    // NOUVEAU: Recommandations et Alertes
    doc.addPage();
    doc.fontSize(18).font('Helvetica-Bold').text('RECOMMANDATIONS & ALERTES', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(11).font('Helvetica');

    const recommendations = [];
    
    // Analyser et générer des recommandations
    if (analysis.summary.netIncome < 0) {
      recommendations.push({
        type: 'Alerte',
        color: 'red',
        icon: '⚠️',
        text: `Résultat net négatif de ${Math.abs(analysis.summary.netIncome).toLocaleString(locale)} €. Réduisez vos dépenses ou augmentez vos revenus.`
      });
    }
    
    if (parseFloat(analysis.kpis.expenseRatio) > 70 && analysis.summary.totalRevenue > 0) {
      recommendations.push({
        type: 'Attention',
        color: 'orange',
        icon: '⚡',
        text: `Ratio dépenses élevé (${analysis.kpis.expenseRatio}). Optimisez vos coûts pour améliorer la rentabilité.`
      });
    }
    
    if (analysis.summary.cashFlow < 0) {
      recommendations.push({
        type: 'Alerte',
        color: 'red',
        icon: '💰',
        text: 'Flux de trésorerie négatif. Surveillez vos liquidités et planifiez vos paiements.'
      });
    }
    
    if (analysis.kpis.trend === 'croissance' && analysis.summary.netIncome >= 0) {
      recommendations.push({
        type: 'Succès',
        color: 'green',
        icon: '📈',
        text: `Tendance positive avec ${analysis.kpis.growthRate} de croissance. Continuez sur cette lancée !`
      });
    } else if (analysis.kpis.trend === 'décroissance' && analysis.summary.netIncome < 0) {
      recommendations.push({
        type: 'Attention',
        color: 'orange',
        icon: '📉',
        text: `Tendance à la baisse avec ${analysis.kpis.growthRate} de variation. Attention à l'évolution de votre situation.`
      });
    }
    
    if (analysis.categoryBreakdown.length > 0) {
      const topCategory = analysis.categoryBreakdown[0];
      if (parseFloat(topCategory.percentage) > 50) {
        recommendations.push({
          type: 'Info',
          color: 'blue',
          icon: 'ℹ️',
          text: `La catégorie "${topCategory.category}" représente ${topCategory.percentage} du total. Diversifiez si possible.`
        });
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'Info',
        color: 'green',
        icon: '✓',
        text: 'Situation financière saine. Continuez à suivre vos indicateurs régulièrement.'
      });
    }
    
    // Afficher les recommandations (sans émojis pour éviter problèmes d'encodage)
    recommendations.forEach((rec, idx) => {
      doc.font('Helvetica-Bold').fillColor(rec.color || 'black')
         .text(`[${rec.type}]`);
      doc.font('Helvetica').fillColor('black')
         .text(`${rec.text}`);
      doc.moveDown(0.8);
    });
    
    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('gray');
    doc.text('Ces recommandations sont générées automatiquement et ne remplacent pas les conseils d\'un expert-comptable.');
    doc.fillColor('black').font('Helvetica');

    // Pied de page
    doc.moveDown(3);
    doc.fontSize(8).text('Rapport généré automatiquement par Axilum Finance AI', { align: 'center', color: 'gray' });
    doc.text('Pour toute question, contactez votre expert-comptable.', { align: 'center', color: 'gray' });

    doc.end();
  });
}

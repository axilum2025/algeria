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
    // Accepte soit expenses soit invoices
    const items = Array.isArray(req.body?.expenses) ? req.body.expenses : 
                  Array.isArray(req.body?.invoices) ? req.body.invoices : [];

    if (items.length === 0) {
      setCors();
      context.res.status = 200;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { 
        categories: [], 
        summary: 'Aucune dépense fournie. Uploadez des factures pour classifier.',
        recommendation: 'Utilisez le bouton Upload pour importer vos factures.'
      };
      return;
    }

    // Règles de classification enrichies (basées sur mots-clés et contexte)
    const rules = [
      { key: /eau|water|águas|energy|energie|electricity|électricité|gaz|gas/i, cat: 'Services Publics', subcat: 'Eau/Énergie', taxDeductible: true },
      { key: /resto|restaurant|repas|food|café|lunch|dinner|cantina/i, cat: 'Frais de Repas', subcat: 'Restauration', taxDeductible: true, limit: 0.5 },
      { key: /saas|logiciel|software|licence|license|cloud|aws|azure|google cloud/i, cat: 'Logiciels & Abonnements', subcat: 'IT/Tech', taxDeductible: true },
      { key: /transport|uber|taxi|carburant|fuel|essence|train|avion|flight|hotel|hébergement/i, cat: 'Déplacements', subcat: 'Transport', taxDeductible: true },
      { key: /matériel|hardware|équipement|device|ordinateur|laptop|écran|imprimante/i, cat: 'Matériel & Équipement', subcat: 'IT/Bureau', taxDeductible: true },
      { key: /marketing|ads|publicité|facebook|google ads|campagne|seo|social media/i, cat: 'Marketing & Publicité', subcat: 'Acquisition', taxDeductible: true },
      { key: /loyer|rent|bureau|office|coworking|espace/i, cat: 'Loyer & Locaux', subcat: 'Immobilier', taxDeductible: true },
      { key: /fourniture|papeterie|supplies|consommable/i, cat: 'Fournitures', subcat: 'Bureau', taxDeductible: true },
      { key: /formation|training|cours|conférence|séminaire/i, cat: 'Formation', subcat: 'Développement', taxDeductible: true },
      { key: /télécom|phone|internet|mobile|data|téléphone/i, cat: 'Télécommunications', subcat: 'Communication', taxDeductible: true },
      { key: /assurance|insurance|mutuelle/i, cat: 'Assurances', subcat: 'Protection', taxDeductible: true },
      { key: /consultant|consulting|conseil|audit|legal|juridique|comptable/i, cat: 'Services Professionnels', subcat: 'Conseil', taxDeductible: true },
      { key: /salaire|salary|wages|paie|rémunération/i, cat: 'Salaires', subcat: 'Personnel', taxDeductible: true },
      { key: /charge|cotisation|social|sécurité sociale/i, cat: 'Charges Sociales', subcat: 'Personnel', taxDeductible: true }
    ];

    const categoryStats = {};
    const categories = items.map((e, idx) => {
      const desc = String(e.description || e.vendor || '').toLowerCase();
      const amount = Math.abs(parseFloat(e.amount) || 0);
      let category = 'Autres';
      let subcategory = 'Non classifié';
      let taxDeductible = false;
      let confidence = 0;

      for (const r of rules) {
        if (r.key.test(desc)) { 
          category = r.cat;
          subcategory = r.subcat || '';
          taxDeductible = r.taxDeductible || false;
          confidence = 0.85; // Confiance élevée pour match par règle
          break; 
        }
      }

      // Si pas de match, essayer une classification basique par montant et contexte
      if (category === 'Autres') {
        if (amount > 5000) {
          category = 'Investissements';
          subcategory = 'Gros achats';
          confidence = 0.5;
        } else if (amount < 50) {
          category = 'Petites Dépenses';
          subcategory = 'Frais divers';
          confidence = 0.6;
        } else {
          confidence = 0.3; // Faible confiance
        }
      }

      // Statistiques par catégorie
      if (!categoryStats[category]) {
        categoryStats[category] = { count: 0, total: 0, items: [] };
      }
      categoryStats[category].count++;
      categoryStats[category].total += amount;
      categoryStats[category].items.push({ description: e.description || e.vendor, amount });

      return { 
        index: idx, 
        description: e.description || e.vendor || '', 
        vendor: e.vendor || '',
        amount,
        currency: e.currency || 'EUR',
        date: e.date || null,
        category,
        subcategory,
        taxDeductible,
        confidence
      };
    });

    // Résumé par catégorie
    const categorySummary = Object.entries(categoryStats).map(([cat, data]) => ({
      category: cat,
      count: data.count,
      totalAmount: Math.round(data.total),
      percentage: ((data.total / items.reduce((sum, e) => sum + Math.abs(parseFloat(e.amount) || 0), 0)) * 100).toFixed(1) + '%',
      averageAmount: Math.round(data.total / data.count)
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    const totalAmount = items.reduce((sum, e) => sum + Math.abs(parseFloat(e.amount) || 0), 0);
    const deductibleAmount = categories.filter(c => c.taxDeductible).reduce((sum, c) => sum + c.amount, 0);

    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { 
      categories,
      summary: {
        totalExpenses: items.length,
        totalAmount: Math.round(totalAmount),
        deductibleAmount: Math.round(deductibleAmount),
        deductiblePercentage: ((deductibleAmount / totalAmount) * 100).toFixed(1) + '%',
        categoriesUsed: Object.keys(categoryStats).length
      },
      categorySummary,
      rules: rules.map(r => ({ category: r.cat, subcategory: r.subcat, taxDeductible: r.taxDeductible })),
      recommendations: [
        `${categories.filter(c => c.confidence < 0.6).length} dépense(s) avec faible confiance de classification.`,
        `${Math.round(deductibleAmount)}€ (${((deductibleAmount / totalAmount) * 100).toFixed(1)}%) potentiellement déductibles fiscalement.`,
        'Vérifiez les classifications "Autres" pour améliorer la précision.',
        'Ajoutez des règles personnalisées pour vos fournisseurs récurrents.'
      ]
    };
  } catch (err) {
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { error: err.message || String(err) };
  }
};

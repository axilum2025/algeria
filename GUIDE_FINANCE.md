# Guide de Développement - AI Finance & Comptabilité

## Vue d'Ensemble

Le module **AI Finance & Comptabilité** est l'outil de gestion financière et comptable intelligent de la plateforme Algeria.

### État Actuel

- ✅ **Wrapper module créé** : `/public/js/finance-module.js`
- ✅ **Chargement dynamique** : Fonction `loadFinanceModule()` dans index.html
- ✅ **Code principal** : Fonction `openFinanceAI()` dans index.html (ligne 14201)
- ✅ **Bouton sidebar** : Restauré et utilise le chargement modulaire

### Architecture

```
┌─────────────────────────────────────────────┐
│           index.html (Application)          │
│                                             │
│  • loadFinanceModule() - Point d'entrée    │
│  • openFinanceAI() - Code principal        │
│  • Variable: financeModuleLoaded           │
└──────────────┬──────────────────────────────┘
               │ Charge dynamiquement
               ▼
┌─────────────────────────────────────────────┐
│   /public/js/finance-module.js (Wrapper)   │
│                                             │
│  • window.openFinanceModule() - Appelle    │
│    la fonction principale                   │
│  • Gestion d'erreurs                       │
│  • Roadmap de développement                │
└─────────────────────────────────────────────┘
```

---

## Fonctionnalités Actuelles

Le module Finance existant dans `index.html` fournit une interface avec plusieurs sections :
- Tableau de bord financier
- Modules à venir (facturation, comptabilité, trésorerie, etc.)

---

## Roadmap de Développement Complète

### MVP (Phase 1) - Comptabilité de Base

#### 1. Plan Comptable & Écritures

**Structure de données :**
```javascript
// Plan comptable
const account = {
    id: 'acc_512000',
    number: '512000',
    name: 'Banque',
    type: 'asset', // asset, liability, equity, income, expense
    category: 'bank',
    balance: 25000.00,
    currency: 'EUR'
};

// Écriture comptable
const entry = {
    id: 'entry_123',
    date: '2024-01-15',
    journal: 'BQ', // BQ=Banque, AC=Achat, VT=Vente, OD=Opérations diverses
    reference: 'VT00123',
    description: 'Facture client ABC',
    lines: [
        { account: '411000', debit: 12000, credit: 0, label: 'Client ABC' },
        { account: '707000', debit: 0, credit: 10000, label: 'Vente marchandises' },
        { account: '445710', debit: 0, credit: 2000, label: 'TVA collectée 20%' }
    ],
    validated: false,
    createdBy: 'user_123',
    createdAt: '2024-01-15T10:30:00'
};
```

**Interface de saisie :**
```
┌────────────────────────────────────────────┐
│  📝 Nouvelle Écriture                     │
├────────────────────────────────────────────┤
│  Date: [15/01/2024]  Journal: [BQ ▼]      │
│  Pièce: [VT00123]                         │
│  Description: [Facture client ABC]        │
│                                            │
│  Compte    │ Libellé       │ Débit  │ Crédit │
│  ─────────────────────────────────────────│
│  411000   │ Client ABC    │ 12000 │       │
│  707000   │ Vente         │       │ 10000 │
│  445710   │ TVA 20%       │       │  2000 │
│  ─────────────────────────────────────────│
│  TOTAL                    │ 12000 │ 12000 │
│                                            │
│  [Enregistrer] [Valider]                  │
└────────────────────────────────────────────┘
```

**Fonctionnalités MVP :**
- ✓ Plan comptable standard français (PCG)
- ✓ Personnalisation du plan comptable
- ✓ Saisie manuelle d'écritures
- ✓ Validation équilibre débit/crédit
- ✓ Journaux multiples (BQ, AC, VT, OD, AN)
- ✓ Recherche et filtrage
- ✓ Export Excel

#### 2. Facturation Simple

**Structure facture :**
```javascript
const invoice = {
    id: 'inv_456',
    number: 'FA2024-001',
    type: 'invoice', // invoice, quote, credit_note
    status: 'draft', // draft, sent, paid, overdue, cancelled
    date: '2024-01-15',
    dueDate: '2024-02-15',
    
    client: {
        id: 'client_789',
        name: 'Entreprise ABC',
        address: '123 Rue Example',
        siret: '12345678900012',
        email: 'contact@abc.com'
    },
    
    items: [
        {
            description: 'Prestation de conseil',
            quantity: 10,
            unitPrice: 500,
            vatRate: 20,
            amount: 5000,
            vatAmount: 1000,
            totalAmount: 6000
        }
    ],
    
    subtotal: 5000,
    totalVat: 1000,
    total: 6000,
    
    paymentTerms: 'Paiement à 30 jours',
    notes: 'Merci pour votre confiance',
    
    paidAmount: 0,
    paidDate: null,
    paymentMethod: null
};
```

**Template de facture :**
```
┌──────────────────────────────────────────────┐
│  VOTRE LOGO          FACTURE N° FA2024-001   │
│                                              │
│  Votre Société              Date: 15/01/2024│
│  123 Rue Example           Échéance: 15/02  │
│  SIRET: 12345678900012                       │
│                                              │
│  Facturé à :                                 │
│  Entreprise ABC                              │
│  123 Rue Example                             │
│  SIRET: 12345678900012                       │
│                                              │
├──────────────────────────────────────────────┤
│  Désignation        │ Qté │ P.U. │  Total   │
│  ──────────────────────────────────────────  │
│  Prestation conseil │  10 │ 500€ │ 5 000€   │
│                                              │
│                          Sous-total: 5 000€  │
│                          TVA 20%:    1 000€  │
│                          ───────────────────  │
│                          TOTAL TTC:  6 000€  │
│                                              │
│  Conditions : Paiement à 30 jours            │
└──────────────────────────────────────────────┘
```

**Features facturation :**
- ✓ Création factures/devis
- ✓ Gestion clients
- ✓ Numérotation automatique
- ✓ Calcul TVA automatique
- ✓ Génération PDF
- ✓ Envoi par email
- ✓ Suivi paiements

---

### Phase 2 - Automatisation & Intelligence

#### 1. Import & Catégorisation Bancaire

**Import relevé bancaire :**
```javascript
// Parser CSV/OFX/QIF
async function importBankStatement(file) {
    const transactions = await parseBankFile(file);
    
    // Catégorisation IA pour chaque transaction
    for (const transaction of transactions) {
        const category = await categorizeTransaction(transaction);
        transaction.suggestedAccount = category.account;
        transaction.confidence = category.confidence;
    }
    
    return transactions;
}

// Catégorisation avec Azure OpenAI
async function categorizeTransaction(transaction) {
    const prompt = `
    Analyse cette transaction bancaire et suggère le compte comptable approprié :
    
    Libellé : ${transaction.description}
    Montant : ${transaction.amount}
    Date : ${transaction.date}
    
    Historique similaire :
    ${getHistoricalMatches(transaction.description)}
    
    Réponds avec le numéro de compte et ta confiance (0-100%).
    `;
    
    const result = await callAzureOpenAI(prompt);
    return {
        account: result.accountNumber,
        confidence: result.confidence,
        reason: result.explanation
    };
}
```

**Interface d'import :**
```
┌────────────────────────────────────────────┐
│  📥 Import Relevé Bancaire                 │
├────────────────────────────────────────────┤
│  Compte: [512000 - Banque BNP ▼]          │
│  Fichier: [Parcourir...] releve_01_2024.csv│
│                                            │
│  ✓ 45 transactions importées               │
│                                            │
│  Transaction         │ Compte   │ Confiance│
│  ─────────────────────────────────────────│
│  EDF Électricité    │ 606100   │ 95% ✓   │
│  Salaire employé    │ 641100   │ 98% ✓   │
│  Client ABC         │ 411000   │ 92% ✓   │
│  Amazon Business    │ 606400   │ 75% ⚠   │ ← À vérifier
│                                            │
│  [Valider tout] [Revoir les ⚠]            │
└────────────────────────────────────────────┘
```

#### 2. Rapprochement Bancaire Automatique

**Algorithme de matching :**
```javascript
async function reconcileBankStatement(bankTransactions, accountingEntries) {
    const matches = [];
    
    for (const bankTx of bankTransactions) {
        // Chercher correspondances exactes
        let match = findExactMatch(bankTx, accountingEntries);
        
        if (!match) {
            // IA pour matching intelligent
            match = await findAIMatch(bankTx, accountingEntries);
        }
        
        matches.push({
            bankTransaction: bankTx,
            accountingEntry: match.entry,
            confidence: match.confidence,
            difference: match.difference
        });
    }
    
    return matches;
}
```

**Visualisation :**
```
┌──────────────────────────────────────────────────────┐
│  🔄 Rapprochement Bancaire - Janvier 2024            │
├──────────────────────────────────────────────────────┤
│  Solde initial:       10 000 €                       │
│  Mouvements banque:   45 transactions                │
│  Écritures comptables: 43 écritures                  │
│                                                      │
│  ✓ Rapprochées automatiquement: 40 (93%)            │
│  ⚠ À vérifier: 3                                     │
│  ✗ Non rapprochées: 2                                │
│                                                      │
│  Banque              │ Comptabilité      │ Action   │
│  ───────────────────────────────────────────────────│
│  01/01 EDF -150€    │ 01/01 EDF -150€   │ ✓ OK     │
│  05/01 Client +1200€│ 05/01 Client +1200│ ✓ OK     │
│  10/01 Amazon -89€  │ [Aucune]          │ [Créer] │
│  15/01 Salaire -2500│ 15/01 Salaire -2485│ ⚠ Écart│
│                                                      │
│  Solde final banque:     8 461 €                     │
│  Solde final comptable:  8 476 €                     │
│  Différence:              15 € ⚠                      │
└──────────────────────────────────────────────────────┘
```

#### 3. Facturation Avancée

**Facturation récurrente :**
```javascript
const recurringInvoice = {
    id: 'rec_inv_789',
    templateId: 'inv_template_1',
    client: 'client_123',
    frequency: 'monthly', // monthly, quarterly, yearly
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    nextInvoiceDate: '2024-02-01',
    autoSend: true,
    items: [...],
    
    // Génération automatique
    generated: [
        { date: '2024-01-01', invoiceId: 'FA2024-001', status: 'paid' },
        { date: '2024-02-01', invoiceId: 'FA2024-015', status: 'sent' }
    ]
};
```

**Relances automatiques :**
```javascript
const reminderRules = [
    { daysOverdue: 7, action: 'send_email', template: 'reminder_gentle' },
    { daysOverdue: 15, action: 'send_email', template: 'reminder_firm' },
    { daysOverdue: 30, action: 'send_email_and_notify', template: 'reminder_final' },
    { daysOverdue: 45, action: 'mark_as_dispute', notify: ['manager'] }
];

async function processOverdueInvoices() {
    const overdueInvoices = await getOverdueInvoices();
    
    for (const invoice of overdueInvoices) {
        const daysOverdue = getDaysOverdue(invoice);
        const rule = reminderRules.find(r => r.daysOverdue === daysOverdue);
        
        if (rule) {
            await executeReminderAction(invoice, rule);
            console.log(`Relance envoyée pour facture ${invoice.number}`);
        }
    }
}
```

---

### Phase 3 - Trésorerie & Analytics

#### 1. Prévisions de Trésorerie

**Modèle prédictif :**
```javascript
async function forecastCashFlow(months = 3) {
    const historical = await getHistoricalData(12); // 12 mois d'historique
    const pending = await getPendingInvoices();
    const recurring = await getRecurringPayments();
    
    const prompt = `
    Prévois la trésorerie pour les ${months} prochains mois.
    
    Historique (12 mois) :
    ${JSON.stringify(historical)}
    
    Factures en attente :
    ${JSON.stringify(pending)}
    
    Paiements récurrents :
    ${JSON.stringify(recurring)}
    
    Analyse les tendances saisonnières, les délais de paiement moyens,
    et les événements ponctuels pour fournir une prévision réaliste.
    `;
    
    const forecast = await callAzureOpenAI(prompt);
    return forecast;
}
```

**Dashboard trésorerie :**
```
┌────────────────────────────────────────────────────┐
│  💰 Trésorerie - Prévisions 3 mois                │
├────────────────────────────────────────────────────┤
│  Solde actuel: 25 000 €                           │
│                                                    │
│  Graphique:                                        │
│  30k │                    ╱──╮                     │
│  25k │──────╮        ╱───╯    ╰─╮                 │
│  20k │       ╰──────╯            ╰───             │
│  15k │                                             │
│       Jan    Fév    Mar    Avr    Mai              │
│                                                    │
│  Alertes :                                         │
│  ⚠ Risque découvert mi-mars (-2 500€)             │
│  💡 Suggestion: décaler paiement fournisseur X     │
│                                                    │
│  Prévisions :                                      │
│  Février:  23 500€ ▼ (-1 500€)                    │
│  Mars:     19 800€ ▼ (-3 700€)                    │
│  Avril:    26 300€ ▲ (+6 500€)                    │
└────────────────────────────────────────────────────┘
```

#### 2. Analytics Financier

**KPIs automatiques :**
```javascript
const financialKPIs = {
    revenue: {
        current: 150000,
        previous: 135000,
        growth: 11.1, // %
        target: 160000
    },
    
    margin: {
        gross: 45.5, // %
        net: 12.3,
        operating: 18.7
    },
    
    cashflow: {
        operating: 28000,
        investing: -15000,
        financing: 0,
        net: 13000
    },
    
    ratios: {
        current: 2.3, // Actif circulant / Passif circulant
        quick: 1.8,   // (AC - Stock) / PC
        debt: 0.45,   // Dette / Capitaux propres
        roe: 15.2     // Return on Equity %
    },
    
    collections: {
        dso: 42, // Days Sales Outstanding
        overdueAmount: 15000,
        overdueCount: 5
    }
};
```

**Dashboard Analytics :**
```
┌────────────────────────────────────────────────────┐
│  📊 Tableau de Bord Financier                     │
├────────────────────────────────────────────────────┤
│  Chiffre d'Affaires                               │
│  150 000€ (+11.1% vs N-1) 🔄 94% de l'objectif   │
│  ████████████████████░░ 150k/160k                 │
│                                                    │
│  Marges                                            │
│  Brute: 45.5%  │  Exploitation: 18.7%  │  Nette: 12.3%│
│                                                    │
│  Trésorerie                                        │
│  Exploitation: +28k  │  Invest: -15k  │  Net: +13k│
│                                                    │
│  Top 5 Clients (CA)          │  Top 5 Dépenses    │
│  1. Client A    35k ████████ │  1. Salaires  45k  │
│  2. Client B    28k ██████   │  2. Loyer     8k   │
│  3. Client C    22k █████    │  3. Marketing 6k   │
│                                                    │
│  ⚠ Alertes :                                       │
│  • 5 factures en retard (15 000€)                 │
│  • Marge en baisse sur projet X                   │
│  • Découvert prévu dans 45 jours                  │
└────────────────────────────────────────────────────┘
```

---

### Phase 4 - Conformité & Déclarations

#### 1. TVA Automatique

**Calcul et déclaration :**
```javascript
async function generateVATDeclaration(period) {
    // Récupérer toutes les opérations de la période
    const sales = await getSalesWithVAT(period);
    const purchases = await getPurchasesWithVAT(period);
    
    const declaration = {
        period: period,
        
        // TVA collectée (sur ventes)
        vatCollected: {
            rate20: calculateVAT(sales, 20),
            rate10: calculateVAT(sales, 10),
            rate5_5: calculateVAT(sales, 5.5),
            total: 0
        },
        
        // TVA déductible (sur achats)
        vatDeductible: {
            goods: calculateVAT(purchases.goods, 'all'),
            services: calculateVAT(purchases.services, 'all'),
            immobilizations: calculateVAT(purchases.immobilizations, 'all'),
            total: 0
        },
        
        // TVA nette à payer (ou crédit)
        vatDue: 0
    };
    
    declaration.vatCollected.total = 
        declaration.vatCollected.rate20 +
        declaration.vatCollected.rate10 +
        declaration.vatCollected.rate5_5;
    
    declaration.vatDeductible.total =
        declaration.vatDeductible.goods +
        declaration.vatDeductible.services +
        declaration.vatDeductible.immobilizations;
    
    declaration.vatDue = 
        declaration.vatCollected.total -
        declaration.vatDeductible.total;
    
    return declaration;
}
```

**Interface déclaration :**
```
┌────────────────────────────────────────────────┐
│  📄 Déclaration TVA - T1 2024                  │
├────────────────────────────────────────────────┤
│  Période : 01/01/2024 - 31/03/2024            │
│                                                │
│  TVA COLLECTÉE                                 │
│  Ventes taux 20%     125 000€  →  25 000€     │
│  Ventes taux 10%      15 000€  →   1 500€     │
│  Ventes taux 5.5%      8 000€  →     440€     │
│  ────────────────────────────────────────     │
│  Total TVA collectée                26 940€   │
│                                                │
│  TVA DÉDUCTIBLE                                │
│  Achats biens        45 000€  →   9 000€     │
│  Services            12 000€  →   2 400€     │
│  Immobilisations      5 000€  →   1 000€     │
│  ────────────────────────────────────────     │
│  Total TVA déductible               12 400€   │
│                                                │
│  ════════════════════════════════════════     │
│  TVA À PAYER                        14 540€   │
│                                                │
│  [Télécharger PDF] [Valider] [Déclarer en ligne]│
└────────────────────────────────────────────────┘
```

#### 2. Export Comptable (FEC)

**Fichier des Écritures Comptables :**
```javascript
async function generateFEC(year) {
    const entries = await getAllEntries(year);
    
    // Format FEC (pipe-separated)
    const fecLines = entries.flatMap(entry => 
        entry.lines.map(line => ({
            JournalCode: entry.journal,
            JournalLib: getJournalName(entry.journal),
            EcritureNum: entry.id,
            EcritureDate: formatDate(entry.date, 'YYYYMMDD'),
            CompteNum: line.account,
            CompteLib: getAccountName(line.account),
            CompAuxNum: line.auxiliaryAccount || '',
            CompAuxLib: line.auxiliaryName || '',
            PieceRef: entry.reference,
            PieceDate: formatDate(entry.date, 'YYYYMMDD'),
            EcritureLib: line.label,
            Debit: line.debit.toFixed(2),
            Credit: line.credit.toFixed(2),
            EcritureLet: line.lettrage || '',
            DateLet: line.dateLettrage || '',
            ValidDate: formatDate(entry.validatedAt, 'YYYYMMDD'),
            Montantdevise: '',
            Idevise: ''
        }))
    );
    
    // Générer fichier texte
    const fecContent = fecLines
        .map(line => Object.values(line).join('|'))
        .join('\n');
    
    return fecContent;
}
```

---

### Phase 5 - Intégrations Avancées

#### 1. Open Banking

**Connexion bancaire automatique :**
```javascript
// Via API Open Banking (PSD2)
async function connectBankAccount(bankId, credentials) {
    const connection = await openBankingAPI.connect({
        bank: bankId,
        credentials: credentials,
        consent: ['accounts', 'transactions']
    });
    
    // Synchronisation quotidienne automatique
    scheduleSync(connection, 'daily');
    
    return connection;
}

// Récupération transactions temps réel
async function syncBankTransactions(connectionId) {
    const transactions = await openBankingAPI.getTransactions(connectionId);
    
    for (const tx of transactions) {
        // Catégorisation IA
        const category = await categorizeTransaction(tx);
        
        // Création écriture comptable automatique
        await createAccountingEntry({
            date: tx.date,
            journal: 'BQ',
            reference: tx.id,
            description: tx.description,
            lines: [
                { account: '512000', debit: tx.amount > 0 ? tx.amount : 0 },
                { account: category.account, credit: tx.amount > 0 ? tx.amount : 0 }
            ]
        });
    }
}
```

#### 2. OCR pour Factures

**Scan et extraction :**
```javascript
async function scanInvoice(file) {
    // Utiliser Azure Computer Vision
    const ocrResult = await azureComputerVision.analyzeDocument(file);
    
    // Extraction des champs avec IA
    const extractedData = await extractInvoiceData(ocrResult);
    
    return {
        supplier: extractedData.supplier,
        invoiceNumber: extractedData.number,
        date: extractedData.date,
        dueDate: extractedData.dueDate,
        amount: extractedData.total,
        vat: extractedData.vat,
        items: extractedData.lineItems,
        confidence: extractedData.confidence
    };
}

// Validation et création automatique
async function processScannedInvoice(scanResult) {
    if (scanResult.confidence > 0.9) {
        // Haute confiance → création automatique
        await createSupplierInvoice(scanResult);
        notify('Facture créée automatiquement');
    } else {
        // Basse confiance → validation manuelle
        showValidationForm(scanResult);
    }
}
```

#### 3. Intégration E-commerce

**Synchronisation Shopify/WooCommerce :**
```javascript
async function syncEcommerceSales() {
    // Récupérer commandes depuis Shopify
    const orders = await shopify.getOrders({ 
        status: 'paid',
        since: lastSyncDate 
    });
    
    for (const order of orders) {
        // Créer facture automatiquement
        const invoice = await createInvoiceFromOrder(order);
        
        // Créer écriture comptable
        await createAccountingEntry({
            date: order.paidAt,
            journal: 'VT',
            reference: invoice.number,
            description: `Vente e-commerce #${order.id}`,
            lines: [
                { account: '411000', debit: order.total },
                { account: '707000', credit: order.subtotal },
                { account: '445710', credit: order.vat },
                { account: '624100', debit: order.shippingCost }
            ]
        });
    }
}
```

---

## Commandes AI Avancées

### Exemples d'interactions

```javascript
const aiFinanceCommands = {
    'catégorise cette transaction': async (transaction) => {
        const category = await categorizeTransaction(transaction);
        return `Suggéré: ${category.account} (${category.confidence}% confiance)`;
    },
    
    'prévois ma trésorerie 3 mois': async () => {
        const forecast = await forecastCashFlow(3);
        displayCashFlowForecast(forecast);
    },
    
    'analyse ma rentabilité par client': async () => {
        const analysis = await analyzeClientProfitability();
        return generateProfitabilityReport(analysis);
    },
    
    'génère ma déclaration TVA': async () => {
        const declaration = await generateVATDeclaration(currentQuarter);
        return displayVATDeclaration(declaration);
    },
    
    'optimise mes délais de paiement': async () => {
        const optimization = await optimizePaymentTerms();
        return `Économies potentielles: ${optimization.savings}€/an`;
    },
    
    'détecte les erreurs comptables': async () => {
        const errors = await detectAccountingErrors();
        return displayErrorReport(errors);
    }
};
```

---

## Timeline de Développement

### Sprint 1-2 (4 semaines) - MVP Comptabilité
- [ ] Plan comptable standard + personnalisation
- [ ] Saisie manuelle écritures
- [ ] Journaux multiples
- [ ] Balance comptable
- [ ] Grand livre
- [ ] Export Excel/PDF

### Sprint 3-4 (4 semaines) - Facturation
- [ ] Gestion clients/fournisseurs
- [ ] Création factures/devis
- [ ] Génération PDF professionnelle
- [ ] Envoi email
- [ ] Suivi paiements
- [ ] Dashboard factures

### Sprint 5-6 (4 semaines) - Automatisation
- [ ] Import relevés bancaires
- [ ] Catégorisation IA
- [ ] Rapprochement bancaire auto
- [ ] Facturation récurrente
- [ ] Relances automatiques

### Sprint 7-8 (4 semaines) - Analytics & Trésorerie
- [ ] Dashboard financier
- [ ] KPIs et ratios
- [ ] Prévisions trésorerie IA
- [ ] Alertes intelligentes
- [ ] Rapports personnalisables

### Sprint 9-10 (4 semaines) - Conformité
- [ ] Déclaration TVA automatique
- [ ] Export FEC
- [ ] Liasse fiscale assistée
- [ ] Archivage légal
- [ ] Audit trail

### Sprint 11-12 (4 semaines) - Intégrations
- [ ] Open Banking
- [ ] OCR factures
- [ ] Export vers logiciels comptables
- [ ] API publique
- [ ] Webhooks

---

## Checklist de Migration

### Phase actuelle : Wrapper ✅
- [x] Créer `/public/js/finance-module.js`
- [x] Ajouter `loadFinanceModule()` dans index.html
- [x] Restaurer bouton sidebar "AI Finance & Compta"
- [x] Documenter dans DEVELOPPEMENT_MODULAIRE.md

### Phase future : Module complet
- [ ] Extraire code de `openFinanceAI()` (index.html ligne 14201)
- [ ] Créer structure modulaire complète
- [ ] Implémenter MVP comptabilité
- [ ] Tests et validation
- [ ] Migration progressive

---

## Technologies & Libraries

### Recommandations

**Comptabilité :**
- **Decimal.js** : Calculs financiers précis (éviter erreurs de virgule flottante)
- **date-fns** : Manipulation dates période comptable

**Facturation :**
- **jsPDF** : Génération PDF factures
- **pdf-lib** : Manipulation PDF avancée
- **QRCode.js** : QR codes sur factures

**Import/Export :**
- **Papa Parse** : Parser CSV relevés bancaires
- **XLSX.js** : Export Excel
- **xml2js** : Parser OFX/QIF

**Graphiques :**
- **Chart.js** : Graphiques financiers
- **ApexCharts** : Graphiques interactifs avancés

**OCR :**
- **Azure Computer Vision** : Extraction données factures
- **Tesseract.js** : OCR local (fallback)

---

## Support & Documentation

Pour développer le module Finance :
1. Consulter ce guide
2. Voir `DEVELOPPEMENT_MODULAIRE.md` pour l'architecture
3. Tester le wrapper : cliquer sur "AI Finance & Compta" dans la sidebar

**Prêt à révolutionner la gestion financière ! 💰**

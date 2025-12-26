# Finance Module - Phase 2 : Implémentation

## 📅 Planning (4-6 semaines)

### Sprint 1-2 (2 semaines) : Import Relevés Bancaires
- [ ] Parser CSV (formats standards : Revolut, N26, BNP, etc.)
- [ ] Parser OFX/QFX (Quicken Financial Exchange)
- [ ] OCR PDF relevés bancaires
- [ ] Normalisation données → format unifié
- [ ] API `/api/finance/bank-statements/import`
- [ ] Interface upload + mapping colonnes

### Sprint 3 (1 semaine) : Rapprochement Bancaire
- [ ] Algorithme matching intelligent (montant + date + fournisseur)
- [ ] Règles de rapprochement configurables
- [ ] API `/api/finance/reconciliation/match`
- [ ] Interface suggestions + validation manuelle
- [ ] Export résultats (PDF, Excel)

### Sprint 4 (1 semaine) : Déclaration TVA
- [ ] Calcul automatique TVA (6%, 13%, 23% Portugal, configurable)
- [ ] Génération formulaires (PDF prérempli)
- [ ] API `/api/finance/vat/calculate` et `/api/finance/vat/generate-form`
- [ ] Interface récapitulatif TVA période
- [ ] Export XML pour télédéclaration

### Sprint 5-6 (2 semaines) : Open Banking
- [ ] Intégration API Plaid / TrueLayer / GoCardless
- [ ] OAuth2 connexion banques
- [ ] Synchronisation transactions temps réel
- [ ] API `/api/finance/open-banking/connect` et `/sync`
- [ ] Interface gestion connexions bancaires
- [ ] Webhooks notifications nouvelles transactions

---

## 🏗️ Architecture Technique

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (index.html)                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  Import CSV  │ │ Rapprochement│ │ Déclaration  │        │
│  │  OFX, PDF    │ │   Bancaire   │ │     TVA      │        │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘        │
│         │                │                │                 │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                   AZURE FUNCTIONS (API)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ /api/finance/bank-statements/import                  │   │
│  │   - Parse CSV (Revolut, N26, BNP, etc.)              │   │
│  │   - Parse OFX/QFX                                     │   │
│  │   - OCR PDF relevés                                   │   │
│  │   - Normalisation → format unifié                     │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ /api/finance/reconciliation/match                    │   │
│  │   - Matching intelligent (montant, date, vendeur)    │   │
│  │   - Règles configurables                             │   │
│  │   - Score de confiance                               │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ /api/finance/vat/calculate                           │   │
│  │   - Calcul TVA collectée/déductible                  │   │
│  │   - Par période (mensuel, trimestriel)               │   │
│  │   - Support multi-taux (6%, 13%, 23%)                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ /api/finance/vat/generate-form                       │   │
│  │   - Génération PDF formulaire TVA                    │   │
│  │   - Export XML télédéclaration                       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ /api/finance/open-banking/connect                    │   │
│  │   - OAuth2 banques (via Plaid/TrueLayer)             │   │
│  │   - Liste comptes bancaires                          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ /api/finance/open-banking/sync                       │   │
│  │   - Récupération transactions                        │   │
│  │   - Synchronisation automatique                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                   SERVICES EXTERNES                         │
│  • Azure Form Recognizer (OCR PDF relevés)                  │
│  • Azure Blob Storage (Stockage documents)                  │
│  • Plaid API / TrueLayer (Open Banking)                     │
│  • Groq/Llama 3.3 70B (IA matching)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Structure Fichiers à Créer

```
/workspaces/algeria/
├── api/
│   ├── finance-bank-statements-import/
│   │   └── index.js                    # Parser CSV, OFX, PDF
│   ├── finance-reconciliation-match/
│   │   └── index.js                    # Rapprochement bancaire
│   ├── finance-vat-calculate/
│   │   └── index.js                    # Calcul TVA
│   ├── finance-vat-generate-form/
│   │   └── index.js                    # Génération formulaires
│   ├── finance-open-banking-connect/
│   │   └── index.js                    # Connexion banques
│   └── finance-open-banking-sync/
│       └── index.js                    # Sync transactions
├── public/
│   └── index.html                      # Interface Finance Phase 2
└── FINANCE_PHASE2_IMPLEMENTATION.md    # Ce document
```

---

## 🛠️ 1. Import Relevés Bancaires

### API Backend : `/api/finance-bank-statements-import/index.js`

```javascript
const { uploadBuffer } = require('../utils/storage');
const fetch = require('node-fetch');

// Formats supportés
const PARSERS = {
  csv: parseCSV,
  ofx: parseOFX,
  pdf: parsePDFStatement
};

module.exports = async function (context, req) {
  try {
    const { contentBase64, format, bankName } = req.body;
    
    if (!contentBase64 || !format) {
      context.res = { status: 400, body: { error: 'contentBase64 et format requis' } };
      return;
    }

    const parser = PARSERS[format.toLowerCase()];
    if (!parser) {
      context.res = { status: 400, body: { error: `Format ${format} non supporté` } };
      return;
    }

    // Parse le document
    const transactions = await parser(contentBase64, bankName, context);

    // Normalisation format unifié
    const normalized = transactions.map(t => ({
      date: t.date,
      description: t.description || t.label || '',
      amount: parseFloat(t.amount),
      currency: t.currency || 'EUR',
      type: t.amount > 0 ? 'credit' : 'debit',
      category: t.category || 'uncategorized',
      vendor: extractVendor(t.description),
      reference: t.reference || '',
      balance: t.balance || null
    }));

    // Stockage dans Blob pour archivage
    const buffer = Buffer.from(contentBase64, 'base64');
    const filename = `bank-statement-${Date.now()}.${format}`;
    const storedUrl = await uploadBuffer('bank-statements', filename, buffer, getMimeType(format));

    context.res = {
      status: 200,
      body: {
        transactions: normalized,
        count: normalized.length,
        totalCredit: normalized.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
        totalDebit: normalized.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
        storedUrl,
        format,
        bankName
      }
    };
  } catch (err) {
    context.log('[Bank Import Error]', err);
    context.res = { status: 500, body: { error: err.message } };
  }
};

// Parser CSV (Revolut, N26, BNP, etc.)
async function parseCSV(contentBase64, bankName, context) {
  const csvText = Buffer.from(contentBase64, 'base64').toString('utf-8');
  const lines = csvText.split('\n').filter(line => line.trim());
  
  // Détection automatique des colonnes selon la banque
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx]; });

    // Mapping selon format banque
    const transaction = mapBankFormat(row, bankName);
    if (transaction) transactions.push(transaction);
  }

  return transactions;
}

// Parser OFX/QFX (Quicken Financial Exchange)
async function parseOFX(contentBase64, bankName, context) {
  const ofxText = Buffer.from(contentBase64, 'base64').toString('utf-8');
  const transactions = [];

  // Extraction transactions OFX (format XML-like)
  const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;

  while ((match = regex.exec(ofxText)) !== null) {
    const trn = match[1];
    const trnType = (trn.match(/<TRNTYPE>(.*?)</)?.[1] || '').trim();
    const dtposted = (trn.match(/<DTPOSTED>(.*?)</)?.[1] || '').trim();
    const trnamt = (trn.match(/<TRNAMT>(.*?)</)?.[1] || '').trim();
    const fitid = (trn.match(/<FITID>(.*?)</)?.[1] || '').trim();
    const name = (trn.match(/<NAME>(.*?)</)?.[1] || '').trim();
    const memo = (trn.match(/<MEMO>(.*?)</)?.[1] || '').trim();

    transactions.push({
      date: formatOFXDate(dtposted),
      description: name || memo || 'Transaction',
      amount: parseFloat(trnamt),
      reference: fitid,
      type: trnType
    });
  }

  return transactions;
}

// Parser PDF via OCR Azure
async function parsePDFStatement(contentBase64, bankName, context) {
  const endpoint = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
  const apiKey = process.env.AZURE_FORM_RECOGNIZER_KEY;

  if (!endpoint || !apiKey) {
    throw new Error('Azure Form Recognizer non configuré');
  }

  // Utiliser le modèle prebuilt-receipt ou custom pour relevés bancaires
  const analyzeUrl = `${endpoint}/formrecognizer/documentModels/prebuilt-receipt:analyze?api-version=2023-07-31`;
  
  const response = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/octet-stream'
    },
    body: Buffer.from(contentBase64, 'base64')
  });

  if (!response.ok) {
    throw new Error(`OCR failed: ${response.status}`);
  }

  const opLocation = response.headers.get('operation-location');
  
  // Polling résultat
  let result = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const r = await fetch(opLocation, { headers: { 'Ocp-Apim-Subscription-Key': apiKey } });
    const data = await r.json();
    if (data.status === 'succeeded') { result = data; break; }
    if (data.status === 'failed') break;
  }

  if (!result) {
    throw new Error('OCR timeout');
  }

  // Extraction transactions du texte OCR
  const fullText = extractTextFromOCR(result);
  return parseTransactionsFromText(fullText);
}

// Helpers
function mapBankFormat(row, bankName) {
  // Mapping spécifique par banque
  const mappings = {
    revolut: { date: 'started date', description: 'description', amount: 'amount', currency: 'currency' },
    n26: { date: 'date', description: 'payee', amount: 'amount', currency: 'transaction currency' },
    bnp: { date: 'date', description: 'libelle', amount: 'montant', currency: 'devise' }
  };

  const map = mappings[bankName?.toLowerCase()] || mappings.revolut;
  
  return {
    date: row[map.date],
    description: row[map.description],
    amount: parseFloat(row[map.amount]?.replace(',', '.')),
    currency: row[map.currency] || 'EUR',
    balance: row.balance ? parseFloat(row.balance.replace(',', '.')) : null
  };
}

function extractVendor(description) {
  // Extraction intelligente du nom du fournisseur
  const cleaned = description.replace(/\d{2}\/\d{2}\/\d{4}/g, '').replace(/\d+\.\d+/g, '').trim();
  return cleaned.split(/[\-\*]/)[0].trim();
}

function formatOFXDate(ofxDate) {
  // OFX: 20250115120000 → 2025-01-15
  if (!ofxDate || ofxDate.length < 8) return null;
  const year = ofxDate.substring(0, 4);
  const month = ofxDate.substring(4, 6);
  const day = ofxDate.substring(6, 8);
  return `${year}-${month}-${day}`;
}

function getMimeType(format) {
  const types = { csv: 'text/csv', ofx: 'application/x-ofx', pdf: 'application/pdf' };
  return types[format] || 'application/octet-stream';
}

function extractTextFromOCR(result) {
  const pages = result.analyzeResult?.pages || [];
  return pages.map(p => (p.lines || []).map(l => l.content).join('\n')).join('\n\n');
}

function parseTransactionsFromText(text) {
  // Regex pour détecter transactions dans texte brut
  const lines = text.split('\n');
  const transactions = [];
  
  // Pattern: 15/01/2025 VIREMENT 150.00 EUR
  const pattern = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\-\+]?\d+[,\.]\d{2})\s*(EUR|USD|GBP)?/g;
  
  for (const line of lines) {
    const match = pattern.exec(line);
    if (match) {
      transactions.push({
        date: match[1].split('/').reverse().join('-'),
        description: match[2].trim(),
        amount: parseFloat(match[3].replace(',', '.')),
        currency: match[4] || 'EUR'
      });
    }
  }
  
  return transactions;
}
```

---

## 🤝 2. Rapprochement Bancaire Automatique

### API Backend : `/api/finance-reconciliation-match/index.js`

```javascript
module.exports = async function (context, req) {
  try {
    const { bankTransactions, invoices } = req.body;

    if (!Array.isArray(bankTransactions) || !Array.isArray(invoices)) {
      context.res = { status: 400, body: { error: 'bankTransactions et invoices requis (arrays)' } };
      return;
    }

    const matches = [];
    const unmatched = { bank: [], invoices: [] };

    // Algorithme de matching
    for (const bankTrx of bankTransactions) {
      let bestMatch = null;
      let bestScore = 0;

      for (const invoice of invoices) {
        const score = calculateMatchScore(bankTrx, invoice);
        if (score > bestScore && score >= 0.7) { // Seuil 70%
          bestScore = score;
          bestMatch = invoice;
        }
      }

      if (bestMatch) {
        matches.push({
          bankTransaction: bankTrx,
          invoice: bestMatch,
          confidence: bestScore,
          matchType: getMatchType(bestScore)
        });
        // Retirer l'invoice matchée
        invoices.splice(invoices.indexOf(bestMatch), 1);
      } else {
        unmatched.bank.push(bankTrx);
      }
    }

    // Invoices non matchées
    unmatched.invoices = invoices;

    context.res = {
      status: 200,
      body: {
        matches,
        matchedCount: matches.length,
        unmatchedBankCount: unmatched.bank.length,
        unmatchedInvoiceCount: unmatched.invoices.length,
        unmatched,
        summary: {
          totalBankTransactions: bankTransactions.length,
          totalInvoices: req.body.invoices.length,
          matchRate: (matches.length / Math.max(bankTransactions.length, req.body.invoices.length) * 100).toFixed(1) + '%'
        }
      }
    };
  } catch (err) {
    context.log('[Reconciliation Error]', err);
    context.res = { status: 500, body: { error: err.message } };
  }
};

function calculateMatchScore(bankTrx, invoice) {
  let score = 0;

  // 1. Matching montant (40%)
  const amountMatch = Math.abs(Math.abs(bankTrx.amount) - Math.abs(invoice.amount)) < 0.01;
  if (amountMatch) score += 0.4;

  // 2. Matching date (30%) - tolérance ±7 jours
  const bankDate = new Date(bankTrx.date);
  const invoiceDate = new Date(invoice.date || invoice.dueDate);
  const daysDiff = Math.abs((bankDate - invoiceDate) / (1000 * 60 * 60 * 24));
  if (daysDiff <= 7) score += 0.3 * (1 - daysDiff / 7);

  // 3. Matching fournisseur/description (30%)
  const bankDesc = (bankTrx.description || '').toLowerCase();
  const invoiceVendor = (invoice.vendor || '').toLowerCase();
  const similarity = stringSimilarity(bankDesc, invoiceVendor);
  score += 0.3 * similarity;

  return score;
}

function stringSimilarity(str1, str2) {
  // Algorithme Levenshtein simplifié
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

function getMatchType(score) {
  if (score >= 0.9) return 'exact';
  if (score >= 0.7) return 'probable';
  return 'possible';
}
```

---

## 💶 3. Déclaration TVA Automatique

### API Backend : `/api/finance-vat-calculate/index.js`

```javascript
module.exports = async function (context, req) {
  try {
    const { invoices, period, country } = req.body;

    if (!Array.isArray(invoices)) {
      context.res = { status: 400, body: { error: 'invoices array requis' } };
      return;
    }

    // Taux TVA par pays
    const vatRates = {
      PT: { standard: 0.23, intermediate: 0.13, reduced: 0.06 },
      FR: { standard: 0.20, intermediate: 0.10, reduced: 0.055 },
      ES: { standard: 0.21, intermediate: 0.10, reduced: 0.04 }
    };

    const rates = vatRates[country || 'PT'] || vatRates.PT;

    let totalSales = 0;
    let totalPurchases = 0;
    let vatCollected = 0; // TVA collectée (ventes)
    let vatDeductible = 0; // TVA déductible (achats)

    const breakdown = {
      sales: { standard: 0, intermediate: 0, reduced: 0 },
      purchases: { standard: 0, intermediate: 0, reduced: 0 }
    };

    for (const inv of invoices) {
      const amount = parseFloat(inv.amount) || 0;
      const vatRate = inv.vatRate || rates.standard;
      const type = inv.type || 'sale'; // 'sale' ou 'purchase'

      const baseAmount = amount / (1 + vatRate);
      const vatAmount = amount - baseAmount;

      if (type === 'sale') {
        totalSales += amount;
        vatCollected += vatAmount;
        
        if (vatRate === rates.standard) breakdown.sales.standard += amount;
        else if (vatRate === rates.intermediate) breakdown.sales.intermediate += amount;
        else breakdown.sales.reduced += amount;
      } else {
        totalPurchases += amount;
        vatDeductible += vatAmount;
        
        if (vatRate === rates.standard) breakdown.purchases.standard += amount;
        else if (vatRate === rates.intermediate) breakdown.purchases.intermediate += amount;
        else breakdown.purchases.reduced += amount;
      }
    }

    const vatDue = vatCollected - vatDeductible;

    context.res = {
      status: 200,
      body: {
        period,
        country,
        summary: {
          totalSales: totalSales.toFixed(2),
          totalPurchases: totalPurchases.toFixed(2),
          vatCollected: vatCollected.toFixed(2),
          vatDeductible: vatDeductible.toFixed(2),
          vatDue: vatDue.toFixed(2),
          status: vatDue > 0 ? 'À payer' : vatDue < 0 ? 'Crédit' : 'Neutre'
        },
        breakdown,
        rates,
        invoiceCount: {
          sales: invoices.filter(i => i.type === 'sale').length,
          purchases: invoices.filter(i => i.type === 'purchase').length
        }
      }
    };
  } catch (err) {
    context.log('[VAT Calc Error]', err);
    context.res = { status: 500, body: { error: err.message } };
  }
};
```

---

## 🏦 4. Open Banking (Plaid Integration)

### API Backend : `/api/finance-open-banking-connect/index.js`

```javascript
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

// Configuration Plaid
const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox, // sandbox, development, production
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

module.exports = async function (context, req) {
  try {
    const { action, publicToken, accessToken } = req.body;

    if (action === 'create_link_token') {
      // Créer un link_token pour l'UI Plaid Link
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: req.body.userId || 'user-' + Date.now() },
        client_name: 'Axilum Finance',
        products: ['transactions', 'auth'],
        country_codes: ['PT', 'FR', 'ES', 'GB'],
        language: 'fr',
        webhook: process.env.PLAID_WEBHOOK_URL
      });

      context.res = {
        status: 200,
        body: { link_token: response.data.link_token }
      };
    }
    else if (action === 'exchange_public_token') {
      // Échanger public_token contre access_token
      const response = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken
      });

      // Sauvegarder access_token (base de données ou Azure Table Storage)
      const accessTokenPersisted = response.data.access_token;

      context.res = {
        status: 200,
        body: {
          access_token: accessTokenPersisted,
          item_id: response.data.item_id,
          message: 'Connexion bancaire réussie'
        }
      };
    }
    else if (action === 'get_accounts') {
      // Récupérer comptes bancaires
      const response = await plaidClient.accountsGet({
        access_token: accessToken
      });

      context.res = {
        status: 200,
        body: {
          accounts: response.data.accounts.map(acc => ({
            id: acc.account_id,
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype,
            balance: acc.balances.current,
            currency: acc.balances.iso_currency_code
          }))
        }
      };
    }
    else {
      context.res = { status: 400, body: { error: 'action invalide' } };
    }
  } catch (err) {
    context.log('[Open Banking Error]', err);
    context.res = { status: 500, body: { error: err.message } };
  }
};
```

### API Backend : `/api/finance-open-banking-sync/index.js`

```javascript
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

module.exports = async function (context, req) {
  try {
    const { accessToken, startDate, endDate } = req.body;

    if (!accessToken) {
      context.res = { status: 400, body: { error: 'accessToken requis' } };
      return;
    }

    // Récupérer transactions
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date: endDate || new Date().toISOString().split('T')[0]
    });

    const transactions = response.data.transactions.map(trx => ({
      id: trx.transaction_id,
      date: trx.date,
      description: trx.name,
      amount: trx.amount,
      currency: trx.iso_currency_code,
      category: trx.category ? trx.category[0] : 'uncategorized',
      merchant: trx.merchant_name || extractVendor(trx.name),
      pending: trx.pending,
      accountId: trx.account_id
    }));

    context.res = {
      status: 200,
      body: {
        transactions,
        count: transactions.length,
        accounts: response.data.accounts.map(acc => ({
          id: acc.account_id,
          name: acc.name,
          balance: acc.balances.current
        }))
      }
    };
  } catch (err) {
    context.log('[Sync Error]', err);
    context.res = { status: 500, body: { error: err.message } };
  }
};

function extractVendor(description) {
  return description.replace(/\d{2}\/\d{2}\/\d{4}/g, '').replace(/\d+\.\d+/g, '').trim().split(/[\-\*]/)[0].trim();
}
```

---

## 🎨 Interface Frontend (Ajout dans index.html)

Ajouter dans la section Finance Hub après les outils existants :

```html
<!-- Nouveau panneau Phase 2 -->
<div class="tool-card" onclick="importBankStatement()">
    <div class="tool-icon" style="background: linear-gradient(135deg, rgba(34,197,94,0.18), rgba(22,163,74,0.18));">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="7" x2="22" y2="7"/>
        </svg>
    </div>
    <div class="tool-name">Import Relevés Bancaires</div>
    <div class="tool-desc">CSV, OFX, PDF • Normalisation automatique</div>
    <div class="coming-badge" style="background:#22c55e">Phase 2</div>
</div>

<div class="tool-card" onclick="runReconciliation()">
    <div class="tool-icon" style="background: linear-gradient(135deg, rgba(139,92,246,0.18), rgba(124,58,237,0.18));">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
    </div>
    <div class="tool-name">Rapprochement Bancaire</div>
    <div class="tool-desc">Matching IA • Validation automatique</div>
    <div class="coming-badge" style="background:#8b5cf6">Phase 2</div>
</div>

<div class="tool-card" onclick="calculateVAT()">
    <div class="tool-icon" style="background: linear-gradient(135deg, rgba(245,158,11,0.18), rgba(217,119,6,0.18));">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/>
        </svg>
    </div>
    <div class="tool-name">Déclaration TVA</div>
    <div class="tool-desc">Calcul auto • Formulaires PDF</div>
    <div class="coming-badge" style="background:#f59e0b">Phase 2</div>
</div>

<div class="tool-card" onclick="connectBank()">
    <div class="tool-icon" style="background: linear-gradient(135deg, rgba(59,130,246,0.18), rgba(37,99,235,0.18));">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
    </div>
    <div class="tool-name">Open Banking</div>
    <div class="tool-desc">Plaid • Sync temps réel</div>
    <div class="coming-badge" style="background:#3b82f6">Phase 2</div>
</div>
```

---

## 📦 Dépendances NPM à Installer

```bash
cd /workspaces/algeria/api
npm install plaid csv-parser xml2js pdfkit
```

---

## ⚙️ Variables d'Environnement

Ajouter dans `/workspaces/algeria/api/.env` :

```bash
# Open Banking (Plaid)
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret_sandbox
PLAID_WEBHOOK_URL=https://yourapp.azurewebsites.net/api/plaid-webhook

# Azure Form Recognizer (déjà configuré)
AZURE_FORM_RECOGNIZER_ENDPOINT=https://axilumdocumentation.cognitiveservices.azure.com
AZURE_FORM_RECOGNIZER_KEY=your_existing_key
```

---

## 🎯 Ordre d'Implémentation Recommandé

1. ✅ **Semaine 1-2** : Import relevés bancaires (CSV, OFX d'abord, PDF après)
2. ✅ **Semaine 3** : Rapprochement bancaire (algorithme + interface)
3. ✅ **Semaine 4** : Calcul TVA + génération formulaires
4. ✅ **Semaine 5-6** : Open Banking (Plaid integration)

---

## 🧪 Tests Unitaires

Créer `/workspaces/algeria/api/finance-bank-statements-import/test.js` :

```javascript
const handler = require('./index');

async function testCSVImport() {
  const csvContent = `Date,Description,Amount,Currency
2025-01-15,Salary,2500.00,EUR
2025-01-16,Rent,-800.00,EUR
2025-01-17,Groceries,-150.50,EUR`;
  
  const base64 = Buffer.from(csvContent).toString('base64');
  
  const context = { log: console.log, res: {} };
  const req = { body: { contentBase64: base64, format: 'csv', bankName: 'revolut' } };
  
  await handler(context, req);
  console.log('Result:', JSON.stringify(context.res, null, 2));
}

testCSVImport();
```

---

## 📚 Documentation API

### Import Relevés
```
POST /api/finance/bank-statements/import
Body: { contentBase64, format: 'csv'|'ofx'|'pdf', bankName }
Response: { transactions[], count, totalCredit, totalDebit, storedUrl }
```

### Rapprochement
```
POST /api/finance/reconciliation/match
Body: { bankTransactions[], invoices[] }
Response: { matches[], unmatched, summary }
```

### TVA
```
POST /api/finance/vat/calculate
Body: { invoices[], period, country }
Response: { summary, breakdown, rates }
```

### Open Banking
```
POST /api/finance/open-banking/connect
Body: { action: 'create_link_token'|'exchange_public_token'|'get_accounts', ... }

POST /api/finance/open-banking/sync
Body: { accessToken, startDate, endDate }
Response: { transactions[], count, accounts[] }
```

---

## 🚀 Prochaines Étapes

1. Créer les APIs (copier le code ci-dessus)
2. Installer dépendances NPM
3. Tester avec CSV simple
4. Ajouter l'interface frontend
5. Configurer Plaid (compte sandbox gratuit)
6. Tester end-to-end

**Voulez-vous que je commence par créer la première API (Import relevés bancaires) ?** 🎯

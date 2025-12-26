const { uploadBuffer } = require('../utils/storage');

/**
 * Détecte si une facture est une CHARGE (dépense) ou un REVENU (bénéfice)
 * Basé sur l'analyse du texte complet de la facture
 */
function detectTransactionType(fullText, vendor, extractedFields) {
  const text = String(fullText || '').toLowerCase();
  const vendorLower = String(vendor || '').toLowerCase();
  
  // Compteurs de mots-clés
  let chargeScore = 0;
  let revenueScore = 0;
  
  // === Indicateurs de CHARGES (Dépenses) ===
  // Mots-clés fréquents sur les factures fournisseurs
  const chargeKeywords = [
    // Termes directs
    'facture', 'invoice', 'bill', 'fournisseur', 'supplier', 'vendor',
    'payer', 'payment due', 'due date', 'échéance', 'à payer',
    // Types d'achats
    'achat', 'purchase', 'fourniture', 'prestation', 'service',
    'matériel', 'equipment', 'material', 'supplies',
    // Frais courants
    'loyer', 'rent', 'électricité', 'electricity', 'eau', 'water',
    'téléphone', 'internet', 'abonnement', 'subscription',
    'salaire', 'salary', 'wages', 'paie', 'payroll',
    'assurance', 'insurance', 'maintenance', 'entretien',
    'transport', 'carburant', 'fuel', 'essence',
    // Mentions spécifiques
    'veuillez payer', 'please pay', 'montant dû', 'amount due',
    'total à payer', 'total due', 'nous facturons'
  ];
  
  // === Indicateurs de REVENUS (Ventes) ===
  // Mots-clés sur les factures émises aux clients
  const revenueKeywords = [
    // Termes directs
    'devis', 'quote', 'quotation', 'proposition commerciale',
    'facture client', 'customer invoice', 'sales invoice',
    'reçu', 'receipt', 'vente', 'sale', 'sold to',
    // Client identifié
    'client', 'customer', 'buyer', 'acheteur',
    'facturé à', 'billed to', 'bill to', 'ship to',
    // Revenus
    'revenu', 'revenue', 'chiffre d\'affaires', 'ca', 'turnover',
    'encaissement', 'collection', 'paiement reçu', 'payment received',
    // Mentions spécifiques
    'merci de votre achat', 'thank you for your purchase',
    'commande', 'order', 'livraison', 'delivery',
    'votre commande', 'your order'
  ];
  
  // Compter les occurrences
  chargeKeywords.forEach(keyword => {
    const count = (text.match(new RegExp(keyword, 'gi')) || []).length;
    chargeScore += count;
  });
  
  revenueKeywords.forEach(keyword => {
    const count = (text.match(new RegExp(keyword, 'gi')) || []).length;
    revenueScore += count;
  });
  
  // === Analyse des champs structurés (si disponibles) ===
  if (extractedFields) {
    // Présence de champ client = probablement une vente
    if (extractedFields.customerName || extractedFields.customerId || 
        extractedFields.billTo || extractedFields.shipTo) {
      revenueScore += 3;
    }
    
    // Présence de champ fournisseur = probablement un achat
    if (extractedFields.vendorName || extractedFields.remittanceAddress) {
      chargeScore += 3;
    }
    
    // Présence de conditions de paiement = souvent achat
    if (extractedFields.paymentTerms || extractedFields.dueDate) {
      chargeScore += 1;
    }
  }
  
  // === Heuristiques supplémentaires ===
  // Nom du fournisseur contient des indicateurs typiques
  const vendorChargeIndicators = ['corp', 'ltd', 'sarl', 'sas', 'inc', 'llc', 'gmbh'];
  if (vendorChargeIndicators.some(ind => vendorLower.includes(ind))) {
    chargeScore += 1;
  }
  
  // Détection de TVA/Tax avec mentions "nous" = charge
  if (text.includes('tva') || text.includes('tax')) {
    if (text.includes('nous vous') || text.includes('veuillez')) {
      chargeScore += 1;
    }
  }
  
  // === Décision finale ===
  // Seuils: besoin d'un minimum de confiance
  const minConfidence = 2;
  
  if (revenueScore >= minConfidence && revenueScore > chargeScore) {
    return {
      type: 'revenue',
      label: 'Revenu (Vente/Encaissement)',
      confidence: revenueScore / (chargeScore + revenueScore),
      scores: { revenue: revenueScore, charge: chargeScore }
    };
  } else if (chargeScore >= minConfidence) {
    return {
      type: 'expense',
      label: 'Charge (Dépense/Achat)',
      confidence: chargeScore / (chargeScore + revenueScore),
      scores: { revenue: revenueScore, charge: chargeScore }
    };
  } else {
    // Par défaut: considérer comme charge (plus sûr pour la comptabilité)
    return {
      type: 'expense',
      label: 'Charge (Dépense/Achat) - par défaut',
      confidence: 0.5,
      scores: { revenue: revenueScore, charge: chargeScore },
      note: 'Classification incertaine - vérification manuelle recommandée'
    };
  }
}

module.exports = async function (context, req) {
  const setCors = () => {
    context.res = context.res || {};
    context.res.headers = Object.assign({}, context.res.headers, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
  };

  const endpoint = (
    process.env.APPSETTING_FORM_RECOGNIZER_ENDPOINT ||
    process.env.FORM_RECOGNIZER_ENDPOINT ||
    process.env.AZURE_FORM_RECOGNIZER_ENDPOINT ||
    // Alias courants configurés côté Azure Web App
    process.env.AZURE_VISION_ENDPOINT ||
    ''
  ).trim();
  const apiKey = (
    process.env.APPSETTING_FORM_RECOGNIZER_KEY ||
    process.env.FORM_RECOGNIZER_KEY ||
    process.env.AZURE_FORM_RECOGNIZER_KEY ||
    // Alias courants configurés côté Azure Web App
    process.env.AZURE_VISION_KEY ||
    ''
  ).trim();

  const hasAzure = !!(endpoint && apiKey);

  // Debug logging
  context.log('[OCR] hasAzure:', hasAzure);
  context.log('[OCR] endpoint:', endpoint ? endpoint.substring(0, 30) + '...' : 'NOT SET');
  context.log('[OCR] apiKey:', apiKey ? 'SET (length: ' + apiKey.length + ')' : 'NOT SET');

  if (req.method === 'OPTIONS') {
    setCors();
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  const fallbackStub = (fileUrl, textContent = null) => {
    const lower = String(fileUrl || '').toLowerCase();
    let vendor = 'Fournisseur Inconnu';
    let amount = null;
    let currency = null;
    let date = null;
    let invoiceNumber = null;

    // Si on a du texte extrait, essayer de parser intelligemment
    if (textContent) {
      const text = String(textContent);
      
      // Recherche fournisseur (premières lignes ou après certains mots-clés)
      const vendorPatterns = [
        /(?:from|de|fournisseur|supplier|vendor)[\s:]+([A-Za-zÀ-ÿ\s&\.]+?)(?:\n|$)/i,
        /^([A-Za-zÀ-ÿ\s&\.]{3,40})$/m // Première ligne non vide
      ];
      for (const pattern of vendorPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          vendor = match[1].trim();
          break;
        }
      }
      
      // Recherche montant avec devise
      const amountPatterns = [
        /(?:total|montant|amount|sum)[\s:]*([€$£]|\b(?:EUR|USD|GBP|DZD|DA)\b)?\s*([0-9]+(?:[,\.][0-9]{2})?)/i,
        /([€$£]|\b(?:EUR|USD|GBP|DZD|DA)\b)\s*([0-9]+(?:[,\.][0-9]{2})?)/i,
        /([0-9]+(?:[,\.][0-9]{2})?)\s*([€$£]|\b(?:EUR|USD|GBP|DZD|DA)\b)/i
      ];
      for (const pattern of amountPatterns) {
        const match = text.match(pattern);
        if (match) {
          const num = match[2] || match[1];
          amount = Number(String(num).replace(/[,\.]/g, '.').replace(/[^\d\.]/g, ''));
          const curr = match[1] || match[3] || match[2];
          if (curr) {
            if (/€|EUR/i.test(curr)) currency = 'EUR';
            else if (/\$|USD/i.test(curr)) currency = 'USD';
            else if (/DZD|DA/i.test(curr)) currency = 'DZD';
            else if (/£|GBP/i.test(curr)) currency = 'GBP';
          }
          break;
        }
      }
      
      // Recherche date
      const datePatterns = [
        /(\d{4}[-\/]\d{2}[-\/]\d{2})/,
        /(\d{2}[-\/]\d{2}[-\/]\d{4})/,
        /(?:date|facture|invoice)[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i
      ];
      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          date = match[1];
          break;
        }
      }
      
      // Recherche numéro de facture
      const invoicePatterns = [
        /(?:invoice|facture|n[°o])[\s:]*([A-Z0-9\-]+)/i,
        /([A-Z]{2,4}[-\s]?\d{4,})/
      ];
      for (const pattern of invoicePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          invoiceNumber = match[1].trim();
          break;
        }
      }
    }
    
    // Fallback sur heuristique si rien trouvé
    if (!vendor || vendor === 'Fournisseur Inconnu') {
      vendor = /acme|vendor|fournisseur|supplier/.test(lower) ? 'ACME Corp' : 'Fournisseur Inconnu';
    }
    if (!currency) {
      currency = /dz|da|dzd/.test(lower) ? 'DZD' : (/eur|€/.test(lower) ? 'EUR' : 'DZD');
    }
    if (!amount && fileUrl) {
      const hash = [...lower].reduce((acc, ch) => (acc * 33 + ch.charCodeAt(0)) >>> 0, 5381);
      amount = Number(((hash % 500000) + 10000).toFixed(0));
    }
    if (!date) {
      const today = new Date();
      date = today.toISOString().split('T')[0];
    }
    if (!invoiceNumber && fileUrl) {
      const hash = [...lower].reduce((acc, ch) => (acc * 33 + ch.charCodeAt(0)) >>> 0, 5381);
      invoiceNumber = 'INV-' + (hash % 100000).toString().padStart(5, '0');
    }
    
    return {
      vendor,
      amount,
      currency,
      date,
      invoiceNumber,
      fields: {
        Tax: amount ? Math.round(amount * 0.19) : null,
        Total: amount ? amount + Math.round(amount * 0.19) : null
      },
      source: fileUrl || (textContent ? 'inline' : null),
      method: textContent ? 'heuristic-text-parsing' : 'heuristic-stub'
    };
  };

  try {
    const body = req.body || {};
    const fileUrl = body.fileUrl || '';
    const contentBase64 = body.contentBase64 || null;
    const modelId = 'prebuilt-invoice';
    const apiVersion = '2023-07-31';

    context.log('[OCR] Request - fileUrl:', fileUrl ? 'PROVIDED' : 'EMPTY');
    context.log('[OCR] Request - contentBase64:', contentBase64 ? 'PROVIDED (length: ' + contentBase64.length + ')' : 'EMPTY');

    if (!hasAzure) {
      // Fallback: essayer d'extraire du texte basique du PDF/Image
      // Pour l'instant, retourner un stub mais avec indication claire
      setCors();
      context.res.status = 200;
      context.res.headers['Content-Type'] = 'application/json';
      
      context.log('[OCR] Azure not configured - using fallback');
      
      // Si contentBase64 disponible, on pourrait utiliser un OCR basique ici
      // Pour l'instant, retour avec méthode claire pour debugging
      const result = fallbackStub(fileUrl, null);
      result.warning = 'Azure Form Recognizer non configuré - extraction limitée';
      result.recommendation = 'Configurez AZURE_FORM_RECOGNIZER_ENDPOINT et AZURE_FORM_RECOGNIZER_KEY pour OCR complet';
      
      context.res.body = result;
      return;
    }

    const baseUrl = endpoint.replace(/\/+$/,'');
    const analyzeUrl = `${baseUrl}/formrecognizer/documentModels/${modelId}:analyze?api-version=${apiVersion}`;

    let postHeaders = { 'Ocp-Apim-Subscription-Key': apiKey };
    let postBody;
    let contentType;

    if (contentBase64) {
      // Binary content
      const buf = Buffer.from(String(contentBase64), 'base64');
      postBody = buf;
      contentType = 'application/octet-stream';
    } else if (fileUrl) {
      postBody = JSON.stringify({ urlSource: fileUrl });
      contentType = 'application/json';
    } else {
      // No input provided
      setCors();
      context.res.status = 400;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { error: 'fileUrl ou contentBase64 requis' };
      return;
    }

    postHeaders['Content-Type'] = contentType;

    const analyzeResp = await fetch(analyzeUrl, { method: 'POST', headers: postHeaders, body: postBody });
    context.log('[OCR] Azure Form Recognizer response status:', analyzeResp.status);
    
    if (analyzeResp.status !== 202) {
      const errText = await analyzeResp.text().catch(() => '');
      context.log('[OCR] Form Recognizer error:', errText.substring(0, 200));
      
      // Tentative fallback via Computer Vision Read API si l'endpoint configuré est ComputerVision
      try {
        const cvUrl = `${baseUrl}/vision/v3.2/read/analyze`;
        const cvHeaders = { 'Ocp-Apim-Subscription-Key': apiKey };
        let cvBody, cvContentType;
        if (contentBase64) {
          cvBody = Buffer.from(String(contentBase64), 'base64');
          cvContentType = 'application/octet-stream';
        } else if (fileUrl) {
          cvBody = JSON.stringify({ url: fileUrl });
          cvContentType = 'application/json';
        } else {
          throw new Error('input manquant');
        }
        cvHeaders['Content-Type'] = cvContentType;
        const cvResp = await fetch(cvUrl, { method: 'POST', headers: cvHeaders, body: cvBody });
        if (cvResp.status !== 202) {
          const errText = await cvResp.text().catch(() => '');
          setCors();
          context.res.status = 200;
          context.res.headers['Content-Type'] = 'application/json';
          context.res.body = { warning: `Analyse non acceptée (${analyzeResp.status})`, details: errText, fallback: fallbackStub(fileUrl), method: 'azure-form-recognizer-error' };
          return;
        }

        const cvOpLoc = cvResp.headers.get('operation-location');
        if (!cvOpLoc) {
          setCors();
          context.res.status = 200;
          context.res.headers['Content-Type'] = 'application/json';
          context.res.body = { warning: 'operation-location manquant (Computer Vision)', fallback: fallbackStub(fileUrl), method: 'azure-computer-vision-missing-oploc' };
          return;
        }

        // Poll Computer Vision Read result
        const maxCvTries = 30; // Augmenté de 10 à 30
        const cvDelayMs = 1000; // Augmenté de 800ms à 1s
        let cvResult = null;
        for (let i = 0; i < maxCvTries; i++) {
          const r = await fetch(cvOpLoc, { headers: { 'Ocp-Apim-Subscription-Key': apiKey } });
          const j = await r.json().catch(() => null);
          if (!j) break;
          if (j.status === 'succeeded') { cvResult = j; break; }
          if (j.status === 'failed') { break; }
          await new Promise(res => setTimeout(res, cvDelayMs));
        }
        if (!cvResult) {
          setCors();
          context.res.status = 200;
          context.res.headers['Content-Type'] = 'application/json';
          context.res.body = { warning: 'Analyse non terminée (Computer Vision)', fallback: fallbackStub(fileUrl), method: 'azure-computer-vision-timeout' };
          return;
        }

        const lines = ((cvResult.analyzeResult && cvResult.analyzeResult.readResults) || [])
          .flatMap(p => p.lines || [])
          .map(l => l.text || '')
          .filter(t => t && t.trim().length);

        // Extraction via le parser intelligent
        const text = lines.join('\n');
        const parsed = fallbackStub(fileUrl, text);
        const vendor = parsed.vendor;
        const amount = parsed.amount;
        const currency = parsed.currency;
        const date = parsed.date;
        const invoiceNumber = parsed.invoiceNumber;

        let storedUrl = null;
        try {
          if (fileUrl) {
            const srcResp = await fetch(fileUrl);
            if (srcResp.ok) {
              const arrayBuf = await srcResp.arrayBuffer();
              const buf = Buffer.from(arrayBuf);
              const guessName = (new URL(fileUrl)).pathname.split('/').pop() || `invoice-${Date.now()}.pdf`;
              storedUrl = await uploadBuffer('invoices', guessName, buf, srcResp.headers.get('content-type') || 'application/octet-stream');
            }
          } else if (contentBase64) {
            const buf = Buffer.from(String(contentBase64), 'base64');
            const name = `invoice-${Date.now()}.bin`;
            storedUrl = await uploadBuffer('invoices', name, buf, 'application/octet-stream');
          }
        } catch {}

        // Détection du type de transaction
        const transactionType = detectTransactionType(text, vendor, null);
        
        setCors();
        context.res.status = 200;
        context.res.headers['Content-Type'] = 'application/json';
        context.res.body = {
          vendor,
          amount,
          currency,
          date,
          invoiceNumber: null,
          fields: {},
          fullText: text,
          fullTextLength: text.length,
          transactionType, // Type détecté
          source: fileUrl || (contentBase64 ? 'inline' : null),
          storedUrl,
          method: 'azure-computer-vision-read'
        };
        return;
      } catch (cvErr) {
        const errText = await analyzeResp.text().catch(() => '');
        setCors();
        context.res.status = 200;
        context.res.headers['Content-Type'] = 'application/json';
        context.res.body = { warning: `Analyse non acceptée (${analyzeResp.status})`, details: errText, fallback: fallbackStub(fileUrl), method: 'azure-form-recognizer-error' };
        return;
      }
    }

    const opLoc = analyzeResp.headers.get('operation-location');
    if (!opLoc) {
      setCors();
      context.res.status = 200;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { warning: 'operation-location manquant', fallback: fallbackStub(fileUrl), method: 'azure-form-recognizer-missing-oploc' };
      return;
    }

    // Augmenté pour les PDFs volumineux (384 Ko+)
    const maxTries = 30; // 30 tentatives au lieu de 10
    const delayMs = 1000; // 1 seconde entre chaque tentative (au lieu de 800ms)
    let resultData = null;

    context.log('[OCR] Polling operation-location, max tries:', maxTries);

    for (let i = 0; i < maxTries; i++) {
      const getResp = await fetch(opLoc, { headers: { 'Ocp-Apim-Subscription-Key': apiKey } });
      const data = await getResp.json().catch(() => null);
      if (!data) break;
      const status = data.status || data.analyzeResult?.status;
      
      context.log(`[OCR] Polling attempt ${i+1}/${maxTries}, status:`, status);
      
      if (status === 'succeeded') { resultData = data; break; }
      if (status === 'failed') { 
        context.log('[OCR] Analysis failed:', data.error || 'Unknown error');
        break; 
      }
      await new Promise(r => setTimeout(r, delayMs));
    }

    if (!resultData) {
      setCors();
      context.res.status = 200;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { warning: 'Analyse non terminée', fallback: fallbackStub(fileUrl), method: 'azure-form-recognizer-timeout' };
      return;
    }

    const resRoot = resultData.analyzeResult || resultData.result || resultData;
    const doc = Array.isArray(resRoot.documents) ? resRoot.documents[0] : null;
    const fields = doc?.fields || {};

    const pick = (f) => {
      const o = fields[f];
      if (!o) return null;
      return o.value ?? o.content ?? null;
    };

    const vendor = pick('VendorName') || pick('VendorAddress') || 'Fournisseur Inconnu';
    const invoiceNumber = pick('InvoiceId') || pick('InvoiceNumber') || null;
    const date = pick('InvoiceDate') || pick('DueDate') || null;
    const amount = pick('InvoiceTotal') || pick('AmountDue') || null;
    const currency = pick('Currency') || null;

    // Extraction du TEXTE COMPLET pour analyse détaillée
    let fullText = '';
    const pages = resRoot.pages || [];
    pages.forEach((page, pageIdx) => {
      if (page.lines) {
        fullText += `\n--- Page ${pageIdx + 1} ---\n`;
        page.lines.forEach(line => {
          fullText += (line.content || '') + '\n';
        });
      }
    });
    
    context.log('[OCR] Texte extrait: ', fullText.length, 'caractères');

    // Extraction avancée de tous les champs disponibles
    const extractedFields = {};
    const fieldMappings = {
      // Informations fournisseur
      VendorName: 'vendorName',
      VendorAddress: 'vendorAddress',
      VendorAddressRecipient: 'vendorAddressRecipient',
      VendorTaxId: 'vendorTaxId',
      
      // Informations client
      CustomerName: 'customerName',
      CustomerAddress: 'customerAddress',
      CustomerAddressRecipient: 'customerAddressRecipient',
      CustomerTaxId: 'customerTaxId',
      CustomerId: 'customerId',
      
      // Détails facture
      InvoiceId: 'invoiceId',
      InvoiceDate: 'invoiceDate',
      DueDate: 'dueDate',
      PaymentTerm: 'paymentTerm',
      PurchaseOrder: 'purchaseOrder',
      BillingAddress: 'billingAddress',
      ShippingAddress: 'shippingAddress',
      
      // Montants
      InvoiceTotal: 'invoiceTotal',
      AmountDue: 'amountDue',
      SubTotal: 'subTotal',
      TotalTax: 'totalTax',
      PreviousUnpaidBalance: 'previousUnpaidBalance',
      
      // Items de ligne
      Items: 'items'
    };

    for (const [azureField, localField] of Object.entries(fieldMappings)) {
      const val = pick(azureField);
      if (val !== null && val !== undefined) {
        extractedFields[localField] = val;
      }
    }

    // Extraction spéciale pour les items de ligne (tableaux)
    if (fields.Items && fields.Items.values) {
      extractedFields.items = fields.Items.values.map(item => {
        const itemFields = item.properties || {};
        return {
          description: itemFields.Description?.value ?? itemFields.Description?.content ?? null,
          quantity: itemFields.Quantity?.value ?? itemFields.Quantity?.content ?? null,
          unitPrice: itemFields.UnitPrice?.value ?? itemFields.UnitPrice?.content ?? null,
          amount: itemFields.Amount?.value ?? itemFields.Amount?.content ?? null,
          productCode: itemFields.ProductCode?.value ?? itemFields.ProductCode?.content ?? null,
          unit: itemFields.Unit?.value ?? itemFields.Unit?.content ?? null,
          date: itemFields.Date?.value ?? itemFields.Date?.content ?? null,
          tax: itemFields.Tax?.value ?? itemFields.Tax?.content ?? null
        };
      }).filter(item => item.description || item.amount);
    }

    let storedUrl = null;
    try {
      if (fileUrl) {
        const srcResp = await fetch(fileUrl);
        if (srcResp.ok) {
          const arrayBuf = await srcResp.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          const guessName = (new URL(fileUrl)).pathname.split('/').pop() || `invoice-${Date.now()}.pdf`;
          storedUrl = await uploadBuffer('invoices', guessName, buf, srcResp.headers.get('content-type') || 'application/octet-stream');
        }
      } else if (contentBase64) {
        const buf = Buffer.from(String(contentBase64), 'base64');
        const name = `invoice-${Date.now()}.bin`;
        storedUrl = await uploadBuffer('invoices', name, buf, 'application/octet-stream');
      }
    } catch {}

    // === DÉTECTION TYPE TRANSACTION (Charge vs Revenu) ===
    const transactionType = detectTransactionType(fullText, vendor, extractedFields);
    context.log('[OCR] Transaction type detected:', transactionType);
    
    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = {
      vendor,
      amount,
      currency,
      date,
      invoiceNumber,
      extractedFields, // Tous les champs extraits avec leurs valeurs
      fullText, // TEXTE COMPLET pour analyse IA approfondie
      fullTextLength: fullText.length,
      transactionType, // Type détecté: expense ou revenue
      fields: {
        VendorName: fields.VendorName || null,
        InvoiceId: fields.InvoiceId || null,
        InvoiceDate: fields.InvoiceDate || null,
        InvoiceTotal: fields.InvoiceTotal || null
      },
      source: fileUrl || (contentBase64 ? 'inline' : null),
      storedUrl,
      method: 'azure-form-recognizer'
    };
  } catch (err) {
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = { error: err.message || String(err) };
  }
};

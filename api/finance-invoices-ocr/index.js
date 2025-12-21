const { uploadBuffer } = require('../utils/storage');

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

  if (req.method === 'OPTIONS') {
    setCors();
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  const fallbackStub = (fileUrl) => {
    const lower = String(fileUrl || '').toLowerCase();
    const vendor = /acme|vendor|fournisseur|supplier/.test(lower) ? 'ACME Corp' : 'Fournisseur Inconnu';
    const currency = /dz|da|dzd/.test(lower) ? 'DZD' : (/eur|€/.test(lower) ? 'EUR' : 'DZD');
    const hash = [...lower].reduce((acc, ch) => (acc * 33 + ch.charCodeAt(0)) >>> 0, 5381);
    const amount = Number(((hash % 500000) + 10000).toFixed(0));
    const today = new Date();
    const date = today.toISOString().split('T')[0];
    const invoiceNumber = 'INV-' + (hash % 100000).toString().padStart(5, '0');
    return {
      vendor,
      amount,
      currency,
      date,
      invoiceNumber,
      fields: {
        Tax: Math.round(amount * 0.19),
        Total: amount + Math.round(amount * 0.19)
      },
      source: fileUrl || null,
      method: 'heuristic-stub'
    };
  };

  try {
    const body = req.body || {};
    const fileUrl = body.fileUrl || '';
    const contentBase64 = body.contentBase64 || null;
    const modelId = 'prebuilt-invoice';
    const apiVersion = '2023-07-31';

    if (!hasAzure) {
      setCors();
      context.res.status = 200;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = fallbackStub(fileUrl);
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
    if (analyzeResp.status !== 202) {
      const errText = await analyzeResp.text().catch(() => '');
      setCors();
      context.res.status = 200;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { warning: `Analyse non acceptée (${analyzeResp.status})`, details: errText, fallback: fallbackStub(fileUrl), method: 'azure-form-recognizer-error' };
      return;
    }

    const opLoc = analyzeResp.headers.get('operation-location');
    if (!opLoc) {
      setCors();
      context.res.status = 200;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { warning: 'operation-location manquant', fallback: fallbackStub(fileUrl), method: 'azure-form-recognizer-missing-oploc' };
      return;
    }

    const maxTries = 10;
    const delayMs = 800;
    let resultData = null;

    for (let i = 0; i < maxTries; i++) {
      const getResp = await fetch(opLoc, { headers: { 'Ocp-Apim-Subscription-Key': apiKey } });
      const data = await getResp.json().catch(() => null);
      if (!data) break;
      const status = data.status || data.analyzeResult?.status;
      if (status === 'succeeded') { resultData = data; break; }
      if (status === 'failed') { break; }
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

    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = {
      vendor,
      amount,
      currency,
      date,
      invoiceNumber,
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

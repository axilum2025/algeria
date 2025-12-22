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
    const visionEndpoint = process.env.AZURE_VISION_ENDPOINT;
    const visionKey = process.env.AZURE_VISION_KEY;

    if (!visionKey || !visionEndpoint) {
      setCors();
      context.res.status = 500;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = {
        error: 'Azure Vision not configured',
        details: 'AZURE_VISION_KEY or AZURE_VISION_ENDPOINT missing'
      };
      return;
    }

    const { file, fileName } = req.body || {};

    if (!file) {
      setCors();
      context.res.status = 400;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { error: 'file (base64) required' };
      return;
    }

    context.log(`📄 Extracting text from: ${fileName || 'unnamed'}`);

    // Remove data URL prefix if present
    const base64Data = file.includes(',') ? file.split(',')[1] : file;
    const imageBuffer = Buffer.from(base64Data, 'base64');

    context.log(`📦 File size: ${imageBuffer.length} bytes`);

    // Use Read API for OCR (supports PDF and images)
    const readUrl = `${visionEndpoint}/vision/v3.2/read/analyze`;

    const readResponse = await fetch(readUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': visionKey,
        'Content-Type': 'application/octet-stream'
      },
      body: imageBuffer
    });

    if (!readResponse.ok) {
      const errorText = await readResponse.text();
      context.log.error('❌ Azure Vision Read Error:', readResponse.status, errorText);
      setCors();
      context.res.status = 500;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = {
        error: `Azure Vision Read API error: ${readResponse.status}`,
        details: errorText
      };
      return;
    }

    // Get operation location from headers
    const operationLocation = readResponse.headers.get('operation-location');
    if (!operationLocation) {
      setCors();
      context.res.status = 500;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { error: 'No operation location in response' };
      return;
    }

    // Poll for results
    let result = null;
    const maxAttempts = 20;
    const delayMs = 500;
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      const resultResponse = await fetch(operationLocation, {
        headers: { 'Ocp-Apim-Subscription-Key': visionKey }
      });
      
      if (!resultResponse.ok) {
        context.log.warn('⚠️ Poll attempt failed:', resultResponse.status);
        continue;
      }
      
      const resultData = await resultResponse.json();
      
      if (resultData.status === 'succeeded') {
        result = resultData;
        break;
      } else if (resultData.status === 'failed') {
        setCors();
        context.res.status = 500;
        context.res.headers['Content-Type'] = 'application/json';
        context.res.body = { error: 'OCR processing failed' };
        return;
      }
    }

    if (!result) {
      setCors();
      context.res.status = 500;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = { error: 'OCR timeout - operation did not complete' };
      return;
    }

    // Extract text from results
    const extractedText = result.analyzeResult?.readResults
      ?.flatMap(page => page.lines.map(line => line.text))
      .join('\n') || '';

    if (!extractedText || extractedText.trim().length < 10) {
      setCors();
      context.res.status = 400;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = {
        error: 'Insufficient text extracted',
        details: 'The file may be of poor quality or empty',
        extractedLength: extractedText.length
      };
      return;
    }

    context.log(`✅ Extracted ${extractedText.length} characters`);

    setCors();
    context.res.status = 200;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = {
      text: extractedText,
      fileName: fileName,
      length: extractedText.length
    };

  } catch (error) {
    context.log.error('❌ Error:', error);
    setCors();
    context.res.status = 500;
    context.res.headers['Content-Type'] = 'application/json';
    context.res.body = {
      error: error.message || String(error)
    };
  }
};

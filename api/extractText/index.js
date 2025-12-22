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

    // Extract text using Azure Vision OCR
    const analyzeUrl = `${visionEndpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read`;

    const visionResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': visionKey,
        'Content-Type': 'application/octet-stream'
      },
      body: imageBuffer
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      context.log.error('❌ Azure Vision Error:', visionResponse.status, errorText);
      setCors();
      context.res.status = 500;
      context.res.headers['Content-Type'] = 'application/json';
      context.res.body = {
        error: `Azure Vision API error: ${visionResponse.status}`,
        details: errorText
      };
      return;
    }

    const visionData = await visionResponse.json();

    // Extract all text from OCR
    const extractedText = visionData.readResult?.blocks
      ?.flatMap(block => block.lines.map(line => line.text))
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

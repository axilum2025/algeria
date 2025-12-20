module.exports = async function (context, req) {
    // CORS headers
    context.res = {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    };

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        context.res.body = '';
        return;
    }

    try {
        context.log('📄 Starting CV parsing...');

        // Validate configuration
        const visionEndpoint = process.env.AZURE_VISION_ENDPOINT;
        const visionKey = process.env.AZURE_VISION_KEY;
        const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const openaiKey = process.env.AZURE_OPENAI_KEY;

        if (!visionKey || !visionEndpoint) {
            context.res.status = 500;
            context.res.body = JSON.stringify({
                error: 'Azure Vision not configured',
                details: 'AZURE_VISION_KEY or AZURE_VISION_ENDPOINT missing'
            });
            return;
        }

        if (!openaiKey || !openaiEndpoint) {
            context.res.status = 500;
            context.res.body = JSON.stringify({
                error: 'Azure OpenAI not configured',
                details: 'AZURE_OPENAI_KEY or AZURE_OPENAI_ENDPOINT missing'
            });
            return;
        }

        // Extract request data
        const { file, fileType, fileName } = req.body || {};

        if (!file) {
            context.res.status = 400;
            context.res.body = JSON.stringify({
                error: 'No file provided',
                details: 'file (base64) is required'
            });
            return;
        }

        context.log(`📄 Processing CV: ${fileName || 'unnamed'} (${fileType || 'unknown'})`);

        // Remove data URL prefix if present
        const base64Data = file.includes(',') ? file.split(',')[1] : file;
        const imageBuffer = Buffer.from(base64Data, 'base64');

        context.log(`📦 File size: ${imageBuffer.length} bytes`);

        // STEP 1: Extract text using Azure Vision OCR
        context.log('🔍 Step 1: Extracting text with Azure Vision OCR...');
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
            throw new Error(`Azure Vision API error: ${visionResponse.status}`);
        }

        const visionData = await visionResponse.json();

        // Extract all text from OCR
        const extractedText = visionData.readResult?.blocks
            ?.flatMap(block => block.lines.map(line => line.text))
            .join('\n') || '';

        if (!extractedText || extractedText.trim().length < 50) {
            context.res.status = 400;
            context.res.body = JSON.stringify({
                error: 'Insufficient text extracted',
                details: 'The CV image/PDF may be of poor quality or empty',
                extractedLength: extractedText.length
            });
            return;
        }

        context.log(`✅ Extracted ${extractedText.length} characters`);

        // STEP 2: Parse with Azure OpenAI
        context.log('🤖 Step 2: Parsing CV data with Azure OpenAI...');

        const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4';
        const openaiUrl = `${openaiEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`;

        const openaiResponse = await fetch(openaiUrl, {
            method: 'POST',
            headers: {
                'api-key': openaiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: `Tu es un expert en parsing de CV. Extrais les informations au format JSON exact.

INSTRUCTIONS STRICTES :
1. Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après
2. Ne mets PAS de balises markdown \`\`\`json
3. Si une information n'est pas trouvée, utilise "" pour les strings et [] pour les arrays
4. Pour l'expérience : compte le nombre d'années total (ex: si dernier job = 2020-2024, c'est 4 ans minimum)
5. Pour les compétences : extrais TOUTES les compétences techniques mentionnées
6. Pour le diplôme : cherche le plus haut niveau (Doctorat > Master/Bac+5 > Licence/Bac+3 > DUT/BTS/Bac+2 > Bac)
7. Pour les langues : cherche les niveaux CECR (A1, A2, B1, B2, C1, C2) ou équivalents`
                    },
                    {
                        role: 'user',
                        content: `Extrais ces informations du CV suivant au format JSON exact :

{
    "name": "Prénom Nom complet",
    "email": "email@example.com",
    "phone": "numéro de téléphone",
    "skills": ["skill1", "skill2", "skill3"],
    "experience": nombre_total_années,
    "degree": "Bac+X ou Doctorat",
    "languages": "B2",
    "lastJob": "Dernier poste chez Entreprise (dates)",
    "certifications": ["certification1", "certification2"]
}

TEXTE DU CV :
${extractedText}

Réponds UNIQUEMENT avec le JSON, rien d'autre.`
                    }
                ],
                temperature: 0.1,
                max_tokens: 1500,
                response_format: { type: "json_object" }
            })
        });

        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            context.log.error('❌ Azure OpenAI Error:', openaiResponse.status, errorText);
            throw new Error(`Azure OpenAI API error: ${openaiResponse.status}`);
        }

        const openaiData = await openaiResponse.json();
        const aiResponse = openaiData.choices[0].message.content;

        context.log('🔍 AI Response:', aiResponse);

        // Parse JSON response
        let parsedData;
        try {
            // Clean response (remove markdown code blocks if present)
            const cleaned = aiResponse.replace(/```json|```/g, '').trim();
            parsedData = JSON.parse(cleaned);
        } catch (parseError) {
            context.log.error('❌ JSON Parse Error:', parseError.message);
            context.log.error('Raw AI response:', aiResponse);
            
            // Fallback: try to extract data with regex
            parsedData = {
                name: "",
                email: extractedText.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] || "",
                phone: extractedText.match(/[\+\d\s\(\)-]{10,}/)?.[0] || "",
                skills: [],
                experience: 0,
                degree: "",
                languages: "B2",
                lastJob: "",
                certifications: []
            };
        }

        // Validate and normalize data
        parsedData.name = parsedData.name || "";
        parsedData.email = parsedData.email || "";
        parsedData.phone = parsedData.phone || "";
        parsedData.skills = Array.isArray(parsedData.skills) ? parsedData.skills : [];
        parsedData.experience = parseInt(parsedData.experience) || 0;
        parsedData.degree = parsedData.degree || "Bac+3";
        parsedData.languages = parsedData.languages || "B2";
        parsedData.lastJob = parsedData.lastJob || "";
        parsedData.certifications = Array.isArray(parsedData.certifications) ? parsedData.certifications : [];

        context.log('✅ CV parsed successfully');
        context.log('Extracted data:', JSON.stringify(parsedData, null, 2));

        // Return success
        context.res.status = 200;
        context.res.body = JSON.stringify({
            success: true,
            data: parsedData,
            rawText: extractedText.substring(0, 500) + '...',
            stats: {
                textLength: extractedText.length,
                skillsCount: parsedData.skills.length,
                certificationsCount: parsedData.certifications.length
            }
        });

    } catch (error) {
        context.log.error('❌ CV Parsing Error:', error.message);
        context.res.status = 500;
        context.res.body = JSON.stringify({
            error: 'Failed to parse CV',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

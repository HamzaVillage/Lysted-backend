const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Initialize Gemini
const getGenAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;

    console.log("dsadsadsa")
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in environment variables.');
    }
    return new GoogleGenerativeAI(apiKey);
};

// ============================================================
// HELPER: Convert uploaded file buffer to Gemini-compatible part
// ============================================================
const bufferToGenerativePart = (buffer, mimeType) => {
    return {
        inlineData: {
            data: buffer.toString('base64'),
            mimeType,
        },
    };
};

// ============================================================
// HELPER: Retry with exponential backoff for 429 rate limit errors
// ============================================================
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const callWithRetry = async (fn, maxRetries = 3, label = 'API call') => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const is429 = err.message && (err.message.includes('429') || err.message.includes('Too Many Requests') || err.message.includes('quota'));

            if (is429 && attempt < maxRetries) {
                // Parse retry delay from error if available
                let waitMs = attempt * 15000; // default: 15s, 30s, 45s
                const retryMatch = err.message.match(/retry in ([\d.]+)s/i);
                if (retryMatch) {
                    waitMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000; // add 1s buffer
                }
                console.log(`[AI] ${label} hit rate limit (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(waitMs / 1000)}s...`);
                await sleep(waitMs);
            } else {
                throw err;
            }
        }
    }
};

// ============================================================
// HELPER: Enhance image using Sharp (brightness, contrast, sharpness)
// ============================================================
const enhanceImageWithSharp = async (imageBuffer) => {
    const enhanced = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: false })
        .sharpen({ sigma: 1.5, m1: 1.0, m2: 0.5 })
        .modulate({
            brightness: 1.08,
            saturation: 1.15,
        })
        .normalise()
        .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
        .toBuffer();

    return enhanced;
};

// ============================================================
// HELPER: Analyze product using Gemini Vision
// ============================================================
const analyzeProduct = async (imageBuffer, mimeType) => {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    const imagePart = bufferToGenerativePart(imageBuffer, mimeType);

    const prompt = `You are an expert product photographer and e-commerce listing specialist.

Analyze this product image in extreme detail. I need you to identify:

1. **productType**: What is this product? (e.g., "Men's Striped Button-Down Overshirt")
2. **brand**: What brand is it? Look for logos, tags, labels. If unsure, say "Unknown"
3. **color**: Exact colors (e.g., "Navy blue and cream striped")
4. **material**: What material does it appear to be? (e.g., "Cotton blend")
5. **condition**: Rate the condition (New, Like New, Excellent, Good, Fair)
6. **category**: E-commerce category (e.g., "Men's Clothing > Shirts > Casual")
7. **features**: List 3-5 key features (e.g., ["Button-front closure", "Relaxed fit", "Chest pocket"])
8. **style**: Style description (e.g., "Casual streetwear")
9. **detailedDescription**: A 2-3 sentence highly detailed visual description of the product, including colors, patterns, textures, shape, any visible branding, stitching details — everything needed to recreate this product visually in a photograph.

Respond ONLY with valid JSON. No markdown, no code fences. Just raw JSON with these exact keys.`;

    const result = await callWithRetry(
        () => model.generateContent([prompt, imagePart]),
        3,
        'Product Analysis'
    );
    const responseText = result.response.text().trim();

    // Clean up response — remove any markdown fences if model adds them
    let cleanJson = responseText;
    if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    try {
        return JSON.parse(cleanJson);
    } catch (parseErr) {
        console.error('[AI] Failed to parse product analysis JSON:', cleanJson);
        // Return a reasonable fallback
        return {
            productType: 'Product',
            brand: 'Unknown',
            color: 'Multi-color',
            material: 'Mixed',
            condition: 'Good',
            category: 'General',
            features: ['See image for details'],
            style: 'Casual',
            detailedDescription: 'A product as shown in the uploaded image.',
        };
    }
};

// ============================================================
// HELPER: Generate professional product images using Imagen 3
// ============================================================
const generateProductImages = async (productAnalysis, originalImageBuffer, mimeType) => {
    const genAI = getGenAI();

    // Use gemini-3.1-flash-image with image generation capability
    const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-image',
        generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
        },
    });

    const { productType, color, material, features, detailedDescription, brand, style } = productAnalysis;
    const featureStr = Array.isArray(features) ? features.join(', ') : features || '';

    // Build the reference image part
    const imagePart = bufferToGenerativePart(originalImageBuffer, mimeType);

    // Prompt 1: Studio/White background professional shot
    const prompt1 = `You are a professional product photographer. Look at this reference product image carefully.

Generate a NEW professional product photograph of this EXACT SAME product:
- Product: ${productType}
- Brand: ${brand || 'Generic'}
- Colors: ${color}
- Material: ${material}
- Style: ${style}
- Key Details: ${featureStr}
- Visual Description: ${detailedDescription}

REQUIREMENTS:
- Clean white/light gray studio background
- Professional lighting with soft shadows
- Product centered and well-composed
- High-end e-commerce product photography style
- The product must look IDENTICAL to the reference image — same colors, same pattern, same design, same shape
- 4K quality, sharp focus

Generate this image now.`;

    // Prompt 2: Lifestyle/contextual shot
    const prompt2 = `You are a professional product photographer. Look at this reference product image carefully.

Generate a NEW professional lifestyle product photograph of this EXACT SAME product:
- Product: ${productType}
- Brand: ${brand || 'Generic'}
- Colors: ${color}
- Material: ${material}
- Style: ${style}
- Key Details: ${featureStr}
- Visual Description: ${detailedDescription}

REQUIREMENTS:
- Attractive lifestyle setting that matches the product category (e.g., fashion shoot for clothing, kitchen for kitchenware, desk setup for tech)
- Beautiful, natural lighting
- Product is the clear hero/focus of the image
- Professional editorial photography style
- The product must look IDENTICAL to the reference image — same colors, same pattern, same design, same shape
- Aspirational and eye-catching composition
- 4K quality

Generate this image now.`;

    const generatedImages = [];

    // Generate image 1 — studio shot
    try {
        console.log('[AI] Generating studio product image...');
        const result1 = await callWithRetry(
            () => model.generateContent([prompt1, imagePart]),
            3,
            'Studio Image Generation'
        );
        const response1 = result1.response;

        for (const part of response1.candidates[0].content.parts) {
            if (part.inlineData) {
                generatedImages.push({
                    data: part.inlineData.data,
                    mimeType: part.inlineData.mimeType,
                    type: 'studio',
                });
                break;
            }
        }
        console.log('[AI] Studio image generated successfully.');
    } catch (err) {
        console.error('[AI] Studio image generation failed:', err.message);
    }

    // Generate image 2 — lifestyle shot
    try {
        console.log('[AI] Generating lifestyle product image...');
        const result2 = await callWithRetry(
            () => model.generateContent([prompt2, imagePart]),
            3,
            'Lifestyle Image Generation'
        );
        const response2 = result2.response;

        for (const part of response2.candidates[0].content.parts) {
            if (part.inlineData) {
                generatedImages.push({
                    data: part.inlineData.data,
                    mimeType: part.inlineData.mimeType,
                    type: 'lifestyle',
                });
                break;
            }
        }
        console.log('[AI] Lifestyle image generated successfully.');
    } catch (err) {
        console.error('[AI] Lifestyle image generation failed:', err.message);
    }

    return generatedImages;
};

// ============================================================
// HELPER: Generate title & description suggestions
// ============================================================
const generateListingSuggestions = async (productAnalysis, imageBuffer, mimeType) => {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const imagePart = bufferToGenerativePart(imageBuffer, mimeType);
    const { productType, brand, color, material, condition, features, style, category } = productAnalysis;
    const featureStr = Array.isArray(features) ? features.join(', ') : features || '';

    const prompt = `You are an expert e-commerce copywriter who specializes in writing highly converting product listings.

Based on this product image and analysis, generate listing suggestions:

Product Details:
- Type: ${productType}
- Brand: ${brand}
- Color: ${color}
- Material: ${material}
- Condition: ${condition}
- Category: ${category}
- Style: ${style}
- Features: ${featureStr}

Generate EXACTLY 3 title options and 3 description options.

Title Requirements:
- Include brand name (if known), product type, key attribute (color/pattern)
- 40-80 characters each
- SEO optimized for marketplace search
- Each title should have a different style: 1) Professional/formal, 2) Casual/trendy, 3) Keyword-rich/SEO

Description Requirements:
- 2-4 sentences each
- Highlight key features and selling points
- Include condition mention
- Each description should have a different tone: 1) Professional, 2) Friendly/casual, 3) Detailed/technical
- Make buyers excited about the product

Respond ONLY with valid JSON in this exact format:
{
  "titles": ["title1", "title2", "title3"],
  "descriptions": ["desc1", "desc2", "desc3"]
}

No markdown, no code fences. Just raw JSON.`;

    const result = await callWithRetry(
        () => model.generateContent([prompt, imagePart]),
        3,
        'Listing Suggestions'
    );
    const responseText = result.response.text().trim();

    let cleanJson = responseText;
    if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    try {
        return JSON.parse(cleanJson);
    } catch (parseErr) {
        console.error('[AI] Failed to parse listing suggestions JSON:', cleanJson);
        return {
            titles: [
                `${brand || ''} ${productType} - ${color}`.trim(),
                `${productType} in ${color} - ${condition} Condition`,
                `${brand || 'Premium'} ${productType} ${color} ${style}`.trim(),
            ],
            descriptions: [
                `Beautiful ${productType.toLowerCase()} in ${color}. In ${(condition || 'good').toLowerCase()} condition. ${featureStr}.`,
                `Check out this amazing ${productType.toLowerCase()}! Features ${featureStr}. Don't miss out!`,
                `${brand || 'Quality'} ${productType}. Color: ${color}. Material: ${material}. Condition: ${condition}. ${featureStr}.`,
            ],
        };
    }
};

// ============================================================
// MAIN ENDPOINT: Process Product (All-in-One Pipeline)
// ============================================================
exports.processProduct = async (req, res) => {
    try {
        console.log('[AI] ========== PRODUCT PROCESSING STARTED ==========');

        // Validate image upload
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image uploaded. Please upload a product image.',
            });
        }

        const originalBuffer = req.file.buffer;
        const mimeType = req.file.mimetype || 'image/jpeg';

        console.log(`[AI] Received image: ${req.file.originalname}, size: ${originalBuffer.length} bytes, type: ${mimeType}`);

        // ---- STEP 1: Enhance the uploaded image ----
        console.log('[AI] Step 1: Enhancing image...');
        let enhancedBuffer;
        try {
            enhancedBuffer = await enhanceImageWithSharp(originalBuffer);
            console.log(`[AI] Image enhanced: ${enhancedBuffer.length} bytes`);
        } catch (enhanceErr) {
            console.error('[AI] Image enhancement failed, using original:', enhanceErr.message);
            enhancedBuffer = originalBuffer;
        }

        // ---- STEP 2: Analyze product with Gemini Vision ----
        console.log('[AI] Step 2: Analyzing product with Gemini Vision...');
        let productAnalysis;
        try {
            productAnalysis = await analyzeProduct(enhancedBuffer, 'image/jpeg');
            console.log('[AI] Product analysis complete:', JSON.stringify(productAnalysis, null, 2));
        } catch (analysisErr) {
            console.error('[AI] Product analysis failed:', analysisErr.message);
            const isQuotaError = analysisErr.message && (analysisErr.message.includes('429') || analysisErr.message.includes('quota') || analysisErr.message.includes('Too Many Requests'));
            return res.status(isQuotaError ? 429 : 500).json({
                success: false,
                message: isQuotaError
                    ? 'Gemini API rate limit exceeded. Your free tier quota may be exhausted — please wait a minute and try again, or upgrade to a paid Gemini plan.'
                    : 'Failed to analyze product image. Please check your Gemini API key and try again.',
                error: analysisErr.message,
                isQuotaError,
            });
        }

        // ---- STEP 3: Generate 2 professional product images ----
        console.log('[AI] Step 3: Generating professional product images...');
        let generatedImages = [];
        try {
            generatedImages = await generateProductImages(productAnalysis, enhancedBuffer, 'image/jpeg');
            console.log(`[AI] Generated ${generatedImages.length} product images.`);
        } catch (genErr) {
            console.error('[AI] Image generation failed:', genErr.message);
            // Not fatal — continue without generated images
        }

        // ---- STEP 4: Generate title & description suggestions ----
        console.log('[AI] Step 4: Generating listing suggestions...');
        let suggestions;
        try {
            suggestions = await generateListingSuggestions(productAnalysis, enhancedBuffer, 'image/jpeg');
            console.log('[AI] Suggestions generated:', JSON.stringify(suggestions, null, 2));
        } catch (suggestErr) {
            console.error('[AI] Suggestions generation failed:', suggestErr.message);
            suggestions = {
                titles: [`${productAnalysis.brand || ''} ${productAnalysis.productType || 'Product'}`.trim()],
                descriptions: ['A quality product in great condition.'],
            };
        }

        // ---- BUILD RESPONSE ----
        console.log('[AI] ========== PRODUCT PROCESSING COMPLETE ==========');

        return res.status(200).json({
            success: true,
            enhancedImage: {
                data: enhancedBuffer.toString('base64'),
                mimeType: 'image/jpeg',
            },
            generatedImages: generatedImages.map((img) => ({
                data: img.data,
                mimeType: img.mimeType,
                type: img.type,
            })),
            suggestions,
            productAnalysis: {
                productType: productAnalysis.productType,
                brand: productAnalysis.brand,
                color: productAnalysis.color,
                material: productAnalysis.material,
                condition: productAnalysis.condition,
                category: productAnalysis.category,
                features: productAnalysis.features,
                style: productAnalysis.style,
            },
        });
    } catch (error) {
        console.error('[AI] Unexpected error in processProduct:', error);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred during AI processing.',
            error: error.message,
        });
    }
};

// ============================================================
// INDIVIDUAL ENDPOINT: Enhance Image Only
// ============================================================
exports.enhanceImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image uploaded.' });
        }

        const enhanced = await enhanceImageWithSharp(req.file.buffer);

        return res.status(200).json({
            success: true,
            enhancedImage: {
                data: enhanced.toString('base64'),
                mimeType: 'image/jpeg',
            },
        });
    } catch (error) {
        console.error('[AI] enhanceImage error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// INDIVIDUAL ENDPOINT: Analyze Product Only
// ============================================================
exports.analyzeProductImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image uploaded.' });
        }

        const analysis = await analyzeProduct(req.file.buffer, req.file.mimetype || 'image/jpeg');

        return res.status(200).json({
            success: true,
            productAnalysis: analysis,
        });
    } catch (error) {
        console.error('[AI] analyzeProductImage error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// INDIVIDUAL ENDPOINT: Generate Images Only
// ============================================================
exports.generateImages = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image uploaded.' });
        }

        const { productAnalysis } = req.body;
        if (!productAnalysis) {
            return res.status(400).json({ success: false, message: 'Product analysis data is required.' });
        }

        let analysis;
        try {
            analysis = typeof productAnalysis === 'string' ? JSON.parse(productAnalysis) : productAnalysis;
        } catch {
            return res.status(400).json({ success: false, message: 'Invalid productAnalysis JSON.' });
        }

        const images = await generateProductImages(analysis, req.file.buffer, req.file.mimetype || 'image/jpeg');

        return res.status(200).json({
            success: true,
            generatedImages: images.map((img) => ({
                data: img.data,
                mimeType: img.mimeType,
                type: img.type,
            })),
        });
    } catch (error) {
        console.error('[AI] generateImages error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// INDIVIDUAL ENDPOINT: Suggest Listing Only
// ============================================================
exports.suggestListing = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image uploaded.' });
        }

        const { productAnalysis } = req.body;
        let analysis;

        if (productAnalysis) {
            try {
                analysis = typeof productAnalysis === 'string' ? JSON.parse(productAnalysis) : productAnalysis;
            } catch {
                return res.status(400).json({ success: false, message: 'Invalid productAnalysis JSON.' });
            }
        } else {
            // If no analysis provided, run analysis first
            analysis = await analyzeProduct(req.file.buffer, req.file.mimetype || 'image/jpeg');
        }

        const suggestions = await generateListingSuggestions(analysis, req.file.buffer, req.file.mimetype || 'image/jpeg');

        return res.status(200).json({
            success: true,
            suggestions,
        });
    } catch (error) {
        console.error('[AI] suggestListing error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

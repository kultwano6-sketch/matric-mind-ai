import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const maxDuration = 90;
export const runtime = 'edge';

/**
 * POST /api/ocr-solve
 * 
 * Takes a base64-encoded image, uses OCR to extract text,
 * then sends to Groq for solving with step-by-step solution.
 * 
 * Body:
 * {
 *   image: string (base64 encoded image),
 *   subject?: string (optional subject context),
 *   language?: string (default: 'eng')
 * }
 * 
 * Returns: extracted text + solution steps
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { image, subject, language = 'eng' } = body;

    if (!image) {
      return new Response(JSON.stringify({ error: 'Missing required field: image (base64)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ========================================
    // Step 1: OCR using Groq Vision Model
    // ========================================
    // Strip data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    
    // Validate it's a reasonable base64 string
    if (base64Data.length < 100) {
      return new Response(JSON.stringify({ error: 'Image data appears to be too small or invalid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Detect image type from prefix
    let imageType = 'image/png';
    if (image.includes('data:image/jpeg') || image.includes('data:image/jpg')) {
      imageType = 'image/jpeg';
    } else if (image.includes('data:image/webp')) {
      imageType = 'image/webp';
    }

    let extractedText = '';

    try {
      // Use Groq's vision capability for OCR
      const ocrPrompt = subject
        ? `Extract ALL text from this image precisely. This is a ${subject} question/exercise. 
           Preserve mathematical notation, formatting, and structure. 
           If there are multiple questions, number them. 
           Return ONLY the extracted text, nothing else.`
        : `Extract ALL text from this image precisely. 
           Preserve mathematical notation, formatting, and structure.
           If there are multiple questions, number them.
           Return ONLY the extracted text, nothing else.`;

      const { text: ocrResult } = await generateText({
        model: groq('llama-3.2-11b-vision-preview'),
        system: 'You are a precise OCR system. Extract text exactly as it appears. Do not add explanations or commentary.',
        prompt: ocrPrompt,
        maxOutputTokens: 2048,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: ocrPrompt },
              { type: 'image', image: `data:${imageType};base64,${base64Data}` },
            ],
          },
        ],
      });

      extractedText = ocrResult;
    } catch (ocrError) {
      console.error('OCR error:', ocrError);
      return new Response(JSON.stringify({ 
        error: 'Failed to extract text from image. Please ensure the image is clear and contains readable text.',
        details: (ocrError as Error)?.message,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!extractedText || extractedText.trim().length < 5) {
      return new Response(JSON.stringify({ 
        error: 'Could not extract readable text from the image. Please ensure the image is clear and well-lit.',
        extracted_text: '',
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ========================================
    // Step 2: Solve using Groq
    // ========================================
    let solution = '';
    try {
      const subjectContext = subject ? `in the context of ${subject}` : '';
      const solvePrompt = `Solve the following Matric-level problem ${subjectContext}. 
Provide a clear, step-by-step solution.

PROBLEM:
${extractedText}

Format your response as:
1. **Understanding the Problem** (brief restate what's being asked)
2. **Step-by-step Solution** (numbered steps with working shown)
3. **Final Answer** (clearly stated)

Use proper mathematical notation. Show all working. Be thorough but concise.`;

      const { text: solveResult } = await generateText({
        model: groq('llama-3.1-8b-instant'),
        system: `You are a South African Matric tutor. Provide clear, step-by-step solutions. 
Show all mathematical working. Use standard notation.
For Physical Sciences, include formulas and units.
For Accounting, use proper formatting for financial statements.`,
        prompt: solvePrompt,
        maxOutputTokens: 2048,
        temperature: 0.2,
      });

      solution = solveResult;
    } catch (solveError) {
      console.error('Solve error:', solveError);
      solution = 'Unable to generate solution at this time. Please try again.';
    }

    return new Response(JSON.stringify({
      success: true,
      extracted_text: extractedText,
      solution,
      subject: subject || 'general',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('OCR Solve error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process image',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

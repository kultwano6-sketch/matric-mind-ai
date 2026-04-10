// api/ocr-pipeline.ts — Simple OCR Pipeline
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 60;
export const runtime = 'nodejs';

const FALLBACK = "Couldn't solve that. Try a clearer photo.";

// OCR.space for text extraction
async function extractText(base64Image: string): Promise<string> {
  const formData = new FormData();
  formData.append('base64Image', `data:image/jpeg;base64,${base64Image}`);
  formData.append('language', 'eng');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2');
  
  try {
    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'apikey': process.env.OCR_SPACE_API_KEY || 'K84923004988957' },
      body: formData
    });
    const data = await res.json();
    if (data.ParsedResults?.[0]?.ParsedText) {
      return data.ParsedResults[0].ParsedText.trim();
    }
    return '';
  } catch (e) {
    console.error('OCR error:', e);
    return '';
  }
}

// Solve with AI
async function solve(text: string, subject: string) {
  const { text: response } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    messages: [
      { role: 'system', content: `You are a ${subject} tutor for Matric. Solve step by step.` },
      { role: 'user', content: text }
    ],
    maxTokens: 1500,
  });
  
  const lines = response.split('\n').filter(l => l.trim());
  const answerIdx = lines.findIndex(l => /answer|therefore|thus/i.test(l));
  
  return {
    question: text,
    steps: lines.slice(0, answerIdx > 0 ? answerIdx : 6),
    answer: lines[answerIdx]?.replace(/^(answer|therefore|thus)[:\s]*/i, '') || 'See above',
    explanation: response.slice(0, 400),
    tips: ['Practice similar problems', 'Review the concepts', 'Ask if unclear']
  };
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { image, question, subject = 'mathematics', extracted_text, action } = await req.json();
    let text = '';

    if (image) {
      const base64 = image.replace(/^data:image\/\w+;base64,/, '');
      text = await extractText(base64);
      
      // If no OCR text, just return error - don't try Groq vision (doesn't work with base64)
      if (!text) {
        return new Response(JSON.stringify({ 
          error: 'Could not read image. Try a clearer photo.',
          needs_review: true 
        }), { status: 200 });
      }
    } else if (question) {
      text = question;
    } else if (extracted_text) {
      text = extracted_text;
    } else {
      return new Response(JSON.stringify({ error: 'Need image or question' }), { status: 400 });
    }

    // Fix text
    text = text.replace(/\s+/g, ' ').trim();

    // Solve
    const solution = await solve(text, subject);

    return new Response(JSON.stringify({ 
      solution,
      ocr_text: text,
      cleaned_text: text,
      isMultipleQuestions: /\d+[\.)]/.test(text)
    }), { status: 200 });

  } catch (error: any) {
    console.error('Pipeline error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed. Try again.',
      solution: null 
    }), { status: 200 });
  }
}
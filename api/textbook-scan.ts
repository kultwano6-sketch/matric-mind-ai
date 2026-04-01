// ============================================================
// Matric Mind AI - Textbook Scan API
// Advanced OCR for textbook pages using Groq vision
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const maxDuration = 60;
export const runtime = 'edge';

interface ScanResult {
  chapter: string;
  headings: string[];
  key_concepts: string[];
  questions: string[];
  formulas: string[];
  suggested_topics: string[];
}

interface TextbookScanRequest {
  student_id: string;
  subject: string;
  image_base64: string;
  chapter_hint?: string;
}

/**
 * POST /api/textbook-scan
 *
 * Scan a textbook page image and extract structured content.
 *
 * Body:
 * {
 *   student_id: string,
 *   subject: string,
 *   image_base64: string,
 *   chapter_hint?: string
 * }
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: TextbookScanRequest = await req.json();
    const { student_id, subject, image_base64, chapter_hint } = body;

    if (!student_id || !subject || !image_base64) {
      return new Response(JSON.stringify({ error: 'Missing required fields: student_id, subject, image_base64' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate image size (base64 should not exceed ~10MB)
    if (image_base64.length > 15_000_000) {
      return new Response(JSON.stringify({ error: 'Image too large. Maximum 10MB.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Prepare image data URL
    const imageDataUrl = image_base64.startsWith('data:')
      ? image_base64
      : `data:image/jpeg;base64,${image_base64}`;

    const subjectLabel = subject.replace(/_/g, ' ');

    // Build the prompt for structured extraction
    const scanPrompt = `You are an expert at scanning and analyzing South African Matric textbook pages.

Analyze this textbook page from a ${subjectLabel} textbook.
${chapter_hint ? `The student says this is from chapter: "${chapter_hint}"` : ''}

Extract the following structured information and return ONLY valid JSON:

{
  "chapter": "Detected chapter name/title",
  "headings": ["Main heading 1", "Subheading 1", "..."],
  "key_concepts": ["Concept 1", "Concept 2", "..."],
  "questions": ["Practice question 1", "Practice question 2", "..."],
  "formulas": ["Formula 1 in plain text", "Formula 2", "..."],
  "suggested_topics": ["Related quiz topic 1", "Related quiz topic 2", "..."]
}

Guidelines:
- chapter: The chapter title visible on the page, or infer it from content
- headings: All section headings and subheadings in order
- key_concepts: Important concepts, definitions, or terms introduced
- questions: Any practice questions, exercises, or problems visible
- formulas: Mathematical or scientific formulas (write in plain text that can be rendered as LaTeX)
- suggested_topics: 3-5 topics the student should quiz themselves on based on this content

Focus on accuracy. Only extract what's actually visible on the page.`;

    // Call Groq vision model
    const { text } = await generateText({
      model: groq('llama-3.2-11b-vision-preview'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: scanPrompt },
            {
              type: 'image',
              image: new URL(imageDataUrl),
            },
          ],
        },
      ],
      maxOutputTokens: 2048,
      temperature: 0.3, // Lower temperature for more accurate extraction
    });

    // Parse the response
    let scanResult: ScanResult;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      scanResult = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      // Fallback if parsing fails
      scanResult = {
        chapter: chapter_hint || 'Unknown Chapter',
        headings: [],
        key_concepts: [],
        questions: [],
        formulas: [],
        suggested_topics: [subjectLabel],
      };
    }

    // Validate and clean result
    scanResult = {
      chapter: scanResult.chapter || chapter_hint || 'Unknown Chapter',
      headings: Array.isArray(scanResult.headings) ? scanResult.headings : [],
      key_concepts: Array.isArray(scanResult.key_concepts) ? scanResult.key_concepts : [],
      questions: Array.isArray(scanResult.questions) ? scanResult.questions : [],
      formulas: Array.isArray(scanResult.formulas) ? scanResult.formulas : [],
      suggested_topics: Array.isArray(scanResult.suggested_topics) ? scanResult.suggested_topics : [subjectLabel],
    };

    // Extract text content for storage
    const extractedText = [
      `Chapter: ${scanResult.chapter}`,
      `Headings: ${scanResult.headings.join(', ')}`,
      `Key Concepts: ${scanResult.key_concepts.join(', ')}`,
      `Questions: ${scanResult.questions.join(' | ')}`,
      `Formulas: ${scanResult.formulas.join(' | ')}`,
    ].join('\n');

    // Save scan result to database
    const { data: savedScan } = await supabase
      .from('textbook_scans')
      .insert({
        student_id,
        subject,
        image_url: null, // Image stored externally if needed
        extracted_text: extractedText,
        chapters_detected: {
          chapter: scanResult.chapter,
          headings: scanResult.headings,
          key_concepts: scanResult.key_concepts,
          questions: scanResult.questions,
          formulas: scanResult.formulas,
          suggested_topics: scanResult.suggested_topics,
        },
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    // Log activity
    await supabase.from('activity_log').insert({
      user_id: student_id,
      action: 'textbook_scan',
      details: { scan_id: savedScan?.id, subject, chapter: scanResult.chapter },
    });

    return new Response(JSON.stringify({
      success: true,
      scan_id: savedScan?.id,
      result: scanResult,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Textbook scan error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Textbook scan failed',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

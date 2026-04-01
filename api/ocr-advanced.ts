import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 60;
export const runtime = 'edge';

interface OCRResult {
  detected_text: string;
  math_equations: MathEquation[];
  confidence: number;
  question_type: string;
  solution_steps: string[];
  final_answer: string;
  subject_hint: string;
}

interface MathEquation {
  original: string;
  latex: string;
  description: string;
}

/**
 * POST /api/ocr-advanced
 *
 * Advanced OCR with:
 * - Handwriting recognition
 * - Math equation extraction (LaTeX)
 * - Multi-step solution generation
 * - Confidence scoring
 *
 * Body:
 * {
 *   image_base64: string (data:image/...;base64,...)
 *   subject?: string
 *   context?: string (additional context about what the image contains)
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
    const body = await req.json();
    const { image_base64, subject, context } = body;

    if (!image_base64) {
      return new Response(JSON.stringify({ error: 'Missing image_base64' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate image format
    const imageMatch = image_base64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!imageMatch) {
      return new Response(JSON.stringify({ error: 'Invalid image format. Expected data:image/...;base64,...' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const imageType = imageMatch[1];
    const imageData = imageMatch[2];

    // Use Groq vision model for OCR and analysis
    const visionPrompt = `You are an expert OCR and math solver for South African Matric students.

Analyze this image and extract ALL text, math equations, and problems visible.

Image context: ${context || 'Student homework or exam question'}
Subject hint: ${subject || 'Unknown'}

CRITICAL: Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "detected_text": "All text found in the image, preserving layout as much as possible",
  "math_equations": [
    {
      "original": "The equation as it appears in the image",
      "latex": "LaTeX representation of the equation",
      "description": "Brief description of what the equation represents"
    }
  ],
  "confidence": 85,
  "question_type": "mcq | calculation | proof | word_problem | diagram_analysis | general",
  "subject_detected": "The specific subject area (e.g., Mathematics, Physical Sciences)",
  "solution_steps": [
    "Step 1: Identify what is being asked",
    "Step 2: Apply the relevant formula or concept",
    "Step 3: Calculate or derive the answer",
    "Step 4: State the final answer"
  ],
  "final_answer": "The final answer to the problem, clearly stated",
  "alternative_methods": ["Any alternative ways to solve this problem"],
  "common_mistakes": ["Common mistakes students make with this type of problem"],
  "caps_topics": ["Relevant CAPS curriculum topics"],
  "difficulty_level": "easy | medium | hard | expert"
}

Handwriting recognition rules:
- Interpret messy handwriting as best as possible
- For unclear characters, show the most likely interpretation with a note
- Preserve mathematical notation (fractions, exponents, square roots)
- Identify handwritten diagrams and describe them

Math equation rules:
- Convert all math to proper LaTeX notation
- Use \\frac{}{} for fractions, \\sqrt{} for square roots
- Use superscript ^ and subscript _ appropriately
- Represent Greek letters correctly (α, β, γ, etc.)

Solution rules:
- Provide step-by-step solutions
- Show all working
- Reference CAPS curriculum concepts
- Include units where applicable`;

    // Call Groq vision model
    const { text } = await generateText({
      model: groq('llama-3.2-11b-vision-preview'),
      system: 'You are an expert OCR system specializing in mathematical and scientific content. You output ONLY valid JSON.',
      prompt: visionPrompt,
      maxOutputTokens: 2048,
      temperature: 0.2, // Lower temperature for more accurate OCR
      experimental_providerMetadata: {
        groq: {
          image: `data:${imageType};base64,${imageData}`,
        },
      },
    });

    // Parse response
    let result: OCRResult;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse OCR result:', parseError);
      console.error('Raw response:', text.substring(0, 500));

      // Try to extract at least the text
      result = {
        detected_text: text,
        math_equations: [],
        confidence: 30,
        question_type: 'general',
        solution_steps: [],
        final_answer: 'Could not fully process the image. Please try with a clearer photo.',
        subject_hint: subject || 'Unknown',
      };
    }

    // Validate and enhance result
    if (!result.detected_text) {
      result.detected_text = 'No text detected in image';
    }
    if (!result.math_equations) {
      result.math_equations = [];
    }
    if (!result.solution_steps) {
      result.solution_steps = [];
    }
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 100) {
      result.confidence = 50;
    }

    // If we got text but no solution steps, generate them
    if (result.detected_text && result.solution_steps.length === 0 && subject) {
      try {
        const solutionPrompt = `Solve this ${subject} problem step by step:

Problem: ${result.detected_text}
${result.math_equations.length > 0 ? `Equations: ${result.math_equations.map(e => e.latex || e.original).join(', ')}` : ''}

Provide a clear step-by-step solution suitable for a Grade 12 Matric student. Reference relevant formulas and CAPS curriculum concepts.

Return ONLY the steps as a JSON array of strings: ["Step 1...", "Step 2...", "Final answer..."]`;

        const { text: solutionText } = await generateText({
          model: groq('llama-3.1-8b-instant'),
          system: 'You are a Matric tutor providing step-by-step solutions. Output ONLY a JSON array of strings.',
          prompt: solutionPrompt,
          maxOutputTokens: 1024,
          temperature: 0.3,
        });

        const stepsMatch = solutionText.match(/\[[\s\S]*\]/);
        if (stepsMatch) {
          const steps = JSON.parse(stepsMatch[0]);
          if (Array.isArray(steps)) {
            result.solution_steps = steps;
            result.final_answer = steps[steps.length - 1] || '';
          }
        }
      } catch (solutionError) {
        console.error('Solution generation error:', solutionError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ...result,
      image_type: imageType,
      processed_at: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Advanced OCR error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process image',
      message: error?.message || 'Unknown error',
      detected_text: '',
      math_equations: [],
      confidence: 0,
      solution_steps: [],
      final_answer: '',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

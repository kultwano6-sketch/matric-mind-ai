// api/snapsolve.ts — Snap & Solve (FIXED: Returns both reply and solution for compatibility)

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 60;
export const runtime = 'nodejs';

const FALLBACK_REPLY = "⚠️ AI failed to respond. Could not read image clearly. Please try again.";

// Helper to parse response into structured solution format
function parseSolution(text: string): { steps: string[], answer: string, explanation: string, tips: string[] } {
  const lines = text.split('\n').filter((s: string) => s.trim());
  
  // Find likely answer line
  const answerLine = lines.find((l: string) => 
    l.match(/^(answer|final|result|therefore|so|hence|thus)/i)
  ) || lines[lines.length - 1] || 'See solution above';
  
  return {
    steps: lines.slice(0, 8),
    answer: answerLine.replace(/^(answer|final|result|therefore|so|hence|thus)[:\s]*/i, '').trim() || 'See steps above',
    explanation: text.slice(0, 500),
    tips: ['Review the topic', 'Practice similar problems', 'Ask for clarification if needed']
  };
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  try {
    const body = await req.json();
    const { image, question, subject, context } = body;
    
    // Build the prompt
    let prompt = '';
    if (image && image.length > 100) {
      prompt = `Image uploaded. ${question || context || 'Solve this problem. Describe the problem shown in the image and provide a solution.'}`;
    } else {
      prompt = question || context || 'Solve this problem';
    }

    // Validate we have something to work with
    if (!prompt || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ 
        reply: "Please provide a question or image to solve.",
        solution: { question: question || context || 'Problem', steps: ['Provide a question'], answer: 'N/A', explanation: 'No question provided', tips: ['Try again'] }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Use Groq for text-based questions
    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        { 
          role: 'system', 
          content: `You are an expert South African matric tutor for ${subject || 'all subjects'}. CAPS Grade 12 curriculum. Provide clear step-by-step solutions with working. Format responses with numbered steps.` 
        },
        { role: 'user', content: prompt }
      ],
      maxTokens: 1500,
    });

    // Ensure non-empty response
    const reply = (text?.trim() || '').length > 0 ? text.trim() : FALLBACK_REPLY;
    
    // Parse into solution format
    const solution = parseSolution(reply);
    solution.question = question || context || 'Problem';

    // Return BOTH formats for backward compatibility
    return new Response(JSON.stringify({ 
      reply,
      solution
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('SnapSolve error:', e.message);
    // Always return valid response with fallback
    return new Response(JSON.stringify({ 
      reply: FALLBACK_REPLY,
      solution: { question: 'Problem', steps: ['Error occurred'], answer: 'N/A', explanation: FALLBACK_REPLY, tips: ['Try again'] }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
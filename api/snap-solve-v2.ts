// api/snap-solve-v2.ts — Enhanced Snap & Solve with OCR + AI

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 60;
export const runtime = 'nodejs';

const FALLBACK_REPLY = "⚠️ AI could not generate a response. Please try again.";

// Parse AI response into structured solution
function parseSolution(text: string, question: string): { 
  steps: string[], 
  answer: string, 
  explanation: string, 
  tips: string[],
  detected_subject: string,
  cleaned_question: string
} {
  const lines = text.split('\n').filter((s: string) => s.trim());
  
  // Find answer line
  const answerKeywords = ['answer', 'final', 'result', 'therefore', 'so', 'hence', 'thus', '=', 'solution is'];
  const answerLine = lines.find((l: string) => 
    answerKeywords.some(k => l.toLowerCase().includes(k))
  ) || lines[lines.length - 1] || '';
  
  // Detect subject from text
  let detected_subject = 'general';
  const lowerText = text.toLowerCase();
  if (lowerText.includes('calculus') || lowerText.includes('derivative') || lowerText.includes('integral')) detected_subject = 'calculus';
  else if (lowerText.includes('algebra') || lowerText.includes('equation') || lowerText.includes('solve for')) detected_subject = 'algebra';
  else if (lowerText.includes('physics') || lowerText.includes('force') || lowerText.includes('energy')) detected_subject = 'physics';
  else if (lowerText.includes('chemistry') || lowerText.includes('reaction') || lowerText.includes('mole')) detected_subject = 'chemistry';
  else if (lowerText.includes('trigonometry') || lowerText.includes('sin') || lowerText.includes('cos')) detected_subject = 'trigonometry';
  else if (lowerText.includes('geometry') || lowerText.includes('area') || lowerText.includes('perimeter')) detected_subject = 'geometry';
  
  return {
    steps: lines.slice(0, 10),
    answer: answerLine.replace(/^(answer|final|result|therefore|so|hence|thus)[:\s=*/-]*/i, '').trim() || 'See solution above',
    explanation: text.slice(0, 600),
    tips: [
      'Practice similar problems to reinforce understanding',
      'Review the underlying concepts',
      'Ask for clarification if any step is unclear',
      'Try explaining the solution to someone else'
    ],
    detected_subject,
    cleaned_question: question.trim()
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
    const { 
      image,           // Base64 image
      question,        // Optional text question
      subject,         // Subject preference
      context,         // Additional context
      action,          // 'solve' | 'explain_simpler' | 'similar' | 'followup'
      conversation_id, // For follow-up
      followup_question // For follow-up questions
    } = body;

    // Handle follow-up questions
    if (action === 'followup' && followup_question) {
      const { text } = await generateText({
        model: groq('llama-3.3-70b-versatile'),
        messages: [
          { 
            role: 'system', 
            content: `You are an expert South African matric tutor for ${subject || 'all subjects'}. CAPS Grade 12 curriculum. Provide clear, step-by-step explanations. Adapt to student level.` 
          },
          { 
            role: 'user', 
            content: `Previous question: ${question || 'N/A'}\nFollow-up question: ${followup_question}\n\nProvide a clear, concise answer.` 
          }
        ],
        maxTokens: 1000,
      });
      
      const reply = (text?.trim() || '').length > 0 ? text.trim() : FALLBACK_REPLY;
      
      return new Response(JSON.stringify({ 
        reply,
        conversation_id: conversation_id || `conv_${Date.now()}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle "explain simpler" action
    if (action === 'explain_simpler' && question) {
      const { text } = await generateText({
        model: groq('llama-3.3-70b-versatile'),
        messages: [
          { 
            role: 'system', 
            content: `You are an expert South African matric tutor. Explain concepts in VERY SIMPLE terms that a struggling Grade 12 student can understand. Use everyday examples. Avoid jargon.` 
          },
          { 
            role: 'user', 
            content: `Please explain this problem in the simplest possible way:\n\n${question}` 
          }
        ],
        maxTokens: 1000,
      });
      
      const reply = (text?.trim() || '').length > 0 ? text.trim() : FALLBACK_REPLY;
      
      return new Response(JSON.stringify({ 
        reply,
        type: 'simplified_explanation'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle "similar problems" action
    if (action === 'similar' && question) {
      const { text } = await generateText({
        model: groq('llama-3.3-70b-versatile'),
        messages: [
          { 
            role: 'system', 
            content: `You are an expert South African matric tutor. Generate similar practice problems at appropriate difficulty.` 
          },
          { 
            role: 'user', 
            content: `Generate 3 similar problems to this one (with answers):\n\n${question}\n\nFormat: 1. [problem] (answer)\n2. [problem] (answer)\n3. [problem] (answer)` 
          }
        ],
        maxTokens: 800,
      });
      
      const reply = (text?.trim() || '').length > 0 ? text.trim() : FALLBACK_REPLY;
      
      return new Response(JSON.stringify({ 
        reply,
        type: 'similar_problems'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Primary solve action
    let prompt = '';
    
    // If image provided, use it directly (Groq vision model)
    if (image && image.length > 100) {
      prompt = `Solve this problem from the image. Subject: ${subject || 'Mathematics'}. Provide step-by-step solution with clear working.`;
    } else if (question || context) {
      prompt = question || context || 'Solve this problem';
    } else {
      return new Response(JSON.stringify({ 
        reply: "Please provide an image or question to solve.",
        error: 'No input provided'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Use Groq vision model for image, or text model for text
    let text: string;
    if (image && image.length > 100) {
      // Use vision-capable model
      const result = await generateText({
        model: groq('llama-3.2-90b-vision-preview'),
        messages: [
          { 
            role: 'system', 
            content: `You are an expert South African matric tutor for ${subject || 'all subjects'}. CAPS Grade 12 curriculum. 

Your task:
1. Carefully analyze the image
2. Extract and rewrite the question clearly
3. Identify what type of problem it is (math, physics, chemistry, etc.)
4. Solve it step-by-step showing all working
5. Provide the final answer clearly

Format your response with:
- Question identified
- Step-by-step solution
- Final answer
- Key concepts to remember` 
          },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: prompt },
              { type: 'image', image: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` }
            ] as any
          }
        ],
        maxTokens: 2000,
      });
      text = result.text;
    } else {
      // Text-only question
      const result = await generateText({
        model: groq('llama-3.3-70b-versatile'),
        messages: [
          { 
            role: 'system', 
            content: `You are an expert South African matric tutor for ${subject || 'all subjects'}. CAPS Grade 12 curriculum. Provide clear step-by-step solutions with working. Format with numbered steps.` 
          },
          { role: 'user', content: prompt }
        ],
        maxTokens: 1500,
      });
      text = result.text;
    }

    // Ensure non-empty response
    const reply = (text?.trim() || '').length > 0 ? text.trim() : FALLBACK_REPLY;
    
    // Parse into solution format
    const solution = parseSolution(reply, prompt);

    // Return both formats for compatibility
    return new Response(JSON.stringify({ 
      reply,
      solution,
      conversation_id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('SnapSolve V2 error:', e.message);
    return new Response(JSON.stringify({ 
      reply: FALLBACK_REPLY,
      error: e.message
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
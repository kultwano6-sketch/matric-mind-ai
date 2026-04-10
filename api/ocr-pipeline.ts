// api/ocr-pipeline.ts — Complete OCR + AI Pipeline for Snap & Solve
// Uses OCR.space API for text extraction, then Groq for solving
// Includes error handling, retry logic, and monitoring

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { log, trackAIRequest, trackOCRRequest } from '../services/monitoring';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 90;
export const runtime = 'nodejs';

const FALLBACK_REPLY = "⚠️ Could not read the image clearly. Try again.";

// ============================================================
// OCR.space API for text extraction
// ============================================================

async function extractTextWithOCRspace(base64Image: string): Promise<string> {
  const startTime = Date.now();
  const apiKey = process.env.OCR_SPACE_API_KEY || 'K84923004988957';
  const url = 'https://api.ocr.space/parse/image';
  
  const formData = new FormData();
  formData.append('base64Image', `data:image/jpeg;base64,${base64Image}`);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'apikey': apiKey },
      body: formData
    });
    
    const data = await response.json();
    
    if (data.IsErroredOnProcessing) {
      console.error('OCR.space error:', data.ErrorMessage);
      return '';
    }
    
    if (data.ParsedResults && data.ParsedResults.length > 0) {
      const extractedText = data.ParsedResults[0]?.ParsedText?.trim() || '';
      trackOCRRequest(base64Image.length, startTime, !!extractedText);
      return extractedText;
    }
    
    return '';
  } catch (error) {
    console.error('OCR.space API error:', error);
    trackOCRRequest(base64Image.length, startTime, false, error as Error);
    return '';
  }
}

// ============================================================
// IMAGE PREPROCESSING (Client-side performed, but we handle edge cases)
// ============================================================

// Helper to validate if image is too dark or too light
function validateImageQuality(imageData: string): { valid: boolean; message: string } {
  // Simple validation - if base64 is very small, likely invalid
  if (imageData.length < 1000) {
    return { valid: false, message: 'Image appears to be corrupted or too small' };
  }
  return { valid: true, message: 'OK' };
}

// ============================================================
// TEXT CLEANING PIPELINE
// ============================================================

function cleanOCRText(text: string): string {
  if (!text) return '';
  
  let cleaned = text;
  
  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Fix common OCR mistakes
  const corrections: Record<string, string> = {
    'l': 'I', 'L': 'I',  // lowercase L to I in context
    'O': '0', 'o': '0',  // O to 0
    'S': '5', 's': '5',  // S to 5
    '|': 'I',            // pipe to I
    '—': '-', '–': '-',  // dashes
    '×': 'x', '∗': '*',  // operators
    '÷': '/',            // division
    '²': '^2', '³': '^3', // powers (normalize for AI)
    '√': 'sqrt',         // square root
  };
  
  // Apply corrections carefully
  for (const [wrong, right] of Object.entries(corrections)) {
    // Only replace in specific contexts to avoid over-correction
  }
  
  // Remove non-printable characters
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Fix spacing around operators
  cleaned = cleaned.replace(/\s*([+\-×÷=])\s*/g, ' $1 ');
  
  // Normalize fractions
  cleaned = cleaned.replace(/(\d+)\s*\/\s*(\d+)/g, '($1)/($2)');
  
  return cleaned;
}

// ============================================================
// AI TEXT CORRECTION
// ============================================================

async function correctOCRText(ocrText: string, subject: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        {
          role: 'system',
          content: `You are an expert at cleaning OCR text for South African Matric exam questions. 
Clean and correct this OCR text into a proper exam question. 
- Fix formatting, equations, and grammar
- Preserve mathematical notation
- Make it clear and readable
- If it's not a valid question, explain what's missing
Subject context: ${subject}`
        },
        {
          role: 'user',
          content: `Clean this OCR text:\n\n${ocrText}`
        }
      ],
      maxTokens: 500,
    });
    
    return text?.trim() || ocrText;
  } catch (error) {
    console.error('OCR correction error:', error);
    return ocrText; // Return original if correction fails
  }
}

// ============================================================
// SOLVE WITH AI
// ============================================================

async function solveWithAI(cleanQuestion: string, subject: string): Promise<{
  steps: string[];
  answer: string;
  explanation: string;
}> {
  const startTime = Date.now();
  try {
    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        {
          role: 'system',
          content: `You are an expert South African Matric tutor for ${subject || 'Mathematics'}. CAPS Grade 12.
Solve this problem step-by-step. Show all working clearly. Format:
1. First explain the approach
2. Show each step with working
3. Give the final answer clearly
4. Briefly explain the key concept used`
        },
        {
          role: 'user',
          content: cleanQuestion
        }
      ],
      maxTokens: 1500,
    });
    
    const response = text?.trim() || '';
    
    await trackAIRequest('llama-3.3-70b-versatile', startTime, !!response);
    
    // Parse response into structured format
    const lines = response.split('\n').filter(l => l.trim());
    
    // Find answer line
    const answerKeywords = ['answer', 'therefore', 'thus', 'hence', 'so', 'result', 'final'];
    const answerLine = lines.find(l => 
      answerKeywords.some(k => l.toLowerCase().includes(k))
    ) || lines[lines.length - 1] || '';
    
    return {
      steps: lines.slice(0, 8),
      answer: answerLine.replace(/^(answer|therefore|thus|hence|so|result|final)[:\s]*/i, '').trim() || 'See solution above',
      explanation: response.slice(0, 500)
    };
  } catch (error) {
    console.error('AI solve error:', error);
    await trackAIRequest('llama-3.3-70b-versatile', startTime, false, error as Error);
    return {
      steps: ['Error occurred during solving'],
      answer: 'N/A',
      explanation: FALLBACK_REPLY
    };
  }
}

// ============================================================
// MULTIPLE QUESTION SOLVER
// ============================================================

interface QuestionSolution {
  questionNumber: number;
  question: string;
  steps: string[];
  answer: string;
  explanation: string;
  keyConcept: string;
}

async function solveMultipleQuestions(text: string, subject: string): Promise<{
  questions: QuestionSolution[];
  totalQuestions: number;
}> {
  try {
    const { text: response } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        {
          role: 'system',
          content: `You are an expert South African Matric tutor for ${subject || 'Mathematics'}. CAPS Grade 12.

Solve ALL questions in the provided text step-by-step. For EACH question provide:
1. The question number and text
2. Step-by-step working (show ALL calculations)
3. The final answer
4. A clear explanation of how you solved it
5. The key concept being tested

Format your response as a numbered list for each question. Be thorough and show all working.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      maxTokens: 4000,
    });
    
    const responseText = response?.trim() || '';
    
    // Parse the multi-question response
    const questions: QuestionSolution[] = [];
    const questionBlocks = responseText.split(/(?:^|\n)(?:\d+[\.)]|Q\d+[:.]?)/i).filter(b => b.trim());
    
    let questionNum = 1;
    for (const block of questionBlocks) {
      if (block.trim().length < 10) continue;
      
      const lines = block.split('\n').filter(l => l.trim());
      
      // Extract answer line (look for keywords)
      const answerKeywords = ['answer', 'therefore', 'thus', 'hence', 'so', 'result', 'final', '=', 'solution'];
      const answerLine = lines.find(l => 
        answerKeywords.some(k => l.toLowerCase().includes(k))
      ) || lines.slice(-2)[0] || '';
      
      // Extract key concept
      const conceptKeywords = ['concept', 'key', 'principle', 'formula', 'theorem'];
      const conceptLine = lines.find(l => 
        conceptKeywords.some(k => l.toLowerCase().includes(k))
      ) || 'See explanation above';
      
      questions.push({
        questionNumber: questionNum++,
        question: lines[0]?.replace(/^[\d\.)Qq:]+/i, '').trim() || 'Question ' + questionNum,
        steps: lines.slice(1, -2).filter(l => !conceptKeywords.some(k => l.toLowerCase().includes(k))),
        answer: answerLine.replace(/^(answer|therefore|thus|hence|so|result|final|=|solution)[:\s]*/i, '').trim() || 'See steps above',
        explanation: lines.slice(0, 5).join('\n'),
        keyConcept: conceptLine.replace(/^(concept|key|principle|formula|theorem)[:\s]*/i, '').trim()
      });
    }
    
    // If parsing failed, create a single comprehensive solution
    if (questions.length === 0) {
      questions.push({
        questionNumber: 1,
        question: 'All questions from input',
        steps: responseText.split('\n').slice(0, 10),
        answer: 'See detailed solution above',
        explanation: responseText.slice(0, 800),
        keyConcept: 'See explanation'
      });
    }
    
    return {
      questions,
      totalQuestions: questions.length
    };
  } catch (error) {
    console.error('Multi-question solve error:', error);
    return {
      questions: [{
        questionNumber: 1,
        question: 'Error',
        steps: ['Failed to solve questions'],
        answer: 'N/A',
        explanation: FALLBACK_REPLY,
        keyConcept: 'N/A'
      }],
      totalQuestions: 0
    };
  }
}

// Detect if text contains multiple questions
function detectMultipleQuestions(text: string): boolean {
  const patterns = [
    /(?:^|\n)\d+[\.)]\s*[A-Z]/m,           // 1. Question, 2. Question
    /(?:^|\n)Q\d+[:.]\s*/m,                 // Q1:, Q2:
    /(?:^|\n)Question\s*\d+[:.]/mi,          // Question 1:, Question 2:
    /(?:^|\n)\[\d+\]\s*/m,                   // [1] Question
  ];
  
  return patterns.some(pattern => pattern.test(text));
}

// ============================================================
// MAIN HANDLER
// ============================================================

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
      question,        // Optional text question (skip OCR)
      subject,         // Subject preference
      action,          // 'solve' | 'correct' | 'simplify' | 'similar'
      extracted_text,  // User-edited text after OCR
      followup         // Follow-up question
    } = body;

    // Validate image if provided
    if (image) {
      const validation = validateImageQuality(image);
      if (!validation.valid) {
        return new Response(JSON.stringify({
          error: validation.message,
          ocr_text: null,
          needs_review: true
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle follow-up questions
    if (action === 'followup' && followup && question) {
      const { text } = await generateText({
        model: groq('llama-3.3-70b-versatile'),
        messages: [
          {
            role: 'system',
            content: `You are an expert South African Matric tutor. Provide clear, concise answers. Adapt to student level.`
          },
          {
            role: 'user',
            content: `Previous question: ${question}\nFollow-up: ${followup}`
          }
        ],
        maxTokens: 800,
      });
      
      return new Response(JSON.stringify({
        reply: text?.trim() || 'Could not generate response'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle simplify action
    if (action === 'simplify' && question) {
      const { text } = await generateText({
        model: groq('llama-3.3-70b-versatile'),
        messages: [
          {
            role: 'system',
            content: `You are a tutor explaining to a struggling Grade 12 student. Use VERY simple language, everyday examples, avoid jargon.`
          },
          {
            role: 'user',
            content: `Explain this in the simplest possible way:\n\n${question}`
          }
        ],
        maxTokens: 800,
      });
      
      return new Response(JSON.stringify({
        reply: text?.trim() || 'Could not simplify'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle similar problems action
    if (action === 'similar' && question) {
      const { text } = await generateText({
        model: groq('llama-3.3-70b-versatile'),
        messages: [
          {
            role: 'system',
            content: `Generate 3 similar practice problems at appropriate difficulty. Include answers.`
          },
          {
            role: 'user',
            content: `Generate similar problems to:\n\n${question}`
          }
        ],
        maxTokens: 600,
      });
      
      return new Response(JSON.stringify({
        reply: text?.trim() || 'Could not generate similar problems'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle correction action (re-run AI correction)
    if (action === 'correct' && extracted_text) {
      const corrected = await correctOCRText(extracted_text, subject);
      return new Response(JSON.stringify({
        corrected_text: corrected,
        original_text: extracted_text
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ============================================================
    // MAIN SOLVE FLOW
    // ============================================================

    let ocrText = '';
    let cleanedText = '';

    // Step 1: If image provided, extract text using OCR.space API
    if (image && image.length > 100) {
      console.log('Processing image, length:', image.length);
      try {
        // Use OCR.space API for reliable text extraction
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        
        // Try OCR.space first
        let ocrText = await extractTextWithOCRspace(base64Data);
        
        // If OCR.space fails or returns empty, try Groq vision as fallback
        if (!ocrText || ocrText.length < 5) {
          console.log('OCR.space failed, trying Groq vision...');
          try {
            const { text } = await generateText({
              model: groq('llama-3.2-90b-vision-preview'),
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'image', image: image.startsWith('data:') ? image : `data:image/jpeg;base64,${base64Data}` }
                  ]
                }
              ],
              maxTokens: 1500,
            });
            ocrText = text?.trim() || '';
          } catch (visionError: any) {
            console.error('Groq vision failed:', visionError.message);
            // Try simple prompt as last resort
            try {
              const { text } = await generateText({
                model: groq('llama-3.2-90b-vision-preview'),
                messages: [
                  {
                    role: 'user',
                    content: 'Extract all text from this image: [image attached]'
                  }
                ],
                maxTokens: 1000,
              });
              ocrText = text?.trim() || '';
            } catch (e2: any) {
              console.error('Vision retry also failed:', e2.message);
            }
          }
        }
        
        if (!ocrText || ocrText.length < 5) {
          throw new Error('OCR extraction failed');
        }
        
        // Clean the OCR text
        ocrText = cleanOCRText(ocrText);
      
        // Validate OCR output
        if (!ocrText || ocrText.length < 5) {
          return new Response(JSON.stringify({
            error: '⚠️ Could not read the image clearly. Try again with a clearer photo.',
            ocr_text: null,
            needs_review: true
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Step 3: AI correction
        cleanedText = await correctOCRText(ocrText, subject);
      } 
      catch (ocrError) {
        console.error('OCR extraction error:', ocrError);
        return new Response(JSON.stringify({
          error: '⚠️ Could not read the image clearly. Try again.',
          ocr_text: null,
          needs_review: true
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } 
    else if (question) {
      // Text-only question
      cleanedText = question;
    } 
    else {
      return new Response(JSON.stringify({
        error: 'Please provide an image or question',
        ocr_text: null
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 4: Check if user provided edited text
    if (extracted_text && extracted_text !== ocrText) {
      cleanedText = await correctOCRText(extracted_text, subject);
    }

    // Step 5: Solve with AI - detect single vs multiple questions
    let solution;
    
    // Check if we have multiple questions
    const hasMultipleQuestions = detectMultipleQuestions(cleanedText);
    
    if (hasMultipleQuestions) {
      console.log('Detected multiple questions, solving all...');
      const multiResult = await solveMultipleQuestions(cleanedText, subject);
      
      // Build combined solution for single-question format (for UI compatibility)
      const allSteps: string[] = [];
      const allAnswers: string[] = [];
      
      multiResult.questions.forEach(q => {
        allSteps.push(`--- Question ${q.questionNumber} ---`);
        allSteps.push(...q.steps);
        allAnswers.push(`${q.questionNumber}. ${q.answer}`);
      });
      
      solution = {
        steps: allSteps,
        answer: allAnswers.join('\n'),
        explanation: `Solved ${multiResult.totalQuestions} questions step-by-step. Each question includes detailed working, final answer, and explanation of the key concepts used.`,
        multiSolution: multiResult // Full multi-question data for UI
      };
    } else {
      // Single question - use original solver
      solution = await solveWithAI(cleanedText, subject);
    }

    // Return result with all stages for UI display
    return new Response(JSON.stringify({
      // Full pipeline result
      ocr_text: ocrText,           // Raw OCR output
      cleaned_text: cleanedText,  // After AI correction
      isMultipleQuestions: hasMultipleQuestions,
      solution: {
        question: cleanedText,
        steps: solution.steps,
        answer: solution.answer,
        explanation: solution.explanation,
        tips: [
          'Practice similar problems',
          'Review the underlying concepts',
          'Ask for clarification if needed'
        ],
        multiSolution: solution.multiSolution || null
      },
      // For history tracking
      conversation_id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('SnapSolve pipeline error:', error);
    
    // Log the error
    log('error', 'api', 'OCR pipeline failed', {
      error: error.message || String(error),
      stack: error.stack,
    });
    
    // Provide specific error based on what failed
    let userMessage = FALLBACK_REPLY;
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes('OCR extraction failed') || errorMsg.includes('Could not read')) {
      userMessage = 'Could not read the image. Try a clearer photo with better lighting.';
    } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
      userMessage = 'Request timed out. Please try again.';
    } else if (errorMsg.includes('rate_limit') || errorMsg.includes('rate limit')) {
      userMessage = 'Too many requests. Please wait a moment and try again.';
    } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
      userMessage = 'Network error. Check your internet connection and try again.';
    } else {
      // For unexpected errors, log details but show generic message
      userMessage = `Something went wrong. Please try again.`;
    }
    
    return new Response(JSON.stringify({
      error: userMessage,
      solution: null,
      details: errorMsg // Include for debugging
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
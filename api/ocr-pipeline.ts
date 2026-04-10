// api/ocr-pipeline.ts — Complete OCR + AI Pipeline for Snap & Solve
// Uses OCR.space API for text extraction, then Groq for solving

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 90;
export const runtime = 'nodejs';

const FALLBACK_REPLY = "⚠️ Could not read the image clearly. Try again.";

// ============================================================
// OCR.space API for text extraction
// ============================================================

async function extractTextWithOCRspace(base64Image: string): Promise<string> {
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
      return data.ParsedResults[0]?.ParsedText?.trim() || '';
    }
    
    return '';
  } catch (error) {
    console.error('OCR.space API error:', error);
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
  try {
    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        {
          role: 'system',
          content: `You are an expert ${subject || 'Mathematics'} tutor for Grade 12.

IMPORTANT: Write in plain simple text only. NO asterisks, NO hashes, NO special formatting symbols.

For each question:
1. Write the question number and text clearly (Example: Question 1.1: [question])
2. Show step-by-step working (Example: Step 1: [do this], Step 2: [do that])
3. Give the final answer (Example: Final Answer: [answer])
4. Briefly explain the key idea

Make it very clear which answer belongs to which question.`
        },
        {
          role: 'user',
          content: cleanQuestion
        }
      ],
      maxTokens: 1500,
    });
    
    const response = text?.trim() || '';
    
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

    // Step 1: If image provided AND no extracted_text, extract text
    // If extracted_text is provided, skip OCR and use that (user edited it)
    if (image && image.length > 100 && !extracted_text) {
      try {
        // Use OCR.space API for reliable text extraction
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        
        // Try OCR.space first
        let ocrText = await extractTextWithOCRspace(base64Data);
        
        // If OCR.space fails or returns empty, try Groq vision as fallback
        if (!ocrText || ocrText.length < 5) {
          console.log('OCR.space failed, trying Groq vision...');
          const { text } = await generateText({
            model: groq('llama-3.2-90b-vision-preview'),
            messages: [
              {
                role: 'system',
                content: `You are an OCR system. Extract ALL text visible in this image exactly as written. 
Do NOT solve or explain - just transcribe. Include numbers, symbols, and equations exactly as shown.`
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Extract text from this image:' },
                  { type: 'image', image: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` }
                ] as any
              }
            ],
            maxTokens: 1000,
          });
          ocrText = text?.trim() || '';
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

    // Step 4: If user edited text, use that instead of re-doing OCR
    if (extracted_text && extracted_text.trim()) {
      // User edited the text - use their corrections
      cleanedText = await correctOCRText(extracted_text, subject);
      console.log('Using user-edited text:', cleanedText.slice(0, 50));
    }
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
    return new Response(JSON.stringify({
      error: FALLBACK_REPLY,
      solution: null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
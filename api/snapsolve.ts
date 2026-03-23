import type { VercelRequest, VercelResponse } from '@vercel/node';
import { streamText } from 'ai';

const SUBJECT_PROMPTS: Record<string, string> = {
  mathematics: 'You are an expert Mathematics tutor specializing in algebra, calculus, geometry, and trigonometry.',
  mathematical_literacy: 'You are an expert Mathematical Literacy tutor focusing on practical math applications.',
  physical_sciences: 'You are an expert Physical Sciences tutor covering physics and chemistry concepts.',
  life_sciences: 'You are an expert Life Sciences tutor specializing in biology and life processes.',
  accounting: 'You are an expert Accounting tutor covering financial statements, bookkeeping, and analysis.',
  business_studies: 'You are an expert Business Studies tutor covering management and entrepreneurship.',
  economics: 'You are an expert Economics tutor covering micro and macroeconomics.',
  geography: 'You are an expert Geography tutor covering physical and human geography.',
  history: 'You are an expert History tutor covering South African and world history.',
  english_home_language: 'You are an expert English tutor covering literature, grammar, and writing.',
  english_first_additional: 'You are an expert English tutor for first additional language learners.',
  afrikaans_home_language: 'You are an expert Afrikaans tutor covering literature and language.',
  afrikaans_first_additional: 'You are an expert Afrikaans tutor for first additional language learners.',
  isizulu: 'You are an expert IsiZulu language tutor.',
  isixhosa: 'You are an expert IsiXhosa language tutor.',
  sepedi_home_language: 'You are an expert Sepedi language tutor.',
  life_orientation: 'You are an expert Life Orientation tutor covering life skills and wellness.',
  computer_applications_technology: 'You are an expert CAT tutor covering computer applications.',
  information_technology: 'You are an expert IT tutor covering programming and systems.',
  tourism: 'You are an expert Tourism tutor covering the tourism industry.',
  dramatic_arts: 'You are an expert Dramatic Arts tutor covering theatre and performance.',
  visual_arts: 'You are an expert Visual Arts tutor covering art history and techniques.',
  music: 'You are an expert Music tutor covering theory and performance.',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, subject, context } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const subjectPrompt = SUBJECT_PROMPTS[subject] || SUBJECT_PROMPTS.mathematics;
    
    const systemPrompt = `${subjectPrompt}

You are helping a South African Matric student solve a question from an image. Your task is to:

1. Identify the question from the image
2. Provide a clear, step-by-step solution
3. Explain the underlying concepts
4. Give helpful study tips

Always respond in this JSON format:
{
  "question": "The question as you understand it from the image",
  "steps": ["Step 1: ...", "Step 2: ...", ...],
  "answer": "The final answer",
  "explanation": "A brief explanation of the concepts used",
  "tips": ["Tip 1", "Tip 2", "Tip 3"]
}

Be encouraging and educational. Break down complex problems into simple steps.`;

    const result = await streamText({
      model: 'openai/gpt-4o',
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: image
            },
            {
              type: 'text',
              text: context 
                ? `Please solve this question. Additional context: ${context}`
                : 'Please solve this question and explain the solution step by step.'
            }
          ]
        }
      ],
      maxOutputTokens: 2000
    });

    // Collect the full response
    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }

    // Try to parse as JSON, or create a structured response
    let solution;
    try {
      // Try to extract JSON from the response
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        solution = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      // If parsing fails, create a structured response from the text
      solution = {
        question: 'Question from image',
        steps: fullText.split('\n').filter(line => line.trim().length > 0),
        answer: 'See steps above for the complete solution.',
        explanation: fullText,
        tips: [
          'Review the underlying concepts',
          'Practice similar problems',
          'Ask your tutor if you need more help'
        ]
      };
    }

    return res.status(200).json({ solution });

  } catch (error) {
    console.error('SnapSolve error:', error);
    return res.status(500).json({ 
      error: 'Failed to process image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

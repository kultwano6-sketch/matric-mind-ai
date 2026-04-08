// api/generate-quiz.ts — Generate a quiz using AI

import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })


const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// South African CAPS Curriculum Guide for Grade 12
const CURRICULUM_GUIDE = `
SOUTH AFRICAN CAPS CURRICULUM - GRADE 12 (MATRIC)

MATHEMATICS:
- Algebra: Equations, inequalities, exponential functions, logarithmic functions, quadratic sequences
- Calculus: Differentiation, integration, calculus applications (optimization, rates of change)
- Geometry: Co-ordinate geometry, Euclidean geometry, trigonometry
- Statistics: Data handling, probability, regression analysis
- Finance: Interest, investments, depreciation

PHYSICAL SCIENCES:
- Mechanics: Newton's laws, momentum, impulse, vertical projectile motion, gravitational energy
- Waves & Sound: Wave equation, electromagnetic spectrum, sound waves, Doppler effect
- Electricity: Electric circuits, Ohm's law, resistors, internal resistance, capacitance
- Optics: Light, lenses, mirrors, optical phenomena
- Matter: Materials, ideal gases, thermodynamics
- Chemistry: Chemical reactions, equilibrium, acids/bases, electrochemistry, organic chemistry

LIFE SCIENCES:
- Cell Biology: Cell structure, photosynthesis, respiration, enzymes
- Genetics: DNA/RNA, inheritance, genetic engineering, evolution
- Ecology: Ecosystems, biodiversity, conservation, population ecology
- Human Systems: Nervous system, endocrine system, homeostasis, immune system
- Diversity: Classification, adaptations, plant/animal kingdoms

ENGLISH:
- Literature: Novels, poetry, drama analysis
- Language: Grammar, vocabulary, comprehension, creative writing
- Comprehension: Analysis, inference, evaluation
- Essay Writing: Argumentative, descriptive, narrative

ACCOUNTING:
- Financial Statements: Income statement, balance sheet, cash flow
- Budgeting: Cash budgets, variance analysis
- Cost Accounting: Cost classification, break-even analysis
- Assets: Fixed assets, depreciation, inventory
- Partnerships/Companies: Ledger accounts, final accounts

GEOGRAPHY:
- Physical: Geomorphology, climate, hydrology, vegetation
- Human: Population, settlement, economic activities
- GIS: Remote sensing, map interpretation
- Environmental: Conservation, sustainable development

HISTORY:
- South African History: Apartheid, liberation movements, post-1994
- World History: Cold War, decolonization, global conflicts
- Political: Governance, citizenship, human rights
- Economic: Industrial revolution, globalization

ECONOMICS:
- Microeconomics: Demand, supply, market equilibrium, elasticity
- Macroeconomics: GDP, inflation, unemployment, fiscal policy, monetary policy
- Development: Economic growth, development indicators
- Markets: Perfect competition, monopoly, oligopoly

ALL SUBJECTS:
- Questions must follow CAPS assessment guidelines
- Include recall, application, analysis and synthesis questions
- Use appropriate technical terminology
- Questions should be exam-style and challenging
- Include step-by-step explanations for maths/science
- Ensure content is accurate and curriculum-aligned
`;

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { subject, topic, difficulty, count, question_types } = body;

  if (!subject) {
    return new Response(JSON.stringify({ error: 'subject is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const questionCount = Math.min(Math.max(parseInt(count, 10) || 5, 1), 20);
  const difficultyLevel = difficulty || 'medium';

  try {
    const { text: content } = await openai.chat.completions.create({
      model: gpt-4o-mini),
      messages: [
        {
          role: 'system',
          content: `You are a South African Matric (Grade 12) quiz generator following the CAPS curriculum.
          
${CURRICULUM_GUIDE}

Generate exactly ${questionCount} questions for: ${subject}
${topic ? `Topic: ${topic}` : 'Cover core curriculum topics'}
Difficulty: ${difficultyLevel}

IMPORTANT REQUIREMENTS:
1. ALL questions must follow South African CAPS curriculum for Grade 12
2. Use appropriate South African subject terminology
3. Questions should be exam-style and aligned with NSC (National Senior Certificate) standards
4. Include step-by-step working for math/science questions
5. Topics must be curriculum-appropriate for ${subject} Matric

Return ONLY valid JSON with this exact structure:
{
  "title": "Quiz title",
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "question": "Question text",
      "options": {"A": "option1", "B": "option2", "C": "option3", "D": "option4"},
      "correct_answer": "A",
      "marks": 1,
      "topic": "curriculum topic",
      "explanation": "step-by-step explanation"
    }
  ]
}

Return ONLY JSON - no markdown, no backticks, no explanation.`,
        },
      ],
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '4096', 10),
      temperature: 0.7,
    });

    if (!content) {
      return new Response(JSON.stringify({ error: 'Failed to generate quiz content' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse the JSON response - strip markdown code fences if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let quizData;
    try {
      quizData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse quiz JSON:', cleanedContent);
      return new Response(JSON.stringify({ error: 'Failed to parse generated quiz' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      return new Response(JSON.stringify({ error: 'Invalid quiz format generated' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(quizData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Generate Quiz API Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate quiz',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

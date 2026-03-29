import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const maxDuration = 30

const SUBJECT_PROMPTS: Record<string, string> = {
  mathematics: `You are a South African Matric Mathematics tutor. Topics: algebra, calculus, geometry, trigonometry, statistics.`,
  mathematical_literacy: `You are a South African Matric Mathematical Literacy tutor. Topics: budgets, loans, measurement, data handling.`,
  physical_sciences: `You are a South African Matric Physical Sciences tutor. Topics: mechanics, waves, electricity, chemical bonding, stoichiometry.`,
  life_sciences: `You are a South African Matric Life Sciences tutor. Topics: cells, genetics, evolution, human physiology, ecology.`,
  accounting: `You are a South African Matric Accounting tutor. Topics: financial statements, bookkeeping, adjustments, partnerships.`,
  business_studies: `You are a South African Matric Business Studies tutor. Topics: business environments, operations, ethics, management.`,
  economics: `You are a South African Matric Economics tutor. Topics: microeconomics, macroeconomics, GDP, inflation, SA economy.`,
  geography: `You are a South African Matric Geography tutor. Topics: climate, settlements, GIS, mapwork, resources.`,
  history: `You are a South African Matric History tutor. Topics: Cold War, apartheid, democracy, globalisation.`,
  english_home_language: `You are a South African Matric English Home Language tutor. Topics: literature, essays, language conventions.`,
  english_first_additional: `You are a South African Matric English FAL tutor. Topics: comprehension, summary, writing, grammar.`,
  life_orientation: `You are a South African Matric Life Orientation tutor. Topics: self-development, careers, study skills, human rights.`,
  information_technology: `You are a South African Matric Information Technology tutor. Topics: programming (Delphi/Java), algorithms, SQL, data structures.`,
}

const DEFAULT_PROMPT = `You are a South African Matric tutor. Help with any subject.`

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const { image, subject, context } = body as {
      image?: string
      subject?: string
      context?: string
    }

    if (!image && !context) {
      return new Response(
        JSON.stringify({ error: 'Please provide an image or text context describing the question' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const subjectPrompt = subject ? SUBJECT_PROMPTS[subject] || DEFAULT_PROMPT : DEFAULT_PROMPT

    // Build the user question from available context
    const userQuestion = context
      ? context
      : 'A student has uploaded an image of a question. Please provide a general approach for solving questions in this subject area.'

    const systemPrompt = `${subjectPrompt}

You are helping a student solve a specific question. Analyse the question and respond with ONLY valid JSON in this exact format (no markdown fences, no extra text):

{
  "question": "the question text (restate it clearly)",
  "steps": ["step 1 explanation", "step 2 explanation", "step 3 explanation"],
  "answer": "the final answer",
  "explanation": "a detailed explanation of the concept and why this answer is correct",
  "tips": ["study tip 1 related to this topic", "study tip 2 related to this topic"]
}

Rules:
- Use simple, clear language a Matric student can understand
- Show all working in the steps
- Reference CAPS curriculum where relevant
- Include at least 3 steps and 2 tips
- Respond with ONLY the JSON object, no other text`

    const { text } = await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: systemPrompt,
      prompt: userQuestion,
      maxOutputTokens: 1024,
      temperature: 0.1,
    })

    // Parse the JSON response
    let solution
    try {
      // Strip markdown fences if the model wraps them anyway
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      solution = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse snapsolve response:', text)
      // Return a fallback solution
      solution = {
        question: context || 'Uploaded question',
        steps: [
          'Read the question carefully and identify what is being asked.',
          'Write down the given information and relevant formulas.',
          'Apply the appropriate method to solve step by step.',
        ],
        answer: 'Unable to parse a structured answer. Please try again with a clearer question.',
        explanation: text,
        tips: [
          'Make sure your photo is clear and well-lit',
          'Try adding text context describing the question',
        ],
      }
    }

    // Validate and fill in missing fields
    const response = {
      solution: {
        question: solution.question || context || 'Detected question',
        steps: Array.isArray(solution.steps) ? solution.steps : ['Step-by-step solution not available'],
        answer: solution.answer || 'Answer not available',
        explanation: solution.explanation || 'Explanation not available',
        tips: Array.isArray(solution.tips) ? solution.tips : ['Review this topic in your textbook'],
      },
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('SnapSolve error:', error)
    return new Response(JSON.stringify({ error: 'Failed to process question. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

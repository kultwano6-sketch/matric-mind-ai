// Add this import at the top of api/generate-quiz.ts:
import { z } from 'zod'

// Add this schema after the imports:
const QuizQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.object({
    A: z.string().min(1),
    B: z.string().min(1),
    C: z.string().min(1),
    D: z.string().min(1),
  }),
  correct: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().min(1),
})

const QuizQuestionsSchema = z.array(QuizQuestionSchema).min(1)

// Then REPLACE the JSON.parse block (around line 105-120) with:

    // Parse the JSON response
    let questions
    try {
      // Strip markdown fences if the model wraps them anyway
      let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      // Try to find JSON array in the response
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        cleaned = jsonMatch[0]
      }
      
      const parsed = JSON.parse(cleaned)
      
      // Validate with Zod — catches malformed questions
      const validation = QuizQuestionsSchema.safeParse(parsed)
      if (!validation.success) {
        console.error('Quiz validation errors:', validation.error.issues)
        return new Response(JSON.stringify({ 
          error: 'Generated questions failed validation',
          details: validation.error.issues.map(i => i.message).join(', '),
          questions: [],
        }), { status: 200 })
      }
      
      questions = validation.data
      console.log('Parsed and validated questions count:', questions.length)
    } catch (e: any) {
      console.error('Failed to parse quiz JSON:', response.substring(0, 500))
      return new Response(JSON.stringify({ 
        error: 'Failed to parse questions',
        questions: [],
        rawResponse: response.substring(0, 200)
      }), { status: 200 })
    }

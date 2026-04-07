// src/services/ai.ts — Unified AI Service
// FIXED: Use /api/tutor endpoint, standardize request format, add fallbacks

const API_BASE = import.meta.env.VITE_API_URL || '';

// Fallback messages for different scenarios
const FALLBACK_MESSAGES = {
  empty: 'I\'m here to help you learn! Ask me any question about your subjects.',
  error: '⚠️ I\'m having trouble connecting right now. Please try again.',
  invalid: 'I didn\'t quite understand that. Could you try asking in a different way?',
};

/**
 * Main AI chat function - uses unified /api/tutor endpoint
 * Standardized request: { message: string, subject?: string }
 * Standardized response: { reply: string }
 */
export const askAI = async (
  message: string, 
  options?: { subject?: string; student_context?: any }
): Promise<string> => {
  // Validate input
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    console.warn('Empty message provided to askAI');
    return FALLBACK_MESSAGES.empty;
  }

  try {
    // Use unified /api/tutor endpoint with standardized format
    const res = await fetch(`${API_BASE}/api/tutor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        message: message.trim(),
        subject: options?.subject || 'general',
        student_context: options?.student_context || null,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'Unknown error');
      console.error(`AI API error ${res.status}:`, errorBody);
      return FALLBACK_MESSAGES.error;
    }

    const data = await res.json();

    // Validate response has reply
    if (!data.reply || typeof data.reply !== 'string' || data.reply.trim().length === 0) {
      console.warn('Empty reply from AI:', data);
      // Return fallback instead of throwing
      return data.fallback ? data.reply : FALLBACK_MESSAGES.invalid;
    }

    return data.reply.trim();

  } catch (error) {
    console.error('AI Error:', error);
    return FALLBACK_MESSAGES.error;
  }
};

/**
 * Simplified version for backward compatibility
 * @deprecated Use askAI with options instead
 */
export const askAIDirect = async (prompt: string): Promise<string> => {
  return askAI(prompt);
};

/**
 * Generate a quiz - uses generate-quiz endpoint
 */
export const generateQuiz = async (
  subject: string, 
  difficulty: string = 'medium', 
  questionCount: number = 10,
  topic?: string
): Promise<any> => {
  try {
    const res = await fetch(`${API_BASE}/api/generate-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        subject, 
        difficulty, 
        questionCount,
        topic: topic || '',
      }),
    });
    
    if (!res.ok) {
      throw new Error(`Quiz generation failed: ${res.status}`);
    }
    
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Quiz generation error:', error);
    throw error;
  }
};

/**
 * Submit quiz answers for grading
 */
export const submitQuiz = async (
  subject: string, 
  questions: any[], 
  answers: Record<string, string>
): Promise<any> => {
  try {
    const res = await fetch(`${API_BASE}/api/grade-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, questions, answers }),
    });
    
    if (!res.ok) {
      throw new Error(`Quiz submission failed: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Quiz submission error:', error);
    throw error;
  }
};

/**
 * Get student's quiz history
 */
export const getQuizHistory = async (studentId?: string): Promise<any[]> => {
  try {
    const res = await fetch(`${API_BASE}/api/quiz-history${studentId ? `?student_id=${studentId}` : ''}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!res.ok) {
      return [];
    }
    
    const data = await res.json();
    return data.quizzes || [];
  } catch (error) {
    console.error('Quiz history error:', error);
    return [];
  }
};

/**
 * Get adaptive learning recommendations
 */
export const getLearningRecommendations = async (studentId: string): Promise<any> => {
  try {
    const res = await fetch(`${API_BASE}/api/adaptive-learning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId }),
    });
    
    if (!res.ok) {
      throw new Error(`Adaptive learning failed: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Adaptive learning error:', error);
    return { recommendation: null };
  }
};

/**
 * Get readiness score for student
 */
export const getReadinessScore = async (studentId: string): Promise<any> => {
  try {
    const res = await fetch(`${API_BASE}/api/readiness-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId }),
    });
    
    if (!res.ok) {
      throw new Error(`Readiness score failed: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Readiness score error:', error);
    return null;
  }
};

/**
 * Teacher assistant - generate lesson plans, worksheets, quizzes
 */
export const teacherGenerateContent = async (
  action: 'lesson_plan' | 'worksheet' | 'quiz',
  subject: string,
  topic: string,
  options?: { grade?: number; difficulty?: string; num_questions?: number }
): Promise<any> => {
  try {
    const res = await fetch(`${API_BASE}/api/teacher-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action, 
        subject, 
        topic,
        grade: options?.grade || 12,
        difficulty: options?.difficulty || 'medium',
        num_questions: options?.num_questions || 10,
      }),
    });
    
    if (!res.ok) {
      throw new Error(`Teacher assistant failed: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Teacher assistant error:', error);
    throw error;
  }
};

// Export default for convenience
export default {
  askAI,
  askAIDirect,
  generateQuiz,
  submitQuiz,
  getQuizHistory,
  getLearningRecommendations,
  getReadinessScore,
  teacherGenerateContent,
};
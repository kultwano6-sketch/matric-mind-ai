// ============================================================
// Matric Mind AI - Exam Simulator Service
// Manages exam simulation state, timers, and scoring
// ============================================================

import { supabase } from '@/integrations/supabase/client';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================
// Types
// ============================================================

export interface ExamQuestion {
  id: number;
  type: 'mcq' | 'short_answer' | 'long_answer';
  question: string;
  options?: Record<string, string>;
  correct_answer: string;
  marks: number;
  topic: string;
  marking_criteria: string[];
  section?: string;
}

export interface ExamSection {
  name: string;
  questions: ExamQuestion[];
}

export interface ExamPaper {
  exam_id: string;
  title: string;
  instructions: string;
  total_marks: number;
  time_limit_min: number;
  sections: ExamSection[];
  questions: ExamQuestion[];
  marking_rubric: Array<{
    id: number;
    topic: string;
    marks: number;
    criteria: string[];
  }>;
}

export interface ExamState {
  exam: ExamPaper | null;
  answers: Record<number, string>;
  flagged: Set<number>;
  currentQuestionIndex: number;
  startTime: Date | null;
  endTime: Date | null;
  isSubmitted: boolean;
  timeRemaining: number; // seconds
}

export interface ExamResult {
  exam_id: string;
  score: number;
  total_marks: number;
  percentage: number;
  grade: string;
  question_breakdown: Array<{
    id: number;
    correct: boolean;
    marks_earned: number;
    max_marks: number;
    topic: string;
    feedback: string;
  }>;
  topic_performance: Record<string, { correct: number; total: number; pct: number }>;
  ai_feedback: string;
  time_taken_min: number;
  recommendations: string[];
}

export interface ExamConfig {
  time: number;
  marks: number;
  sections: string[];
}

// ============================================================
// Exam Configurations per Subject
// ============================================================

export const EXAM_CONFIGS: Record<string, ExamConfig> = {
  mathematics: { time: 180, marks: 150, sections: ['Algebra', 'Calculus', 'Geometry', 'Trigonometry', 'Statistics'] },
  mathematical_literacy: { time: 150, marks: 100, sections: ['Finance', 'Measurement', 'Maps', 'Data Handling', 'Probability'] },
  physical_sciences: { time: 180, marks: 150, sections: ['Physics', 'Chemistry', 'Mechanics', 'Energy', 'Reactions'] },
  life_sciences: { time: 150, marks: 150, sections: ['Cells', 'Genetics', 'Evolution', 'Ecology', 'Human Biology'] },
  accounting: { time: 180, marks: 150, sections: ['Financial Accounting', 'Cost Management', 'Statements', 'Reconciliation'] },
  business_studies: { time: 150, marks: 100, sections: ['Business Environment', 'Entrepreneurship', 'Management', 'Marketing'] },
  economics: { time: 150, marks: 100, sections: ['Microeconomics', 'Macroeconomics', 'Economic Systems', 'Trade'] },
  english_home_language: { time: 180, marks: 150, sections: ['Comprehension', 'Language', 'Literature', 'Creative Writing'] },
  history: { time: 150, marks: 100, sections: ['South African History', 'World History', 'Cold War', 'Apartheid'] },
  geography: { time: 150, marks: 100, sections: ['Physical Geography', 'Human Geography', 'Climate', 'Mapwork'] },
  life_orientation: { time: 120, marks: 100, sections: ['Health', 'Social', 'Environmental', 'Citizenship'] },
  _default: { time: 120, marks: 100, sections: ['General'] },
};

// ============================================================
// Service Functions
// ============================================================

/**
 * Start a new exam simulation
 */
export async function startExam(
  subject: string,
  difficulty: string = 'medium',
  studentId?: string
): Promise<ExamPaper> {
  const response = await fetch(`${API_BASE}/api/exam-simulator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: studentId || 'anonymous',
      subject,
      difficulty,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to start exam');
  }

  const data = await response.json();

  // Transform API response into ExamPaper
  const sections: ExamSection[] = data.sections || [];
  const questions: ExamQuestion[] = data.questions || [];

  return {
    exam_id: data.exam_id || `exam_${Date.now()}`,
    title: data.title || `${subject} Exam`,
    instructions: data.instructions || 'Answer all questions.',
    total_marks: data.total_marks || 100,
    time_limit_min: data.time_limit_min || 120,
    sections,
    questions,
    marking_rubric: data.marking_rubric || [],
  };
}

/**
 * Submit a single answer during the exam
 */
export function submitAnswer(
  state: ExamState,
  questionId: number,
  answer: string
): ExamState {
  return {
    ...state,
    answers: {
      ...state.answers,
      [questionId]: answer,
    },
  };
}

/**
 * Toggle flag for a question
 */
export function toggleFlag(state: ExamState, questionId: number): ExamState {
  const newFlagged = new Set(state.flagged);
  if (newFlagged.has(questionId)) {
    newFlagged.delete(questionId);
  } else {
    newFlagged.add(questionId);
  }
  return { ...state, flagged: newFlagged };
}

/**
 * Get exam results after submission
 */
export async function getExamResults(
  examId: string,
  studentId: string,
  subject: string,
  answers: Record<number, string>,
  questions: ExamQuestion[],
  startTime: Date
): Promise<ExamResult> {
  const timeTakenMs = Date.now() - startTime.getTime();
  const timeTakenMin = Math.round(timeTakenMs / 60000);

  // Calculate basic scoring
  const questionBreakdown = questions.map(q => {
    const studentAnswer = answers[q.id] || '';
    const isCorrect = checkAnswer(q, studentAnswer);
    const marksEarned = isCorrect ? q.marks : 0;

    return {
      id: q.id,
      correct: isCorrect,
      marks_earned: marksEarned,
      max_marks: q.marks,
      topic: q.topic,
      feedback: isCorrect
        ? 'Correct answer! Well done.'
        : `Incorrect. The correct answer was: ${q.correct_answer}`,
    };
  });

  const totalEarned = questionBreakdown.reduce((sum, q) => sum + q.marks_earned, 0);
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  const percentage = Math.round((totalEarned / totalMarks) * 100);

  // Calculate grade
  let grade: string;
  if (percentage >= 80) grade = 'A';
  else if (percentage >= 70) grade = 'B';
  else if (percentage >= 60) grade = 'C';
  else if (percentage >= 50) grade = 'D';
  else if (percentage >= 40) grade = 'E';
  else grade = 'F';

  // Topic performance
  const topicPerf: Record<string, { correct: number; total: number; pct: number }> = {};
  for (const q of questionBreakdown) {
    if (!topicPerf[q.topic]) {
      topicPerf[q.topic] = { correct: 0, total: 0, pct: 0 };
    }
    topicPerf[q.topic].total++;
    if (q.correct) topicPerf[q.topic].correct++;
  }
  for (const topic of Object.keys(topicPerf)) {
    topicPerf[topic].pct = Math.round((topicPerf[topic].correct / topicPerf[topic].total) * 100);
  }

  // Generate recommendations
  const weakTopics = Object.entries(topicPerf)
    .filter(([, data]) => data.pct < 60)
    .sort((a, b) => a[1].pct - b[1].pct)
    .map(([topic]) => topic);

  const recommendations: string[] = [];
  if (weakTopics.length > 0) {
    recommendations.push(`Focus on these topics: ${weakTopics.slice(0, 3).join(', ')}`);
  }
  if (percentage < 50) {
    recommendations.push('Review fundamental concepts before attempting advanced problems');
  }
  if (timeTakenMin > (questions.length * 5)) {
    recommendations.push('Practice time management — try to spend less than 5 minutes per question');
  }
  if (recommendations.length === 0) {
    recommendations.push('Excellent performance! Keep practising to maintain your level.');
  }

  // Save result to database
  try {
    await supabase.from('exam_simulations').update({
      answers_json: answers as any,
      score: percentage,
      completed_at: new Date().toISOString(),
    }).eq('id', examId);
  } catch (e) {
    console.warn('Failed to save exam result:', e);
  }

  // Generate AI feedback via API
  let aiFeedback = `You scored ${totalEarned}/${totalMarks} (${percentage}%). `;
  aiFeedback += percentage >= 70 ? 'Great job! ' : percentage >= 50 ? 'Good effort. ' : 'Keep practising. ';
  if (weakTopics.length > 0) {
    aiFeedback += `Focus on: ${weakTopics.slice(0, 3).join(', ')}.`;
  }

  try {
    const response = await fetch(`${API_BASE}/api/weakness-detection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        subject,
        score: percentage,
        questions: questions.map((q, i) => ({
          question: q.question,
          topic: q.topic,
          correct_answer: q.correct_answer,
          student_answer: answers[q.id] || '',
          is_correct: checkAnswer(q, answers[q.id] || ''),
        })),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.ai_insights) {
        aiFeedback = data.ai_insights;
      }
    }
  } catch (e) {
    console.warn('Failed to get AI feedback:', e);
  }

  return {
    exam_id: examId,
    score: totalEarned,
    total_marks: totalMarks,
    percentage,
    grade,
    question_breakdown: questionBreakdown,
    topic_performance: topicPerf,
    ai_feedback: aiFeedback,
    time_taken_min: timeTakenMin,
    recommendations,
  };
}

/**
 * Check if a student's answer is correct
 */
function checkAnswer(question: ExamQuestion, answer: string): boolean {
  if (!answer || !question.correct_answer) return false;

  const normalizeText = (text: string) =>
    text.toLowerCase().trim().replace(/\s+/g, ' ');

  // For MCQ, check against correct letter or full answer text
  if (question.type === 'mcq') {
    const normalizedAnswer = normalizeText(answer);
    const normalizedCorrect = normalizeText(question.correct_answer);

    // Check letter match
    if (normalizedAnswer === normalizedCorrect) return true;

    // Check if answer matches option text
    if (question.options) {
      for (const [letter, text] of Object.entries(question.options)) {
        if (normalizeText(text) === normalizedAnswer && normalizeText(letter) === normalizedCorrect) {
          return true;
        }
        if (normalizeText(letter) === normalizedAnswer) {
          return normalizeText(text) === normalizedCorrect;
        }
      }
    }

    return false;
  }

  // For short/long answers, use fuzzy matching
  const normalizedAnswer = normalizeText(answer);
  const normalizedCorrect = normalizeText(question.correct_answer);

  // Exact match
  if (normalizedAnswer === normalizedCorrect) return true;

  // Check if key terms are present (for open-ended answers)
  const correctWords = normalizedCorrect.split(' ').filter(w => w.length > 3);
  const answerWords = normalizedAnswer.split(' ');
  const matchCount = correctWords.filter(w => answerWords.includes(w)).length;

  // Require at least 70% of key words to match
  return correctWords.length > 0 && matchCount / correctWords.length >= 0.7;
}

/**
 * Calculate time remaining in seconds
 */
export function calculateTimeRemaining(startTime: Date, timeLimitMin: number): number {
  const elapsed = (Date.now() - startTime.getTime()) / 1000;
  const totalSeconds = timeLimitMin * 60;
  return Math.max(0, Math.round(totalSeconds - elapsed));
}

/**
 * Format seconds as MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get the exam config for a subject
 */
export function getExamConfig(subject: string): ExamConfig {
  return EXAM_CONFIGS[subject] || EXAM_CONFIGS._default;
}

/**
 * Initialize exam state
 */
export function createInitialExamState(): ExamState {
  return {
    exam: null,
    answers: {},
    flagged: new Set(),
    currentQuestionIndex: 0,
    startTime: null,
    endTime: null,
    isSubmitted: false,
    timeRemaining: 0,
  };
}

/**
 * Calculate answered/flagged/total counts
 */
export function getExamProgress(state: ExamState): {
  answered: number;
  total: number;
  flagged: number;
  unanswered: number;
  progressPct: number;
} {
  const total = state.exam?.questions.length || 0;
  const answered = Object.keys(state.answers).length;
  const flaggedCount = state.flagged.size;
  const unanswered = total - answered;
  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;

  return { answered, total, flagged: flaggedCount, unanswered, progressPct };
}

/**
 * Grade letter mapping
 */
export function getGradeDescription(grade: string): string {
  const descriptions: Record<string, string> = {
    'A': 'Outstanding achievement',
    'B': 'Meritorious achievement',
    'C': 'Substantial achievement',
    'D': 'Adequate achievement',
    'E': 'Moderate achievement',
    'F': 'Inadequate achievement',
  };
  return descriptions[grade] || 'Not classified';
}

/**
 * Get grade color class
 */
export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    'A': 'text-green-600',
    'B': 'text-blue-600',
    'C': 'text-yellow-600',
    'D': 'text-orange-600',
    'E': 'text-orange-800',
    'F': 'text-red-600',
  };
  return colors[grade] || 'text-gray-600';
}

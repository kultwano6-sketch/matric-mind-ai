// Smart Context Engine - Builds student context for AI prompts

import { supabase } from '@/integrations/supabase/client';

export interface StudentContext {
  studentId: string;
  weakTopics: string[];
  recentActivity: ActivityItem[];
  pastMistakes: MistakeItem[];
  performanceSummary: {
    avgQuizScore: number;
    avgAssignmentScore: number;
    consistency: number;
    readiness: number;
  };
  subjects: string[];
  streak: number;
}

interface ActivityItem {
  type: string;
  subject: string;
  topic?: string;
  score?: number;
  timestamp: string;
}

interface MistakeItem {
  topic: string;
  subject: string;
  mistake: string;
  count: number;
  lastSeen: string;
}

// Build comprehensive student context
export async function buildStudentContext(userId: string): Promise<StudentContext> {
  // Get student profile
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('subjects')
    .eq('user_id', userId)
    .single();

  // Get progress data
  const { data: progress } = await supabase
    .from('student_progress')
    .select('*')
    .eq('student_id', userId);

  // Get quiz attempts
  const { data: quizzes } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Get assignments
  const { data: assignments } = await supabase
    .from('assignment_submissions')
    .select('*')
    .eq('student_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get streak
  const { data: streaks } = await supabase
    .from('study_streaks')
    .select('login_date')
    .eq('user_id', userId)
    .order('login_date', { ascending: false });

  // Calculate weak topics (mastery < 50%)
  const weakTopics = (progress || [])
    .filter(p => p.mastery_level < 50)
    .map(p => `${p.topic} (${p.subject})`)
    .slice(0, 5);

  // Calculate average scores
  const avgQuizScore = quizzes && quizzes.length > 0
    ? Math.round(quizzes.reduce((sum, q) => {
        const score = q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0;
        return sum + score;
      }, 0) / quizzes.length)
    : 0;

  const avgAssignmentScore = assignments && assignments.length > 0
    ? Math.round(assignments.reduce((sum, a) => {
        const score = a.total_points > 0 ? (a.score / a.total_points) * 100 : 0;
        return sum + score;
      }, 0) / assignments.length)
    : 0;

  // Calculate consistency (streak)
  const streak = calculateStreak(streaks || []);

  // Calculate readiness
  const readiness = Math.round(
    (avgQuizScore * 0.4) + (avgAssignmentScore * 0.3) + 
    ((progress && progress.length > 0) ? 
      progress.reduce((sum, p) => sum + p.mastery_level, 0) / progress.length * 0.3 : 0)
  );

  // Build recent activity
  const recentActivity: ActivityItem[] = [];
  quizzes?.slice(0, 5).forEach(q => {
    recentActivity.push({
      type: 'quiz',
      subject: q.subject || 'unknown',
      topic: q.topic,
      score: q.total_questions > 0 ? Math.round((q.score / q.total_questions) * 100) : 0,
      timestamp: q.created_at,
    });
  });
  assignments?.slice(0, 5).forEach(a => {
    recentActivity.push({
      type: 'assignment',
      subject: a.subject || 'unknown',
      score: a.total_points > 0 ? Math.round((a.score / a.total_points) * 100) : 0,
      timestamp: a.created_at,
    });
  });

  // Get past mistakes from progress
  const pastMistakes: MistakeItem[] = (progress || [])
    .filter(p => p.mastery_level < 40)
    .map(p => ({
      topic: p.topic,
      subject: p.subject,
      mistake: `Struggling with ${p.topic}`,
      count: 1,
      lastSeen: p.updated_at || p.created_at,
    }))
    .slice(0, 5);

  return {
    studentId: userId,
    weakTopics,
    recentActivity,
    pastMistakes,
    performanceSummary: {
      avgQuizScore,
      avgAssignmentScore,
      consistency: streak,
      readiness,
    },
    subjects: (profile?.subjects as string[]) || [],
    streak,
  };
}

// Calculate current streak
function calculateStreak(streaks: { login_date: string }[]): number {
  if (streaks.length === 0) return 0;
  
  const dates = streaks.map(s => s.login_date).sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  // Check if user studied today or yesterday
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const expected = new Date(dates[i - 1]);
    expected.setDate(expected.getDate() - 1);
    if (dates[i] === expected.toISOString().split('T')[0]) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

// Inject context into AI prompt
export function injectContextIntoPrompt(
  basePrompt: string,
  context: StudentContext
): string {
  let enhancedPrompt = basePrompt;
  
  // Add context section
  const contextSection = `
=== STUDENT CONTEXT ===
- Subjects: ${context.subjects.join(', ') || 'Not set'}
- Readiness: ${context.performanceSummary.readiness}%
- Quiz Average: ${context.performanceSummary.avgQuizScore}%
- Assignment Average: ${context.performanceSummary.avgAssignmentScore}%
- Study Streak: ${context.streak} days

${context.weakTopics.length > 0 ? `WEAK TOPICS: ${context.weakTopics.join(', ')}` : 'WEAK TOPICS: None identified yet'}

${context.recentActivity.length > 0 ? `RECENT ACTIVITY:\n${context.recentActivity.slice(0, 3).map(a => `- ${a.type}: ${a.subject} (${a.score}%)`).join('\n')}` : 'RECENT ACTIVITY: No recent activity'}
=== END CONTEXT ===
`;
  
  // Prepend context to prompt
  enhancedPrompt = contextSection + '\n' + basePrompt;
  
  return enhancedPrompt;
}
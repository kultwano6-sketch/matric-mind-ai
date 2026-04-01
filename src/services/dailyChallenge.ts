// ============================================================
// Matric Mind AI - Daily Challenge Service
// Manages daily challenges, submissions, streaks, and history
// ============================================================

import { supabase } from '@/integrations/supabase/client';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================
// Types
// ============================================================

export interface ChallengeContent {
  question: string;
  options?: Record<string, string>;
  correct_answer: string;
  explanation: string;
  hints: string[];
}

export interface DailyChallenge {
  id: string;
  subject: string;
  type: 'mcq' | 'short_answer' | 'problem_solving' | 'equation' | 'word_problem';
  difficulty: number;
  xp_reward: number;
  date: string;
  content: ChallengeContent;
  completed?: boolean;
  correct?: boolean;
}

export interface ChallengeCompletion {
  id: string;
  user_id: string;
  challenge_id: string;
  answer: string;
  correct: boolean;
  xp_earned: number;
  completed_at: string;
}

export interface ChallengeStreak {
  current_streak: number;
  longest_streak: number;
  total_completed: number;
  total_correct: number;
  accuracy_rate: number;
  streak_history: Array<{ date: string; completed: boolean; correct: boolean }>;
}

export interface ChallengeHistory {
  date: string;
  subject: string;
  challenge_type: string;
  difficulty: number;
  correct: boolean;
  xp_earned: number;
  completed_at: string;
}

export interface SubmitResult {
  success: boolean;
  correct: boolean;
  xp_earned: number;
  explanation: string;
  correct_answer: string;
  message: string;
}

// ============================================================
// Service Functions
// ============================================================

/**
 * Get today's challenges for a user
 */
export async function getTodaysChallenges(userId?: string): Promise<{
  challenges: DailyChallenge[];
  grouped: Record<string, DailyChallenge[]>;
  next_reset: string;
}> {
  const response = await fetch(`${API_BASE}/api/daily-challenge`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch daily challenges');
  }

  const data = await response.json();
  const challenges: DailyChallenge[] = data.challenges || [];

  // If we have a user ID, check completion status
  if (userId && challenges.length > 0) {
    const challengeIds = challenges.map(c => c.id);
    const { data: completions } = await supabase
      .from('challenge_completions')
      .select('challenge_id, correct')
      .eq('user_id', userId)
      .in('challenge_id', challengeIds);

    const completionMap = new Map(
      (completions || []).map(c => [c.challenge_id, c.correct])
    );

    for (const challenge of challenges) {
      if (completionMap.has(challenge.id)) {
        challenge.completed = true;
        challenge.correct = completionMap.get(challenge.id) || false;
      }
    }
  }

  // Group by subject
  const grouped: Record<string, DailyChallenge[]> = {};
  for (const challenge of challenges) {
    if (!grouped[challenge.subject]) {
      grouped[challenge.subject] = [];
    }
    grouped[challenge.subject].push(challenge);
  }

  return {
    challenges,
    grouped,
    next_reset: data.next_reset || getNextResetTime(),
  };
}

/**
 * Submit an answer to a daily challenge
 */
export async function submitChallengeAnswer(
  userId: string,
  challengeId: string,
  answer: string,
  timeTakenSec?: number
): Promise<SubmitResult> {
  const response = await fetch(`${API_BASE}/api/daily-challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      challenge_id: challengeId,
      answer,
      time_taken_sec: timeTakenSec,
    }),
  });

  const data = await response.json();

  if (!response.ok && response.status !== 409) {
    throw new Error(data.message || data.error || 'Failed to submit answer');
  }

  // 409 = already completed
  if (response.status === 409) {
    return {
      success: false,
      correct: data.correct || false,
      xp_earned: 0,
      explanation: '',
      correct_answer: '',
      message: data.message || 'Already completed this challenge',
    };
  }

  return {
    success: data.success || false,
    correct: data.correct || false,
    xp_earned: data.xp_earned || 0,
    explanation: data.explanation || '',
    correct_answer: data.correct_answer || '',
    message: data.message || '',
  };
}

/**
 * Get user's challenge streak data
 */
export async function getChallengeStreak(userId: string): Promise<ChallengeStreak> {
  // Fetch all completions
  const { data: completions } = await supabase
    .from('challenge_completions')
    .select('correct, completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });

  const allCompletions = completions || [];
  const totalCompleted = allCompletions.length;
  const totalCorrect = allCompletions.filter(c => c.correct).length;
  const accuracyRate = totalCompleted > 0
    ? Math.round((totalCorrect / totalCompleted) * 100)
    : 0;

  // Calculate current streak (consecutive days with at least one correct completion)
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get unique days with correct completions
  const correctDays = new Set(
    allCompletions
      .filter(c => c.correct)
      .map(c => c.completed_at.split('T')[0])
  );

  // Count consecutive days going backwards from today
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    if (correctDays.has(dateStr)) {
      currentStreak++;
    } else if (i > 0) {
      // Allow today to not have a completion yet
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  const sortedDays = Array.from(correctDays).sort();

  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prevDate = new Date(sortedDays[i - 1]);
      const currDate = new Date(sortedDays[i]);
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  // Build 30-day streak history
  const streakHistory: Array<{ date: string; completed: boolean; correct: boolean }> = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayCompletions = allCompletions.filter(c => c.completed_at.startsWith(dateStr));

    streakHistory.push({
      date: dateStr,
      completed: dayCompletions.length > 0,
      correct: dayCompletions.some(c => c.correct),
    });
  }

  return {
    current_streak: currentStreak,
    longest_streak: Math.max(longestStreak, currentStreak),
    total_completed: totalCompleted,
    total_correct: totalCorrect,
    accuracy_rate: accuracyRate,
    streak_history: streakHistory,
  };
}

/**
 * Get challenge history for a specified number of days
 */
export async function getChallengeHistory(
  userId: string,
  days: number = 7
): Promise<ChallengeHistory[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Fetch completions with challenge details
  const { data: completions } = await supabase
    .from('challenge_completions')
    .select(`
      id,
      correct,
      xp_earned,
      completed_at,
      answer,
      daily_challenges (
        id,
        subject,
        challenge_type,
        difficulty,
        content_json
      )
    `)
    .eq('user_id', userId)
    .gte('completed_at', startDate.toISOString())
    .order('completed_at', { ascending: false });

  return (completions || []).map((c: any) => ({
    date: c.completed_at?.split('T')[0] || '',
    subject: c.daily_challenges?.subject || 'Unknown',
    challenge_type: c.daily_challenges?.challenge_type || 'mcq',
    difficulty: c.daily_challenges?.difficulty || 1,
    correct: c.correct,
    xp_earned: c.xp_earned || 0,
    completed_at: c.completed_at,
  }));
}

/**
 * Generate a motivational message for the challenge page
 */
export function getChallengeMotivation(streak: number, accuracy: number): string {
  if (streak >= 7) {
    return `🔥 ${streak}-day streak! You're on fire! Keep crushing these challenges!`;
  }
  if (streak >= 3) {
    return `✨ ${streak} days strong! Consistency is your superpower!`;
  }
  if (accuracy >= 80) {
    return `🎯 ${accuracy}% accuracy! You're getting really good at this!`;
  }
  if (accuracy >= 50) {
    return `📈 ${accuracy}% accuracy — solid foundation! Keep building!`;
  }
  return '🌱 Every challenge you attempt makes you stronger. Let\'s go!';
}

/**
 * Get XP earned today
 */
export async function getXPEarnedToday(userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  const { data: completions } = await supabase
    .from('challenge_completions')
    .select('xp_earned')
    .eq('user_id', userId)
    .gte('completed_at', `${today}T00:00:00`)
    .lte('completed_at', `${today}T23:59:59`);

  return (completions || []).reduce(
    (sum: number, c: any) => sum + (c.xp_earned || 0), 0
  );
}

/**
 * Format difficulty for display
 */
export function formatDifficulty(difficulty: number): string {
  const labels: Record<number, string> = {
    1: 'Easy',
    2: 'Standard',
    3: 'Moderate',
    4: 'Challenging',
    5: 'Expert',
  };
  return labels[difficulty] || 'Standard';
}

/**
 * Get difficulty color
 */
export function getDifficultyColor(difficulty: number): string {
  if (difficulty <= 1) return 'text-green-600';
  if (difficulty <= 2) return 'text-blue-600';
  if (difficulty <= 3) return 'text-yellow-600';
  if (difficulty <= 4) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Get difficulty badge variant
 */
export function getDifficultyVariant(
  difficulty: number
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (difficulty <= 1) return 'secondary';
  if (difficulty <= 3) return 'default';
  return 'destructive';
}

/**
 * Get next reset time (midnight SAST)
 */
function getNextResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

/**
 * Calculate time until next reset
 */
export function getTimeUntilReset(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const diffMs = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  return { hours, minutes, seconds };
}

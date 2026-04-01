// ============================================================
// Matric Mind AI - Gamification Service Additions
// Additional functions and achievements to add to gamification.ts
// ============================================================

import type { Achievement } from './gamification';

// ============================================================
// New Achievement Definitions
// ============================================================

export const NEW_ACHIEVEMENTS: Achievement[] = [
  // Conversation mode achievements
  {
    id: 'conversation_king',
    name: 'Conversation King',
    description: 'Have 10 conversations with the AI tutor',
    icon: '💬',
    unlocked_at: null,
    xp_reward: 200,
    category: 'study',
  },
  {
    id: 'deep_diver',
    name: 'Deep Diver',
    description: 'Ask "go deeper" 5 times in conversation mode',
    icon: '🏊',
    unlocked_at: null,
    xp_reward: 150,
    category: 'study',
  },

  // Textbook scanning achievements
  {
    id: 'textbook_scanner',
    name: 'Textbook Scanner',
    description: 'Scan 5 textbook pages',
    icon: '📸',
    unlocked_at: null,
    xp_reward: 100,
    category: 'study',
  },
  {
    id: 'chapter_master',
    name: 'Chapter Master',
    description: 'Scan and study content from 10 different chapters',
    icon: '📖',
    unlocked_at: null,
    xp_reward: 300,
    category: 'study',
  },

  // Streak achievements (enhanced)
  {
    id: 'week_streak',
    name: '7-Day Streak',
    description: 'Maintain a 7-day study streak',
    icon: '🔥',
    unlocked_at: null,
    xp_reward: 250,
    category: 'streak',
  },
  {
    id: 'study_marathon',
    name: 'Study Marathon',
    description: 'Study for 4+ hours in a single day',
    icon: '🏃',
    unlocked_at: null,
    xp_reward: 200,
    category: 'study',
  },

  // Quiz achievements (enhanced)
  {
    id: 'perfect_quiz',
    name: 'Perfect Quiz',
    description: 'Score 100% on any quiz',
    icon: '💯',
    unlocked_at: null,
    xp_reward: 300,
    category: 'quiz',
  },
  {
    id: 'quiz_streak',
    name: 'Quiz Streak',
    description: 'Complete a quiz every day for 5 days',
    icon: '🎯',
    unlocked_at: null,
    xp_reward: 250,
    category: 'quiz',
  },

  // Progress tracking achievements
  {
    id: 'snapshot_pioneer',
    name: 'Snapshot Pioneer',
    description: 'Create your first progress snapshot',
    icon: '📊',
    unlocked_at: null,
    xp_reward: 50,
    category: 'milestone',
  },
  {
    id: 'trend_tracker',
    name: 'Trend Tracker',
    description: 'View your progress trend 5 times',
    icon: '📈',
    unlocked_at: null,
    xp_reward: 75,
    category: 'milestone',
  },
];

// ============================================================
// Daily Challenge XP Calculation
// ============================================================

/**
 * Calculate XP for completing a daily challenge
 * @param timeBonus - Whether the student completed within time limit
 * @param difficulty - Challenge difficulty (1-4)
 * @returns XP earned
 */
export function calculateDailyChallengeXP(
  timeBonus: boolean = false,
  difficulty: number = 1,
  isCorrect: boolean = true
): number {
  if (!isCorrect) {
    return Math.round(5 * difficulty); // consolation XP
  }

  // Base XP by difficulty
  const baseXP: Record<number, number> = {
    1: 15, // Easy
    2: 25, // Medium
    3: 40, // Hard
    4: 60, // Expert
  };

  let xp = baseXP[difficulty] || 15;

  // Time bonus: +50% if completed quickly
  if (timeBonus) {
    xp = Math.round(xp * 1.5);
  }

  // First challenge of the day bonus
  xp += 5;

  return xp;
}

/**
 * Check if a challenge completion should grant time bonus
 * @param startedAt - When the student started
 * @param completedAt - When the student completed
 * @param difficulty - Challenge difficulty
 * @returns Whether time bonus applies
 */
export function checkTimeBonus(
  startedAt: string,
  completedAt: string,
  difficulty: number
): boolean {
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const durationSec = (end - start) / 1000;

  // Time limits by difficulty (seconds)
  const timeLimits: Record<number, number> = {
    1: 120, // Easy: 2 minutes
    2: 180, // Medium: 3 minutes
    3: 300, // Hard: 5 minutes
    4: 420, // Expert: 7 minutes
  };

  return durationSec <= (timeLimits[difficulty] || 120);
}

// ============================================================
// Achievement Progress
// ============================================================

interface AchievementProgress {
  achievement: Achievement;
  progress: number; // 0-100
  current_value: number;
  target_value: number;
  description: string;
}

/**
 * Get progress toward all achievements
 */
export async function getAchievementProgress(
  userId: string,
  supabaseClient: any
): Promise<AchievementProgress[]> {
  // Fetch gamification state
  const { data: state } = await supabaseClient
    .from('gamification_state')
    .select('streak_days, xp, level, achievements_json')
    .eq('user_id', userId)
    .single();

  const unlockedIds = new Set(
    (state?.achievements_json || []).map((a: Achievement) => a.id)
  );

  // Fetch counts needed for progress
  const [quizCount, sessionCount, streakData] = await Promise.all([
    supabaseClient
      .from('quiz_results')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', userId),
    supabaseClient
      .from('study_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', userId),
    supabaseClient
      .from('gamification_state')
      .select('streak_days')
      .eq('user_id', userId)
      .single(),
  ]);

  const streak = streakData?.data?.streak_days || 0;
  const quizzes = quizCount?.count || 0;
  const sessions = sessionCount?.count || 0;

  // Calculate progress for each achievement
  const allAchievements = [...NEW_ACHIEVEMENTS];

  return allAchievements.map(achievement => {
    let currentValue = 0;
    let targetValue = 1;
    let description = '';

    switch (achievement.id) {
      case 'conversation_king':
        currentValue = 0; // Would need conversation_sessions count
        targetValue = 10;
        description = `${currentValue}/${targetValue} conversations`;
        break;
      case 'textbook_scanner':
        currentValue = 0; // Would need textbook_scans count
        targetValue = 5;
        description = `${currentValue}/${targetValue} pages scanned`;
        break;
      case 'week_streak':
        currentValue = streak;
        targetValue = 7;
        description = `${currentValue}/${targetValue} day streak`;
        break;
      case 'study_marathon':
        currentValue = 0; // Would need daily study hours
        targetValue = 4;
        description = `${currentValue}/${targetValue} hours today`;
        break;
      case 'perfect_quiz':
        currentValue = 0; // Would need perfect quiz count
        targetValue = 1;
        description = `${currentValue}/${targetValue} perfect quizzes`;
        break;
      default:
        description = unlockedIds.has(achievement.id) ? 'Completed!' : 'In progress';
    }

    const progress = unlockedIds.has(achievement.id)
      ? 100
      : Math.min(100, Math.round((currentValue / targetValue) * 100));

    return {
      achievement: {
        ...achievement,
        unlocked_at: unlockedIds.has(achievement.id) ? new Date().toISOString() : null,
      },
      progress,
      current_value: currentValue,
      target_value: targetValue,
      description,
    };
  });
}

/**
 * Check for newly unlocked achievements based on activity
 */
export function checkNewAchievements(
  activityType: string,
  activityData: Record<string, unknown>,
  currentState: { streak_days: number; xp: number; level: number; achievements_json: Achievement[] }
): Achievement[] {
  const unlockedIds = new Set(currentState.achievements_json.map(a => a.id));
  const newAchievements: Achievement[] = [];

  const unlock = (id: string) => {
    if (!unlockedIds.has(id)) {
      const achievement = NEW_ACHIEVEMENTS.find(a => a.id === id);
      if (achievement) {
        newAchievements.push({
          ...achievement,
          unlocked_at: new Date().toISOString(),
        });
      }
    }
  };

  // Check based on activity
  switch (activityType) {
    case 'conversation_started':
      // Would track conversation count
      break;
    case 'textbook_scanned':
      // Would track scan count
      break;
    case 'streak_updated':
      if (currentState.streak_days >= 7) unlock('week_streak');
      break;
    case 'quiz_completed':
      if ((activityData.score as number) >= 100) unlock('perfect_quiz');
      break;
    case 'study_completed':
      if ((activityData.duration_hours as number) >= 4) unlock('study_marathon');
      break;
  }

  return newAchievements;
}

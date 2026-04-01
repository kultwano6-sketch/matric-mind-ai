// ============================================================
// Matric Mind AI - Gamification Service
// XP calculation, level progression, and achievement system
// ============================================================

export interface GamificationState {
  id: string;
  user_id: string;
  xp: number;
  level: number;
  streak_days: number;
  achievements_json: Achievement[];
  last_activity: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked_at: string | null;
  xp_reward: number;
  category: 'quiz' | 'study' | 'streak' | 'social' | 'milestone';
}

export interface XPBreakdown {
  quiz_xp: number;
  study_xp: number;
  streak_xp: number;
  bonus_xp: number;
}

// ============================================================
// Level Definitions
// ============================================================
export interface Level {
  level: number;
  name: string;
  xpRequired: number;
  icon: string;
  perks: string[];
}

export const LEVELS: Level[] = [
  { level: 1, name: 'Newcomer', xpRequired: 0, icon: '🌱', perks: ['Access to basic quizzes'] },
  { level: 2, name: 'Learner', xpRequired: 100, icon: '📚', perks: ['AI Tutor access'] },
  { level: 3, name: 'Student', xpRequired: 300, icon: '✏️', perks: ['Voice Tutor unlocked'] },
  { level: 4, name: 'Scholar', xpRequired: 600, icon: '📖', perks: ['Advanced analytics'] },
  { level: 5, name: 'Achiever', xpRequired: 1000, icon: '🏆', perks: ['Parent reports enabled'] },
  { level: 6, name: 'Expert', xpRequired: 1500, icon: '🎓', perks: ['Custom study plans'] },
  { level: 7, name: 'Master', xpRequired: 2200, icon: '⭐', perks: ['Priority AI responses'] },
  { level: 8, name: 'Valedictorian', xpRequired: 3000, icon: '👑', perks: ['All features unlocked'] },
  { level: 9, name: 'Legend', xpRequired: 4000, icon: '🌟', perks: ['Exclusive content'] },
  { level: 10, name: 'Matric Champion', xpRequired: 5500, icon: '🏅', perks: ['Hall of Fame'] },
];

// ============================================================
// Achievement Definitions
// ============================================================
export const ACHIEVEMENTS: Achievement[] = [
  // Quiz achievements
  {
    id: 'first_quiz',
    name: 'First Steps',
    description: 'Complete your first quiz',
    icon: '🎯',
    unlocked_at: null,
    xp_reward: 50,
    category: 'quiz',
  },
  {
    id: 'perfect_score',
    name: 'Perfectionist',
    description: 'Score 100% on any quiz',
    icon: '💯',
    unlocked_at: null,
    xp_reward: 200,
    category: 'quiz',
  },
  {
    id: 'quiz_master',
    name: 'Quiz Master',
    description: 'Complete 50 quizzes',
    icon: '🧠',
    unlocked_at: null,
    xp_reward: 500,
    category: 'quiz',
  },
  {
    id: 'ten_quizzes',
    name: 'Quiz Enthusiast',
    description: 'Complete 10 quizzes',
    icon: '📝',
    unlocked_at: null,
    xp_reward: 100,
    category: 'quiz',
  },
  {
    id: 'improvement',
    name: 'Rising Star',
    description: 'Improve your score by 20% from your last quiz',
    icon: '📈',
    unlocked_at: null,
    xp_reward: 150,
    category: 'quiz',
  },
  // Study achievements
  {
    id: 'first_study',
    name: 'Study Starter',
    description: 'Complete your first study session',
    icon: '📖',
    unlocked_at: null,
    xp_reward: 30,
    category: 'study',
  },
  {
    id: 'study_10_hours',
    name: 'Dedicated Learner',
    description: 'Study for a total of 10 hours',
    icon: '⏱️',
    unlocked_at: null,
    xp_reward: 300,
    category: 'study',
  },
  {
    id: 'study_50_hours',
    name: 'Study Warrior',
    description: 'Study for a total of 50 hours',
    icon: '⚔️',
    unlocked_at: null,
    xp_reward: 750,
    category: 'study',
  },
  {
    id: 'week_plan',
    name: 'Planner Pro',
    description: 'Complete all study plan entries for a week',
    icon: '📅',
    unlocked_at: null,
    xp_reward: 200,
    category: 'study',
  },
  {
    id: 'subject_master',
    name: 'Subject Master',
    description: 'Achieve 80%+ mastery in any subject',
    icon: '🏅',
    unlocked_at: null,
    xp_reward: 400,
    category: 'study',
  },
  // Streak achievements
  {
    id: 'streak_3',
    name: 'Getting Started',
    description: 'Maintain a 3-day study streak',
    icon: '🔥',
    unlocked_at: null,
    xp_reward: 75,
    category: 'streak',
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day study streak',
    icon: '⚡',
    unlocked_at: null,
    xp_reward: 200,
    category: 'streak',
  },
  {
    id: 'streak_30',
    name: 'Unstoppable',
    description: 'Maintain a 30-day study streak',
    icon: '💎',
    unlocked_at: null,
    xp_reward: 1000,
    category: 'streak',
  },
  {
    id: 'streak_100',
    name: 'Legendary Dedication',
    description: 'Maintain a 100-day study streak',
    icon: '👑',
    unlocked_at: null,
    xp_reward: 5000,
    category: 'streak',
  },
  // Social achievements
  {
    id: 'parent_linked',
    name: 'Family Support',
    description: 'Link a parent account',
    icon: '👨‍👩‍👧',
    unlocked_at: null,
    xp_reward: 100,
    category: 'social',
  },
  // Milestone achievements
  {
    id: 'level_5',
    name: 'Halfway There',
    description: 'Reach Level 5',
    icon: '🌟',
    unlocked_at: null,
    xp_reward: 250,
    category: 'milestone',
  },
  {
    id: 'level_10',
    name: 'Max Level',
    description: 'Reach Level 10',
    icon: '🏆',
    unlocked_at: null,
    xp_reward: 1000,
    category: 'milestone',
  },
  {
    id: 'all_subjects',
    name: 'Well-Rounded',
    description: 'Take a quiz in every enrolled subject',
    icon: '🎨',
    unlocked_at: null,
    xp_reward: 500,
    category: 'milestone',
  },
];

// ============================================================
// XP Calculation
// ============================================================

const XP_VALUES: Record<string, { base: number; multiplier: number }> = {
  quiz_complete: { base: 50, multiplier: 1.0 },
  quiz_perfect: { base: 200, multiplier: 1.0 },
  quiz_high_score: { base: 100, multiplier: 1.0 },
  study_session_complete: { base: 30, multiplier: 1.0 },
  study_hour: { base: 20, multiplier: 1.0 },
  streak_day: { base: 10, multiplier: 1.0 },
  streak_bonus_7: { base: 50, multiplier: 1.0 },
  streak_bonus_30: { base: 200, multiplier: 1.0 },
  recommendation_followed: { base: 25, multiplier: 1.0 },
  voice_session: { base: 15, multiplier: 1.0 },
  parent_report_viewed: { base: 20, multiplier: 1.0 },
  first_action: { base: 25, multiplier: 1.0 },
  weakness_improved: { base: 40, multiplier: 1.0 },
};

/**
 * Calculate XP for a given action
 */
export function calculateXP(action: string, data?: any): number {
  const xpConfig = XP_VALUES[action];
  if (!xpConfig) return 0;

  let xp = xpConfig.base;

  // Apply multipliers based on data
  if (data) {
    // Bonus for quiz score percentage
    if (action === 'quiz_complete' && typeof data.score === 'number') {
      if (data.score === 100) {
        xp = XP_VALUES.quiz_perfect.base;
      } else if (data.score >= 80) {
        xp = XP_VALUES.quiz_high_score.base;
      }
    }

    // Bonus for study duration
    if (action === 'study_session_complete' && typeof data.duration_min === 'number') {
      xp += Math.floor(data.duration_min / 15) * XP_VALUES.study_hour.base;
    }

    // Streak bonuses
    if (action === 'streak_day' && typeof data.streak_days === 'number') {
      if (data.streak_days >= 30) {
        xp += XP_VALUES.streak_bonus_30.base;
      } else if (data.streak_days >= 7) {
        xp += XP_VALUES.streak_bonus_7.base;
      }
    }
  }

  return Math.round(xp * xpConfig.multiplier);
}

/**
 * Get the level for a given XP amount
 */
export function getLevelForXP(xp: number): Level {
  let currentLevel = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.xpRequired) {
      currentLevel = level;
    } else {
      break;
    }
  }
  return currentLevel;
}

/**
 * Get progress percentage to next level
 */
export function getProgressToNextLevel(xp: number): { current: Level; next: Level | null; progress: number } {
  const current = getLevelForXP(xp);
  const currentIndex = LEVELS.findIndex(l => l.level === current.level);
  const next = currentIndex < LEVELS.length - 1 ? LEVELS[currentIndex + 1] : null;

  let progress = 100;
  if (next) {
    const xpInLevel = xp - current.xpRequired;
    const xpNeeded = next.xpRequired - current.xpRequired;
    progress = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));
  }

  return { current, next, progress };
}

/**
 * Check which achievements should be unlocked based on current state
 */
export function checkAchievements(state: GamificationState): Achievement[] {
  const unlockedIds = new Set(
    (state.achievements_json || []).map(a => a.id)
  );
  const newAchievements: Achievement[] = [];

  const check = (id: string, condition: boolean) => {
    if (condition && !unlockedIds.has(id)) {
      const achievement = ACHIEVEMENTS.find(a => a.id === id);
      if (achievement) {
        newAchievements.push({
          ...achievement,
          unlocked_at: new Date().toISOString(),
        });
      }
    }
  };

  // Level-based achievements
  check('level_5', state.level >= 5);
  check('level_10', state.level >= 10);

  // Streak achievements
  check('streak_3', state.streak_days >= 3);
  check('streak_7', state.streak_days >= 7);
  check('streak_30', state.streak_days >= 30);
  check('streak_100', state.streak_days >= 100);

  return newAchievements;
}

/**
 * Get XP breakdown from gamification state for display
 */
export function getXPBreakdown(state: GamificationState): XPBreakdown {
  // Calculate estimated breakdown based on achievements and level
  const achievementXP = (state.achievements_json || []).reduce(
    (sum, a) => sum + a.xp_reward, 0
  );
  
  const estimatedStreakXP = state.streak_days * XP_VALUES.streak_day.base;
  const totalKnown = achievementXP + estimatedStreakXP;
  
  return {
    quiz_xp: Math.max(0, Math.round((state.xp - totalKnown) * 0.5)),
    study_xp: Math.max(0, Math.round((state.xp - totalKnown) * 0.35)),
    streak_xp: estimatedStreakXP,
    bonus_xp: achievementXP,
  };
}

/**
 * Format XP number for display (1.2K, 1.5M, etc.)
 */
export function formatXP(xp: number): string {
  if (xp >= 1000000) return `${(xp / 1000000).toFixed(1)}M`;
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
  return xp.toString();
}

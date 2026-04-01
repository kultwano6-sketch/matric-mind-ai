import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  GamificationState,
  Achievement,
  LEVELS,
  ACHIEVEMENTS,
  getLevelForXP,
  getProgressToNextLevel,
  checkAchievements,
  getXPBreakdown,
  formatXP,
} from '@/services/gamification';
import { Trophy, Flame, Star, Zap, ChevronRight, Crown } from 'lucide-react';

interface XPDashboardProps {
  compact?: boolean;
  showBreakdown?: boolean;
  userId?: string;
}

export default function XPDashboard({ compact = false, showBreakdown = true, userId }: XPDashboardProps) {
  const { user } = useAuth();
  const [state, setState] = useState<GamificationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;

    const fetchState = async () => {
      try {
        const { data, error } = await supabase
          .from('gamification_state')
          .select('*')
          .eq('user_id', targetUserId)
          .single();

        if (error && error.code === 'PGRST116') {
          // No state exists, create one
          const { data: newData } = await supabase
            .from('gamification_state')
            .insert({
              user_id: targetUserId,
              xp: 0,
              level: 1,
              streak_days: 0,
              achievements_json: [],
            })
            .select()
            .single();

          setState(newData as any);
        } else if (data) {
          setState(data as any);
        }
      } catch (error) {
        console.error('Error fetching gamification state:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchState();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`gamification-${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gamification_state',
          filter: `user_id=eq.${targetUserId}`,
        },
        (payload) => {
          if (payload.new) {
            setState(payload.new as any);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetUserId]);

  if (loading || !state) {
    return (
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-8 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentLevel = getLevelForXP(state.xp);
  const { next, progress } = getProgressToNextLevel(state.xp);
  const xpBreakdown = getXPBreakdown(state);
  const newAchievements = checkAchievements(state);
  const unlockedAchievementIds = new Set(
    (state.achievements_json || []).map((a: Achievement) => a.id)
  );

  // Compact mode for embedding in other components
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{currentLevel.icon}</span>
          <div>
            <p className="text-sm font-bold">{currentLevel.name}</p>
            <p className="text-xs text-muted-foreground">{formatXP(state.xp)} XP</p>
          </div>
        </div>
        {state.streak_days > 0 && (
          <Badge variant="outline" className="gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            {state.streak_days}
          </Badge>
        )}
        {next && (
          <div className="w-24">
            <Progress value={progress} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground text-right">{progress}%</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Level & XP Card */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                key={currentLevel.level}
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                className="text-4xl"
              >
                {currentLevel.icon}
              </motion.div>
              <div>
                <h3 className="text-lg font-display font-bold">{currentLevel.name}</h3>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">{formatXP(state.xp)} XP</span>
                </div>
              </div>
            </div>

            {/* Streak */}
            <div className="text-center">
              <motion.div
                key={state.streak_days}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1"
              >
                <Flame className={`w-6 h-6 ${state.streak_days >= 7 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                <span className="text-2xl font-bold">{state.streak_days}</span>
              </motion.div>
              <p className="text-xs text-muted-foreground">day streak</p>
            </div>
          </div>

          {/* Progress to next level */}
          {next ? (
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Level {currentLevel.level}</span>
                <span className="text-muted-foreground">Level {next.level} - {next.name}</span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">{next.xpRequired - state.xp} XP to next level</p>
                <p className="text-xs font-medium">{progress}%</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500">
                <Crown className="w-3 h-3 mr-1" /> Maximum Level Achieved!
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Achievements */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {newAchievements.length === 0 && (state.achievements_json || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Complete quizzes and study sessions to earn achievements! 🎯
            </p>
          ) : (
            <div className="space-y-2">
              {/* Recently unlocked */}
              <AnimatePresence>
                {newAchievements.slice(0, 3).map((achievement) => (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    className="flex items-center gap-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                  >
                    <span className="text-xl">{achievement.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{achievement.name}</p>
                      <p className="text-xs text-muted-foreground">{achievement.description}</p>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-500/50">
                      +{achievement.xp_reward} XP
                    </Badge>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* All achievements grid */}
              <div className="grid grid-cols-4 gap-2 mt-3">
                {ACHIEVEMENTS.slice(0, showAllAchievements ? undefined : 8).map((achievement) => {
                  const isUnlocked = unlockedAchievementIds.has(achievement.id);
                  return (
                    <div
                      key={achievement.id}
                      className={`
                        relative p-2 rounded-lg text-center transition-all
                        ${isUnlocked ? 'bg-primary/10' : 'bg-muted/30 opacity-50'}
                      `}
                      title={`${achievement.name}: ${achievement.description}`}
                    >
                      <span className={`text-xl ${isUnlocked ? '' : 'grayscale'}`}>
                        {achievement.icon}
                      </span>
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-[8px]">🔒</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {ACHIEVEMENTS.length > 8 && (
                <button
                  onClick={() => setShowAllAchievements(!showAllAchievements)}
                  className="w-full text-center text-xs text-primary hover:underline mt-1"
                >
                  {showAllAchievements ? 'Show less' : `Show all ${ACHIEVEMENTS.length} achievements`}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* XP Breakdown */}
      {showBreakdown && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-purple-500" />
              XP Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Quiz XP', value: xpBreakdown.quiz_xp, color: 'bg-blue-500', icon: '🎯' },
                { label: 'Study XP', value: xpBreakdown.study_xp, color: 'bg-green-500', icon: '📖' },
                { label: 'Streak XP', value: xpBreakdown.streak_xp, color: 'bg-orange-500', icon: '🔥' },
                { label: 'Bonus XP', value: xpBreakdown.bonus_xp, color: 'bg-purple-500', icon: '⭐' },
              ].map((item) => {
                const percentage = state.xp > 0 ? Math.round((item.value / state.xp) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <span>{item.icon}</span>
                        {item.label}
                      </span>
                      <span className="font-medium">{formatXP(item.value)} XP</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className={`h-full rounded-full ${item.color}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Next level perks */}
            {next && (
              <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-2 mb-1">
                  <ChevronRight className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Level {next.level} Perks</span>
                </div>
                <ul className="space-y-1">
                  {next.perks.map((perk, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-primary" />
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

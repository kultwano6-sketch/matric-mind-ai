import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import StudyStreak from '@/components/StudyStreak';
import {
  Trophy, Flame, Star, Target, Zap, Gift, Crown,
  Medal, Award, TrendingUp, Calendar, BookOpen,
  CheckCircle2, Lock, Sparkles, ChevronRight
} from 'lucide-react';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  xpReward: number;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  category: 'study' | 'streak' | 'mastery' | 'social';
}

interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  completed: boolean;
  type: 'quiz' | 'study' | 'review';
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  xp: number;
  avatar: string;
  isCurrentUser?: boolean;
}

const STORAGE_KEY = 'gamification_data';
const TODAY = new Date().toISOString().split('T')[0];

function loadGameData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveGameData(data: any) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function Gamification() {
  const { user, profile } = useAuth();
  const userId = user?.id || 'anonymous';

  const [xp, setXp] = useState(() => {
    const data = loadGameData();
    return data?.xp ?? 0;
  });

  const [streak, setStreak] = useState(() => {
    const data = loadGameData();
    return data?.streak ?? 0;
  });

  const [lastClaimDate, setLastClaimDate] = useState(() => {
    const data = loadGameData();
    return data?.lastClaimDate ?? '';
  });

  const [completedChallenges, setCompletedChallenges] = useState<Record<string, string>>(() => {
    const data = loadGameData();
    return data?.completedChallenges ?? {};
  });

  const [level, setLevel] = useState(1);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const hasClaimedToday = lastClaimDate === TODAY;

  // Calculate level from XP
  useEffect(() => {
    const newLevel = Math.floor(xp / 500) + 1;
    if (newLevel > level) {
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 3000);
    }
    setLevel(newLevel);
  }, [xp]);

  // Save all data to localStorage
  useEffect(() => {
    saveGameData({ xp, streak, lastClaimDate, completedChallenges, userId });
  }, [xp, streak, lastClaimDate, completedChallenges, userId]);

  const xpForNextLevel = level * 500;
  const xpProgress = ((xp % 500) / 500) * 100;

  // Reset challenges at midnight
  useEffect(() => {
    const data = loadGameData();
    if (data?.challengeDate && data.challengeDate !== TODAY) {
      setCompletedChallenges({});
      saveGameData({ ...data, challengeDate: TODAY, completedChallenges: {} });
    }
  }, []);

  const achievements: Achievement[] = [
    {
      id: '1',
      name: 'First Steps',
      description: 'Complete your first study session',
      icon: <Star className="h-6 w-6" />,
      xpReward: 50,
      unlocked: xp >= 50,
      progress: Math.min(xp, 50),
      maxProgress: 50,
      category: 'study'
    },
    {
      id: '2',
      name: 'Week Warrior',
      description: 'Maintain a 7-day study streak',
      icon: <Flame className="h-6 w-6" />,
      xpReward: 200,
      unlocked: streak >= 7,
      progress: Math.min(streak, 7),
      maxProgress: 7,
      category: 'streak'
    },
    {
      id: '3',
      name: 'Quiz Master',
      description: 'Complete 5 daily challenges',
      icon: <Trophy className="h-6 w-6" />,
      xpReward: 300,
      unlocked: Object.keys(completedChallenges).length >= 5,
      progress: Math.min(Object.keys(completedChallenges).length, 5),
      maxProgress: 5,
      category: 'mastery'
    },
    {
      id: '4',
      name: 'Dedicated Learner',
      description: 'Earn 500 total XP',
      icon: <BookOpen className="h-6 w-6" />,
      xpReward: 150,
      unlocked: xp >= 500,
      progress: Math.min(xp, 500),
      maxProgress: 500,
      category: 'study'
    },
    {
      id: '5',
      name: 'Subject Expert',
      description: 'Reach Level 5',
      icon: <Crown className="h-6 w-6" />,
      xpReward: 500,
      unlocked: level >= 5,
      progress: Math.min(level, 5),
      maxProgress: 5,
      category: 'mastery'
    },
    {
      id: '6',
      name: 'Monthly Champion',
      description: 'Maintain a 30-day streak',
      icon: <Medal className="h-6 w-6" />,
      xpReward: 1000,
      unlocked: streak >= 30,
      progress: Math.min(streak, 30),
      maxProgress: 30,
      category: 'streak'
    },
  ];

  const dailyChallenges: DailyChallenge[] = [
    {
      id: 'morning-study',
      title: 'Morning Study',
      description: 'Complete a 25-minute study session',
      xpReward: 50,
      completed: !!completedChallenges['morning-study'],
      type: 'study'
    },
    {
      id: 'quiz-challenge',
      title: 'Quiz Challenge',
      description: 'Score 80%+ on any quiz',
      xpReward: 75,
      completed: !!completedChallenges['quiz-challenge'],
      type: 'quiz'
    },
    {
      id: 'review-session',
      title: 'Review Session',
      description: 'Review 10 flashcards',
      xpReward: 30,
      completed: !!completedChallenges['review-session'],
      type: 'review'
    },
  ];

  const leaderboard: LeaderboardEntry[] = [
    { rank: 1, name: 'Thabo M.', xp: 15420, avatar: 'TM' },
    { rank: 2, name: 'Naledi S.', xp: 14200, avatar: 'NS' },
    { rank: 3, name: 'Sipho K.', xp: 13800, avatar: 'SK' },
    { rank: 4, name: 'Lerato N.', xp: 12500, avatar: 'LN' },
    { rank: 5, name: profile?.full_name || 'You', xp: xp, avatar: (profile?.full_name || 'U').charAt(0), isCurrentUser: true },
    { rank: 6, name: 'Mandla P.', xp: 10200, avatar: 'MP' },
    { rank: 7, name: 'Zanele D.', xp: 9800, avatar: 'ZD' },
  ].sort((a, b) => b.xp - a.xp).map((entry, index) => ({ ...entry, rank: index + 1 }));

  const completeChallenge = useCallback((id: string) => {
    // Prevent completing the same challenge today
    if (completedChallenges[id] === TODAY) return;

    const challenge = dailyChallenges.find(c => c.id === id);
    if (challenge) {
      setXp(prev => prev + challenge.xpReward);
      setCompletedChallenges(prev => ({ ...prev, [id]: TODAY }));
    }
  }, [completedChallenges, dailyChallenges]);

  const claimDailyReward = useCallback(() => {
    // Already claimed today — don't allow again
    if (hasClaimedToday) return;

    setXp(prev => prev + 25);
    setStreak(prev => prev + 1);
    setLastClaimDate(TODAY);

    // Also update the StudyStreak localStorage data
    try {
      const raw = localStorage.getItem('study_streak_data');
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (raw) {
        const streakData = JSON.parse(raw);
        if (streakData.lastStudyDate !== TODAY) {
          const newStreak = streakData.lastStudyDate === yesterday
            ? streakData.currentStreak + 1
            : 1;
          const updated = {
            ...streakData,
            currentStreak: newStreak,
            longestStreak: Math.max(streakData.longestStreak, newStreak),
            lastStudyDate: TODAY,
            weekData: { ...streakData.weekData, [TODAY]: true },
          };
          localStorage.setItem('study_streak_data', JSON.stringify(updated));
        }
      }
    } catch {
      // ignore localStorage errors
    }

    if ((window as any).__markTodayStudied) {
      (window as any).__markTodayStudied();
    }
  }, [hasClaimedToday]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'study': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'streak': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'mastery': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'social': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-muted';
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-mono">{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-6">
      {/* Level Up Animation */}
      {showLevelUp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center animate-bounce">
            <Sparkles className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-4xl font-bold text-yellow-500 mb-2">Level Up!</h2>
            <p className="text-xl text-white">You reached Level {level}</p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
            Achievements & Rewards
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your progress, earn XP, and unlock achievements
          </p>
        </div>

        {/* Study Streak */}
        <StudyStreak />

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card border-white/10 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between mb-2">
                <Zap className="h-8 w-8 text-primary" />
                <Badge variant="outline" className="bg-primary/20 border-primary/30 text-primary">
                  Level {level}
                </Badge>
              </div>
              <p className="text-3xl font-bold">{xp.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total XP</p>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{xp % 500} XP</span>
                  <span>{xpForNextLevel} XP</span>
                </div>
                <Progress value={xpProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-transparent" />
            <CardContent className="p-4 relative">
              <Flame className="h-8 w-8 text-orange-500 mb-2" />
              <p className="text-3xl font-bold">{streak}</p>
              <p className="text-sm text-muted-foreground">Day Streak</p>
              <Button
                size="sm"
                variant="outline"
                className={`mt-2 w-full border-orange-500/30 text-orange-500 hover:bg-orange-500/10 ${hasClaimedToday ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={claimDailyReward}
                disabled={hasClaimedToday}
              >
                <Gift className="h-4 w-4 mr-1" />
                {hasClaimedToday ? 'Claimed Today ✓' : 'Claim +25 XP'}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent" />
            <CardContent className="p-4 relative">
              <Trophy className="h-8 w-8 text-purple-500 mb-2" />
              <p className="text-3xl font-bold">{achievements.filter(a => a.unlocked).length}</p>
              <p className="text-sm text-muted-foreground">of {achievements.length} Achievements</p>
              <Progress
                value={(achievements.filter(a => a.unlocked).length / achievements.length) * 100}
                className="h-2 mt-2"
              />
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-transparent" />
            <CardContent className="p-4 relative">
              <Target className="h-8 w-8 text-green-500 mb-2" />
              <p className="text-3xl font-bold">{dailyChallenges.filter(c => c.completed).length}</p>
              <p className="text-sm text-muted-foreground">of {dailyChallenges.length} Daily Tasks</p>
              <Progress
                value={(dailyChallenges.filter(c => c.completed).length / dailyChallenges.length) * 100}
                className="h-2 mt-2"
              />
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="challenges" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="challenges">Daily Challenges</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          {/* Daily Challenges */}
          <TabsContent value="challenges" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {dailyChallenges.map(challenge => (
                <Card
                  key={challenge.id}
                  className={`glass-card border-white/10 ${challenge.completed ? 'opacity-75' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          challenge.type === 'quiz' ? 'bg-purple-500/20' :
                          challenge.type === 'study' ? 'bg-blue-500/20' : 'bg-green-500/20'
                        }`}>
                          {challenge.type === 'quiz' ? <Trophy className="h-5 w-5 text-purple-500" /> :
                           challenge.type === 'study' ? <BookOpen className="h-5 w-5 text-blue-500" /> :
                           <TrendingUp className="h-5 w-5 text-green-500" />}
                        </div>
                        <div>
                          <h3 className="font-semibold">{challenge.title}</h3>
                          <p className="text-sm text-muted-foreground">{challenge.description}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-amber-500/20 border-amber-500/30 text-amber-500">
                        +{challenge.xpReward} XP
                      </Badge>
                    </div>
                    <div className="mt-4">
                      {challenge.completed ? (
                        <Button disabled className="w-full" variant="outline">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Completed Today
                        </Button>
                      ) : (
                        <Button
                          onClick={() => completeChallenge(challenge.id)}
                          className="w-full bg-gradient-to-r from-primary to-amber-600"
                        >
                          Complete Challenge
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Achievements */}
          <TabsContent value="achievements" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {achievements.map(achievement => (
                <Card
                  key={achievement.id}
                  className={`glass-card border-white/10 ${!achievement.unlocked ? 'opacity-60' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${
                        achievement.unlocked
                          ? 'bg-gradient-to-br from-amber-500/30 to-yellow-500/30 text-yellow-500'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {achievement.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold">{achievement.name}</h3>
                          <Badge variant="outline" className={getCategoryColor(achievement.category)}>
                            {achievement.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{achievement.description}</p>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              {achievement.progress}/{achievement.maxProgress}
                            </span>
                            <span className="text-amber-500">+{achievement.xpReward} XP</span>
                          </div>
                          <Progress
                            value={(achievement.progress / achievement.maxProgress) * 100}
                            className="h-2"
                          />
                        </div>
                        {achievement.unlocked && (
                          <div className="flex items-center gap-1 mt-2 text-green-500 text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Unlocked!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Leaderboard */}
          <TabsContent value="leaderboard">
            <Card className="glass-card border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  Weekly Leaderboard
                </CardTitle>
                <CardDescription>See how you rank against other students</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.rank}
                      className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                        entry.isCurrentUser
                          ? 'bg-primary/20 border border-primary/30'
                          : 'bg-card/50 hover:bg-card/80'
                      }`}
                    >
                      <div className="w-8 flex justify-center">
                        {getRankBadge(entry.rank)}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-white font-bold">
                        {entry.avatar}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{entry.name}</p>
                        <p className="text-sm text-muted-foreground">Level {Math.floor(entry.xp / 500) + 1}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{entry.xp.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">XP</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

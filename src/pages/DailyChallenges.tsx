// ============================================================
// Matric Mind AI - Daily Challenges Page
// Daily challenge cards, streaks, XP tracking, and history
// ============================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Flame, Zap, Clock, CheckCircle2, XCircle, Trophy, Calendar,
  Brain, Star, Target, ArrowRight,
} from 'lucide-react';
import {
  getTodaysChallenges,
  submitChallengeAnswer,
  getChallengeStreak,
  type DailyChallenge,
  type ChallengeStreak,
  type SubmitResult,
} from '@/services/dailyChallenge';
import { useAuth } from '@/hooks/useAuth';

const SUBJECT_ICONS: Record<string, string> = {
  mathematics: '📐',
  physical_sciences: '⚛️',
  life_sciences: '🧬',
  accounting: '📊',
  business_studies: '💼',
  economics: '📈',
  english_home_language: '📖',
  history: '📜',
  geography: '🌍',
};

const DIFFICULTY_BADGES: Record<number, { label: string; color: string }> = {
  1: { label: 'Easy', color: 'bg-green-100 text-green-800' },
  2: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  3: { label: 'Hard', color: 'bg-orange-100 text-orange-800' },
  4: { label: 'Expert', color: 'bg-red-100 text-red-800' },
};

const TYPE_LABELS: Record<string, string> = {
  mcq: 'Multiple Choice',
  short_answer: 'Short Answer',
  problem_solving: 'Problem Solving',
  equation: 'Equation',
  word_problem: 'Word Problem',
};

export default function DailyChallenges() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [streak, setStreak] = useState<ChallengeStreak | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<DailyChallenge | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [xpToday, setXpToday] = useState(0);
  const [nextReset, setNextReset] = useState('');
  const [countdown, setCountdown] = useState('');

  // Load challenges and streak
  useEffect(() => {
    loadData();
  }, [user?.id]);

  // Countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      if (!nextReset) return;
      const diff = new Date(nextReset).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('Resetting...');
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setCountdown(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextReset]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const [challengeData, streakData] = await Promise.all([
        getTodaysChallenges(user.id),
        getChallengeStreak(user.id),
      ]);

      setChallenges(challengeData.challenges);
      setNextReset(challengeData.next_reset);
      setStreak(streakData);

      // Calculate XP today
      const completedToday = challengeData.challenges.filter(c => c.completed && c.correct);
      setXpToday(completedToday.reduce((sum, c) => sum + c.xp_reward, 0));
    } catch (error) {
      console.error('Failed to load challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChallenge = (challenge: DailyChallenge) => {
    if (challenge.completed) return;
    setSelectedChallenge(challenge);
    setSelectedAnswer('');
    setSubmitResult(null);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedChallenge || !selectedAnswer || !user?.id) return;

    // For MCQ: send the option VALUE (not key) so backend comparison works
    let answer = selectedAnswer;
    if (selectedChallenge.content?.options) {
      answer = selectedChallenge.content.options[selectedAnswer] || selectedAnswer;
    }

    setSubmitting(true);
    try {
      const result = await submitChallengeAnswer(user.id, selectedChallenge.id, answer);
      setSubmitResult(result);

      // Update local state
      setChallenges(prev =>
        prev.map(c =>
          c.id === selectedChallenge.id
            ? { ...c, completed: true, correct: result.correct }
            : c
        )
      );

      if (result.correct) {
        setXpToday(prev => prev + result.xp_earned);
        if (streak) {
          setStreak({ ...streak, current_streak: streak.current_streak + 1 });
        }
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    setSelectedChallenge(null);
    setSelectedAnswer('');
    setSubmitResult(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-2">
          <Brain className="w-8 h-8 animate-pulse text-primary mx-auto" />
          <p className="text-muted-foreground">Loading challenges...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-6 max-w-6xl mx-auto"
    >
      {/* Header Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Daily Challenges</h1>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Resets in: {countdown}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Streak */}
          <motion.div
            key={streak?.current_streak || 0}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-full"
          >
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="font-bold text-orange-700">{streak?.current_streak || 0}</span>
            <span className="text-sm text-orange-600">day streak</span>
          </motion.div>

          {/* XP Today */}
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
            <Zap className="w-4 h-4 text-primary" />
            <span className="font-bold">{xpToday} XP</span>
            <span className="text-sm text-muted-foreground">today</span>
          </div>
        </div>
      </div>

      {/* Streak Calendar (mini) */}
      {streak && (
        <Card className="border-2 border-border/50 shadow-md">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">30-Day Activity</span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Accuracy: {streak.accuracy_rate}%</span>
                <span>Best: {streak.longest_streak} days</span>
              </div>
            </div>
            <div className="flex gap-1 flex-wrap">
              {streak.streak_history.map((day, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-sm ${
                    day.correct
                      ? 'bg-green-500'
                      : day.completed
                      ? 'bg-yellow-400'
                      : 'bg-muted'
                  }`}
                  title={day.date}
                />
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-green-500" /> Correct
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-yellow-400" /> Attempted
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-muted" /> Skipped
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Challenge Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Today's Challenges</h2>
        {challenges.length === 0 ? (
          <Card className="border-2 border-border/50 shadow-md">
            <CardContent className="py-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No challenges available today. Check back later!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {challenges.map((challenge, i) => {
              const diff = DIFFICULTY_BADGES[challenge.difficulty] || DIFFICULTY_BADGES[1];
              const icon = SUBJECT_ICONS[challenge.subject] || '📝';

              return (
                <motion.div
                  key={challenge.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    className={`cursor-pointer transition-all ${
                      challenge.completed
                        ? challenge.correct
                          ? 'border-green-300 bg-green-50/50'
                          : 'border-red-300 bg-red-50/50'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => handleSelectChallenge(challenge)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{icon}</span>
                        {challenge.completed ? (
                          challenge.correct ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )
                        ) : (
                          <Badge className={diff.color}>{diff.label}</Badge>
                        )}
                      </div>
                      <CardTitle className="text-base capitalize">{challenge.subject.replace('_', ' ')}</CardTitle>
                      <CardDescription>{TYPE_LABELS[challenge.type] || challenge.type}</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-yellow-500" />
                          <span className="font-medium">{challenge.xp_reward} XP</span>
                        </div>
                        {challenge.completed && (
                          <Badge variant={challenge.correct ? 'default' : 'destructive'} className="text-xs">
                            {challenge.correct ? 'Correct!' : 'Incorrect'}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                    {!challenge.completed && (
                      <CardFooter className="pt-0">
                        <Button variant="ghost" size="sm" className="w-full text-xs">
                          Start Challenge <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Challenge Modal */}
      <Dialog open={!!selectedChallenge} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedChallenge && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{SUBJECT_ICONS[selectedChallenge.subject] || '📝'}</span>
                  <div>
                    <DialogTitle className="text-lg">
                      {selectedChallenge.subject.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </DialogTitle>
                    <DialogDescription>
                      {TYPE_LABELS[selectedChallenge.type] || selectedChallenge.type} • {DIFFICULTY_BADGES[selectedChallenge.difficulty]?.label || 'Medium'} • {selectedChallenge.xp_reward} XP
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Question */}
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedChallenge.content.question}</p>
                </div>

                {/* Answer Area */}
                {!submitResult ? (
                  <>
                    {selectedChallenge.type === 'mcq' && selectedChallenge.content.options ? (
                      <RadioGroup
                        value={selectedAnswer}
                        onValueChange={setSelectedAnswer}
                        className="space-y-2"
                      >
                        {Object.entries(selectedChallenge.content.options).map(([letter, text]) => (
                          <div
                            key={letter}
                            className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                          >
                            <RadioGroupItem value={letter} id={`modal-${letter}`} className="mt-1" />
                            <label htmlFor={`modal-${letter}`} className="flex-1 cursor-pointer text-sm">
                              <span className="font-medium">{letter}.</span> {text}
                            </label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : (
                      <Textarea
                        value={selectedAnswer}
                        onChange={(e) => setSelectedAnswer(e.target.value)}
                        placeholder="Write your answer..."
                        rows={4}
                      />
                    )}

                    <Button className="shadow-sm"
                      className="w-full shadow-md"
                      onClick={handleSubmitAnswer}
                      disabled={!selectedAnswer || submitting}
                    >
                      {submitting ? 'Submitting...' : 'Submit Answer'}
                    </Button>
                  </>
                ) : (
                  /* Result */
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className={`p-4 rounded-lg text-center ${
                      submitResult.correct
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      {submitResult.correct ? (
                        <>
                          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
                          <p className="font-semibold text-green-700">Correct!</p>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <Zap className="w-4 h-4 text-primary" />
                            <span className="font-bold">+{submitResult.xp_earned} XP</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
                          <p className="font-semibold text-red-700">Incorrect</p>
                          <p className="text-sm text-red-600 mt-1">
                            Correct answer: {submitResult.correct_answer}
                          </p>
                        </>
                      )}
                    </div>

                    {submitResult.explanation && (
                      <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                        <h4 className="font-medium text-sm mb-1">Explanation</h4>
                        <p className="text-sm text-muted-foreground">{submitResult.explanation}</p>
                      </div>
                    )}

                    <Button variant="outline" className="w-full shadow-md" onClick={handleCloseDialog}>
                      Close
                    </Button>
                  </motion.div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Past Challenges History */}
      <Card className="border-2 border-border/50 shadow-md">
        <CardHeader>
          <CardTitle className="text-base">Recent History</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {challenges.filter(c => c.completed).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Complete some challenges to see your history
              </p>
            ) : (
              <div className="space-y-2">
                {challenges
                  .filter(c => c.completed)
                  .map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span>{SUBJECT_ICONS[c.subject] || '📝'}</span>
                        <span className="text-sm capitalize">{c.subject.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.correct ? (
                          <Badge className="bg-green-100 text-green-800">+{c.xp_reward} XP</Badge>
                        ) : (
                          <Badge variant="destructive">Missed</Badge>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </motion.div>
  );
}

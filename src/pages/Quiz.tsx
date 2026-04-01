import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import { toast } from 'sonner';
import { Loader2, Brain, CheckCircle2, XCircle, Sparkles, RotateCcw, Zap, Trophy, Target, TrendingUp, AlertTriangle, Flame, Star } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];
type Question = {
  question: string;
  options: Record<string, string>;
  correct: string;
  explanation: string;
};

interface DifficultyInfo {
  recommended_difficulty: number;
  challenge_level: 'easy' | 'medium' | 'hard' | 'expert';
  topic_focus_areas: string[];
  reasoning: string;
  xp_multiplier: number;
}

interface QuizStats {
  xp_earned: number;
  weak_topics: string[];
  strong_topics: string[];
  accuracy: number;
  time_taken: number;
}

export default function QuizPageEnhanced() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Quiz state
  const [subject, setSubject] = useState<MatricSubject | ''>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [generating, setGenerating] = useState(false);
  const [grading, setGrading] = useState(false);

  // Enhanced state
  const [adaptiveMode, setAdaptiveMode] = useState(true);
  const [challengeMode, setChallengeMode] = useState(false);
  const [difficultyInfo, setDifficultyInfo] = useState<DifficultyInfo | null>(null);
  const [quizStats, setQuizStats] = useState<QuizStats | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);

  // Fetch student profile
  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('student_profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Fetch progress
  const { data: progress } = useQuery({
    queryKey: ['student-progress', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('student_progress').select('*').eq('student_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch difficulty info when subject changes
  useEffect(() => {
    if (!user || !subject || !adaptiveMode) {
      setDifficultyInfo(null);
      return;
    }

    const fetchDifficulty = async () => {
      try {
        const resp = await fetch('/api/dynamic-difficulty', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: user.id,
            subject: subject,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          setDifficultyInfo(data);
        }
      } catch (err) {
        console.error('Failed to fetch difficulty:', err);
      }
    };

    fetchDifficulty();
  }, [user, subject, adaptiveMode]);

  const subjects = studentProfile?.subjects?.length > 0
    ? studentProfile.subjects
    : ALL_SUBJECTS.slice(0, 12);

  const weakTopics = progress
    ?.filter(p => p.subject === subject && p.mastery_level < 50)
    .map(p => p.topic) || [];

  const generateQuiz = async () => {
    if (!subject) return;
    setGenerating(true);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setFeedback('');
    setQuizStats(null);
    setStartTime(new Date());

    const difficulty = challengeMode ? 'hard' : (difficultyInfo?.challenge_level || 'medium');
    const count = challengeMode ? 10 : 5;

    try {
      const resp = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          weakTopics: adaptiveMode ? (difficultyInfo?.topic_focus_areas?.length ? difficultyInfo.topic_focus_areas : weakTopics) : [],
          count,
          difficulty,
          challenge_mode: challengeMode,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate quiz');
      }

      const data = await resp.json();

      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        toast.success(
          challengeMode
            ? `🔥 Challenge Mode: ${data.questions.length} tough questions!`
            : `Generated ${data.questions.length} questions!`
        );
      } else {
        toast.error('Could not generate questions. Please try again.');
      }
    } catch (err: any) {
      console.error('Quiz generation error:', err);
      toast.error(err.message || 'Failed to generate quiz');
    }
    setGenerating(false);
  };

  const submitQuiz = async () => {
    if (Object.keys(answers).length < questions.length) {
      toast.error('Please answer all questions');
      return;
    }
    setGrading(true);

    const correct = questions.filter((q, i) => answers[i] === q.correct).length;
    const score = Math.round((correct / questions.length) * 100);
    const timeTaken = startTime ? Math.round((Date.now() - startTime.getTime()) / 1000) : 0;

    // Calculate XP
    let xpEarned = score >= 80 ? 100 : score >= 60 ? 75 : score >= 40 ? 50 : 25;
    if (challengeMode) xpEarned = Math.round(xpEarned * 1.5);
    if (difficultyInfo) xpEarned = Math.round(xpEarned * difficultyInfo.xp_multiplier);
    if (score === 100) xpEarned += 50; // Perfect score bonus

    try {
      const resp = await fetch('/api/grade-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          questions,
          answers: questions.map((_, i) => answers[i]),
          score,
        }),
      });

      const data = await resp.json();
      setFeedback(data.feedback || 'Great effort!');

      // Save submission
      const assignmentQuestions: unknown = questions;
      await supabase.from('assignments').insert({
        title: `${challengeMode ? '🔥 Challenge ' : ''}AI Quiz - ${SUBJECT_LABELS[subject as MatricSubject]}`,
        subject: subject as MatricSubject,
        assignment_type: 'quiz',
        is_ai_generated: true,
        created_by: user!.id,
        questions: assignmentQuestions,
      }).select().single().then(async ({ data: assignment }) => {
        if (assignment) {
          const answersPayload: unknown = questions.map((_, i) => answers[i]);
          await supabase.from('assignment_submissions').insert({
            assignment_id: assignment.id,
            student_id: user!.id,
            answers: answersPayload,
            score,
            ai_feedback: data.feedback,
          });
        }
      });

      // Track weak and strong topics
      const topicResults: Record<string, { correct: number; total: number }> = {};
      for (const [i, q] of questions.entries()) {
        const topic = q.question.slice(0, 60);
        if (!topicResults[topic]) topicResults[topic] = { correct: 0, total: 0 };
        topicResults[topic].total++;
        if (answers[i] === q.correct) topicResults[topic].correct++;

        // Update progress
        const isCorrect = answers[i] === q.correct;
        const existing = progress?.find(p => p.subject === subject && p.topic === topic);
        if (existing) {
          await supabase.from('student_progress').update({
            mastery_level: isCorrect
              ? Math.min(100, existing.mastery_level + 10)
              : Math.max(0, existing.mastery_level - 5),
            attempts: existing.attempts + 1,
            last_activity: new Date().toISOString(),
          }).eq('id', existing.id);
        } else {
          await supabase.from('student_progress').insert({
            student_id: user!.id,
            subject: subject as MatricSubject,
            topic,
            mastery_level: isCorrect ? 70 : 30,
            attempts: 1,
          });
        }
      }

      const weakTopicsList = Object.entries(topicResults)
        .filter(([, data]) => data.correct < data.total)
        .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
        .slice(0, 3)
        .map(([topic]) => topic);

      const strongTopicsList = Object.entries(topicResults)
        .filter(([, data]) => data.correct === data.total)
        .map(([topic]) => topic);

      setQuizStats({
        xp_earned: xpEarned,
        weak_topics: weakTopicsList,
        strong_topics: strongTopicsList,
        accuracy: score,
        time_taken: timeTaken,
      });

      // Update gamification state
      const { data: gamification } = await supabase
        .from('gamification_state')
        .select('xp, streak_days')
        .eq('user_id', user!.id)
        .single();

      if (gamification) {
        await supabase
          .from('gamification_state')
          .update({
            xp: (gamification.xp || 0) + xpEarned,
            last_activity: new Date().toISOString(),
          })
          .eq('user_id', user!.id);
      }

      // Log activity
      await supabase
        .from('activity_log')
        .insert({
          user_id: user!.id,
          action: 'quiz_completed',
          entity_type: 'quiz',
          metadata: {
            subject,
            score,
            xp_earned: xpEarned,
            challenge_mode: challengeMode,
            adaptive_mode: adaptiveMode,
            time_taken: timeTaken,
          },
        });

      queryClient.invalidateQueries({ queryKey: ['student-progress'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error('Failed to grade quiz');
    }
    setGrading(false);
  };

  const score = submitted
    ? Math.round((questions.filter((q, i) => answers[i] === q.correct).length / questions.length) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Brain className="w-8 h-8 text-accent" /> AI Quiz
          </h1>
          <p className="text-muted-foreground mt-1">Personalised quizzes that adapt to your level</p>
        </div>

        {/* Difficulty Info Banner */}
        {adaptiveMode && difficultyInfo && questions.length === 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="glass-card border-accent/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-accent shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Adaptive Difficulty: <Badge variant="outline">{difficultyInfo.challenge_level}</Badge>
                      <span className="ml-2 text-xs text-muted-foreground">×{difficultyInfo.xp_multiplier} XP</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{difficultyInfo.reasoning}</p>
                  </div>
                </div>
                {difficultyInfo.topic_focus_areas.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {difficultyInfo.topic_focus_areas.slice(0, 4).map((topic, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{topic}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Settings + Generate */}
        {questions.length === 0 && !generating && (
          <Card className="glass-card">
            <CardContent className="p-6 space-y-5">
              {/* Subject selector */}
              <Select value={subject} onValueChange={(v) => setSubject(v as MatricSubject)}>
                <SelectTrigger><SelectValue placeholder="Choose a subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s} value={s}>{SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Toggle Controls */}
              <div className="grid sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" /> Adaptive Difficulty
                    </Label>
                    <p className="text-xs text-muted-foreground">Auto-adjusts based on your performance</p>
                  </div>
                  <Switch checked={adaptiveMode} onCheckedChange={setAdaptiveMode} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1">
                      <Flame className="w-4 h-4 text-orange-500" /> Challenge Mode
                    </Label>
                    <p className="text-xs text-muted-foreground">10 hard questions, 1.5× XP</p>
                  </div>
                  <Switch checked={challengeMode} onCheckedChange={setChallengeMode} />
                </div>
              </div>

              {/* Weak areas preview */}
              {subject && weakTopics.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span>Quiz will focus on: {weakTopics.slice(0, 3).join(', ')}</span>
                </div>
              )}

              <Button onClick={generateQuiz} disabled={!subject} className="w-full" size="lg">
                <Sparkles className="w-4 h-4 mr-2" />
                {challengeMode ? '🔥 Start Challenge' : 'Generate Quiz'}
              </Button>
            </CardContent>
          </Card>
        )}

        {generating && (
          <Card className="glass-card">
            <CardContent className="p-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-accent" />
              <p className="font-medium">Generating your personalised quiz...</p>
              <p className="text-sm text-muted-foreground mt-1">
                {challengeMode ? 'Preparing tough challenge questions...' : 'AI is creating questions based on your weak areas'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Questions */}
        {questions.length > 0 && (
          <>
            {/* Score Banner */}
            {submitted && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className={`glass-card ${score >= 70 ? 'border-green-500/30' : 'border-orange-500/30'}`}>
                  <CardContent className="p-6 text-center">
                    <div className="text-5xl font-bold mb-2">{score}%</div>
                    <p className="text-muted-foreground mb-3">
                      {score >= 80 ? '🌟 Excellent!' : score >= 60 ? '👍 Good effort!' : '💪 Keep practising!'}
                    </p>
                    {quizStats && (
                      <div className="flex justify-center gap-4 flex-wrap">
                        <Badge variant="outline" className="text-base px-3 py-1">
                          <Zap className="w-4 h-4 mr-1 text-yellow-500" />
                          +{quizStats.xp_earned} XP
                        </Badge>
                        <Badge variant="outline" className="text-base px-3 py-1">
                          ⏱️ {Math.floor(quizStats.time_taken / 60)}:{(quizStats.time_taken % 60).toString().padStart(2, '0')}
                        </Badge>
                        {challengeMode && (
                          <Badge variant="destructive" className="text-base px-3 py-1">
                            <Flame className="w-4 h-4 mr-1" /> Challenge Complete!
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Questions List */}
            {questions.map((q, i) => (
              <Card key={i} className="glass-card">
                <CardContent className="p-5">
                  <p className="font-medium mb-3">
                    <span className="text-accent font-bold mr-2">Q{i + 1}.</span>
                    {q.question}
                  </p>
                  <div className="space-y-2">
                    {Object.entries(q.options).map(([letter, text]) => {
                      const selected = answers[i] === letter;
                      const isCorrect = letter === q.correct;
                      let extraClass = 'hover:bg-muted/50 cursor-pointer';

                      if (submitted) {
                        extraClass = 'cursor-default';
                        if (isCorrect) {
                          extraClass += ' border-[hsl(150,60%,40%)] bg-[hsl(150,60%,40%)]/10';
                        } else if (selected && !isCorrect) {
                          extraClass += ' border-destructive bg-destructive/10';
                        }
                      } else if (selected) {
                        extraClass = 'border-primary bg-primary/10';
                      }

                      return (
                        <button
                          key={letter}
                          onClick={() => !submitted && setAnswers(prev => ({ ...prev, [i]: letter }))}
                          disabled={submitted}
                          className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center gap-3 ${extraClass}`}
                        >
                          <span className="w-7 h-7 rounded-full border flex items-center justify-center text-sm font-medium shrink-0">
                            {submitted && isCorrect ? <CheckCircle2 className="w-5 h-5 text-[hsl(150,60%,40%)]" /> :
                             submitted && selected && !isCorrect ? <XCircle className="w-5 h-5 text-destructive" /> :
                             letter}
                          </span>
                          <span className="text-sm">{text}</span>
                        </button>
                      );
                    })}
                  </div>
                  {submitted && answers[i] !== q.correct && (
                    <p className="text-sm text-muted-foreground mt-3 p-3 bg-muted/50 rounded-lg">
                      💡 {q.explanation}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Submit / Results */}
            {!submitted ? (
              <Button
                onClick={submitQuiz}
                disabled={grading || Object.keys(answers).length < questions.length}
                className="w-full"
                size="lg"
              >
                {grading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Grading...</> : 'Submit Quiz'}
              </Button>
            ) : (
              <div className="space-y-4">
                {/* Weak Topics Summary */}
                {quizStats && quizStats.weak_topics.length > 0 && (
                  <Card className="glass-card border-yellow-500/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" /> Topics to Review
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {quizStats.weak_topics.map((topic, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{topic.slice(0, 40)}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Strong Topics */}
                {quizStats && quizStats.strong_topics.length > 0 && (
                  <Card className="glass-card border-green-500/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-green-600" /> Strong Areas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {quizStats.strong_topics.map((topic, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">✅ {topic.slice(0, 40)}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* AI Feedback */}
                {feedback && (
                  <Card className="glass-card">
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent" /> AI Feedback</CardTitle></CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{feedback}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button
                  onClick={() => { setQuestions([]); setAnswers({}); setSubmitted(false); setFeedback(''); setQuizStats(null); }}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> Take Another Quiz
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

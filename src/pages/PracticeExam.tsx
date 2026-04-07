import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ALL_SUBJECTS, SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Clock, CheckCircle2, XCircle, Flag, RotateCcw,
  Play, List, BookOpen, AlertTriangle, Trophy, Timer
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

type Question = {
  question: string;
  options: Record<string, string>;
  correct: string;
  explanation: string;
};

type ExamPhase = 'setup' | 'loading' | 'exam' | 'results';

const QUESTION_COUNTS = [5, 10, 15, 20];
const TIME_LIMITS = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '60 minutes', value: 60 },
  { label: 'Untimed', value: 0 },
];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'] as const;
type Difficulty = typeof DIFFICULTIES[number];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ProgressRing({ percentage, size = 120, strokeWidth = 10 }: { percentage: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={percentage >= 70 ? 'hsl(150,60%,40%)' : percentage >= 50 ? 'hsl(45,90%,50%)' : 'hsl(0,70%,50%)'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  );
}

export default function PracticeExam() {
  const { user } = useAuth();

  // Setup state
  const [subject, setSubject] = useState<MatricSubject | ''>('');
  const [questionCount, setQuestionCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState(30);
  const [difficulty, setDifficulty] = useState<Difficulty>('Mixed');

  // Exam state
  const [phase, setPhase] = useState<ExamPhase>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeTaken, setTimeTaken] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const handleSubmitRef = useRef<(auto?: boolean) => void>(() => {});

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const startTimer = useCallback((seconds: number) => {
    clearTimer();
    startTimeRef.current = Date.now();
    if (seconds <= 0) return;
    setTimeRemaining(seconds);
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearTimer();
          handleSubmitRef.current(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startExam = async () => {
    if (!subject) {
      toast.error('Please select a subject');
      return;
    }
    setPhase('loading');

    try {
      const diff = difficulty === 'Mixed' ? 'a mix of Easy, Medium, and Hard' : difficulty;
      const prompt = `Generate ${questionCount} multiple choice questions for ${SUBJECT_LABELS[subject]} matric level. Difficulty: ${diff}. Return ONLY valid JSON (no markdown, no code fences) with this exact format: {"questions": [{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correct": "A", "explanation": "..."}]}`;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ subject, count: questionCount, prompt }),
      });

      if (!resp.ok) throw new Error('Failed to generate questions');
      const data = await resp.json();
      const qs: Question[] = data.questions || [];

      if (!qs.length) {
        toast.error('Could not generate questions. Try again.');
        setPhase('setup');
        return;
      }

      setQuestions(qs);
      setAnswers({});
      setFlagged(new Set());
      setCurrentQuestion(0);
      setPhase('exam');
      startTimer(timeLimit * 60);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate exam');
      setPhase('setup');
    }
  };

  const handleSubmit = (auto = false) => {
    clearTimer();
    setTimeTaken(Math.round((Date.now() - startTimeRef.current) / 1000));
    setPhase('results');
    if (auto) toast.info("Time's up! Exam auto-submitted.");
  };
  handleSubmitRef.current = handleSubmit;

  const toggleFlag = (idx: number) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const correctCount = questions.filter((q, i) => answers[i] === q.correct).length;
  const score = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
  const answeredCount = Object.keys(answers).length;
  const isLowTime = timeLimit > 0 && timeRemaining < 300 && timeRemaining > 0;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {/* SETUP */}
        {phase === 'setup' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold flex items-center gap-2">
                <BookOpen className="w-8 h-8 text-accent" /> Practice Exam
              </h1>
              <p className="text-muted-foreground mt-1">Simulate real exam conditions with timed practice</p>
            </div>

            <Card className="glass-card">
              <CardContent className="p-6 space-y-5">
                {/* Subject */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <Select value={subject} onValueChange={(v) => setSubject(v as MatricSubject)}>
                    <SelectTrigger><SelectValue placeholder="Choose a subject" /></SelectTrigger>
                    <SelectContent>
                      {ALL_SUBJECTS.map(s => (
                        <SelectItem key={s} value={s}>{SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Question count */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Number of Questions</label>
                  <div className="flex gap-2 flex-wrap">
                    {QUESTION_COUNTS.map(n => (
                      <Button className="shadow-sm hover:shadow-md transition-shadow" key={n} variant={questionCount === n ? 'default' : 'outline'} size="sm"
                        onClick={() => setQuestionCount(n)}>{n}</Button>
                    ))}
                  </div>
                </div>

                {/* Time limit */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Limit</label>
                  <div className="flex gap-2 flex-wrap">
                    {TIME_LIMITS.map(t => (
                      <Button className="shadow-sm hover:shadow-md transition-shadow" key={t.value} variant={timeLimit === t.value ? 'default' : 'outline'} size="sm"
                        onClick={() => setTimeLimit(t.value)}>{t.label}</Button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Difficulty</label>
                  <div className="flex gap-2 flex-wrap">
                    {DIFFICULTIES.map(d => (
                      <Button className="shadow-sm hover:shadow-md transition-shadow" key={d} variant={difficulty === d ? 'default' : 'outline'} size="sm"
                        onClick={() => setDifficulty(d)}>{d}</Button>
                    ))}
                  </div>
                </div>

                <Button className="shadow-sm hover:shadow-md transition-shadow" onClick={startExam} disabled={!subject} className="w-full" size="lg">
                  <Play className="w-4 h-4 mr-2" /> Start Exam
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* LOADING */}
        {phase === 'loading' && (
          <Card className="glass-card">
            <CardContent className="p-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-accent" />
              <p className="font-medium">Preparing your exam...</p>
              <p className="text-sm text-muted-foreground mt-1">AI is generating {questionCount} questions</p>
            </CardContent>
          </Card>
        )}

        {/* EXAM */}
        {phase === 'exam' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Timer bar */}
            {timeLimit > 0 && (
              <Card className={`glass-card ${isLowTime ? 'border-destructive/50' : ''}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className={`w-5 h-5 ${isLowTime ? 'text-destructive' : 'text-accent'}`} />
                    <span className={`font-mono text-2xl font-bold ${isLowTime ? 'text-destructive' : ''}`}>
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{answeredCount}/{questions.length} answered</Badge>
                    <Button className="shadow-sm hover:shadow-md transition-shadow" variant={viewMode === 'all' ? 'default' : 'outline'} size="sm"
                      onClick={() => setViewMode(v => v === 'single' ? 'all' : 'single')}>
                      <List className="w-4 h-4 mr-1" /> {viewMode === 'single' ? 'Show All' : 'One at a Time'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {timeLimit === 0 && (
              <Card className="glass-card">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="w-5 h-5 text-accent" />
                    <span className="font-mono text-lg">{formatTime(Math.round((Date.now() - startTimeRef.current) / 1000))}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{answeredCount}/{questions.length} answered</Badge>
                    <Button className="shadow-sm hover:shadow-md transition-shadow" variant={viewMode === 'all' ? 'default' : 'outline'} size="sm"
                      onClick={() => setViewMode(v => v === 'single' ? 'all' : 'single')}>
                      <List className="w-4 h-4 mr-1" /> {viewMode === 'single' ? 'Show All' : 'One at a Time'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Question nav */}
            <Card className="glass-card">
              <CardContent className="p-3 flex flex-wrap gap-2">
                {questions.map((_, i) => {
                  const isAnswered = answers[i] !== undefined;
                  const isFlagged = flagged.has(i);
                  const isCurrent = i === currentQuestion;
                  return (
                    <button key={i} onClick={() => setCurrentQuestion(i)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium border transition-colors relative
                        ${isCurrent ? 'border-primary bg-primary text-primary-foreground' :
                          isAnswered ? 'border-[hsl(150,60%,40%)] bg-[hsl(150,60%,40%)]/10' :
                          'border-muted hover:border-foreground/30'}`}>
                      {i + 1}
                      {isFlagged && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full" />}
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Questions */}
            <AnimatePresence mode="wait">
              {(viewMode === 'single' ? [currentQuestion] : questions.map((_, i) => i)).map(idx => (
                <motion.div key={idx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }} className={viewMode === 'all' ? '' : ''}>
                  <Card className="glass-card">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <p className="font-medium">
                          <span className="text-accent font-bold mr-2">Q{idx + 1}.</span>
                          {questions[idx].question}
                        </p>
                        <Button className="shadow-sm hover:shadow-md transition-shadow" variant={flagged.has(idx) ? 'default' : 'ghost'} size="sm"
                          onClick={() => toggleFlag(idx)} className="shrink-0 ml-3">
                          <Flag className={`w-4 h-4 ${flagged.has(idx) ? '' : 'text-muted-foreground'}`} />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(questions[idx].options).map(([letter, text]) => {
                          const selected = answers[idx] === letter;
                          return (
                            <button key={letter}
                              onClick={() => setAnswers(prev => ({ ...prev, [idx]: letter }))}
                              className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center gap-3
                                ${selected ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'}`}>
                              <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-sm font-medium shrink-0
                                ${selected ? 'border-primary bg-primary text-primary-foreground' : ''}`}>
                                {letter}
                              </span>
                              <span className="text-sm">{text}</span>
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Single-mode nav + submit */}
            {viewMode === 'single' && (
              <div className="flex gap-3">
                <Button className="shadow-sm hover:shadow-md transition-shadow" variant="outline" className="flex-1" disabled={currentQuestion === 0}
                  onClick={() => setCurrentQuestion(c => c - 1)}>Previous</Button>
                <Button className="shadow-sm hover:shadow-md transition-shadow" variant="outline" className="flex-1" disabled={currentQuestion === questions.length - 1}
                  onClick={() => setCurrentQuestion(c => c + 1)}>Next</Button>
              </div>
            )}

            <Button className="shadow-sm hover:shadow-md transition-shadow" onClick={() => setShowConfirm(true)} className="w-full" size="lg">
              <Trophy className="w-4 h-4 mr-2" /> Submit Exam
            </Button>

            {/* Confirmation dialog */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" /> Submit Exam?
                  </DialogTitle>
                  <DialogDescription className="space-y-2 pt-2">
                    <p>You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.</p>
                    {answeredCount < questions.length && (
                      <p className="text-destructive">You still have {questions.length - answeredCount} unanswered question(s)!</p>
                    )}
                    {flagged.size > 0 && (
                      <p className="text-yellow-600">You have {flagged.size} question(s) flagged for review.</p>
                    )}
                    <p>This action cannot be undone.</p>
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2">
                  <Button className="shadow-sm hover:shadow-md transition-shadow" variant="outline" onClick={() => setShowConfirm(false)}>Continue Exam</Button>
                  <Button className="shadow-sm hover:shadow-md transition-shadow" onClick={() => { setShowConfirm(false); handleSubmit(); }}>Submit Now</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </motion.div>
        )}

        {/* RESULTS */}
        {phase === 'results' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold flex items-center gap-2">
                <Trophy className="w-8 h-8 text-accent" /> Exam Results
              </h1>
              <p className="text-muted-foreground mt-1">{subject && SUBJECT_LABELS[subject]} — {difficulty}</p>
            </div>

            {/* Score card */}
            <Card className={`glass-card ${score >= 70 ? 'border-[hsl(150,60%,40%)]/50' : score >= 50 ? 'border-yellow-500/30' : 'border-destructive/30'}`}>
              <CardContent className="p-8 flex flex-col items-center gap-4">
                <div className="relative">
                  <ProgressRing percentage={score} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span className="text-3xl font-bold"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                      {score}%
                    </motion.span>
                  </div>
                </div>
                <p className="text-lg font-medium">
                  {score >= 80 ? '🌟 Excellent!' : score >= 60 ? '👍 Good effort!' : score >= 40 ? '📚 Keep studying!' : '💪 Don\'t give up!'}
                </p>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{correctCount}/{questions.length} correct</span>
                  {timeLimit > 0 && (
                    <span>Time: {formatTime(timeTaken)} / {formatTime(timeLimit * 60)}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Question review */}
            {questions.map((q, i) => {
              const userAnswer = answers[i];
              const isCorrect = userAnswer === q.correct;
              const isFlagged = flagged.has(i);
              const borderColor = isCorrect ? 'border-l-[hsl(150,60%,40%)]' : 'border-l-destructive';
              return (
                <Card key={i} className={`glass-card border-l-4 ${borderColor}`}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <p className="font-medium">
                        <span className="text-accent font-bold mr-2">Q{i + 1}.</span>
                        {q.question}
                      </p>
                      <div className="flex gap-1 shrink-0 ml-3">
                        {isFlagged && <Badge className="bg-yellow-400 text-black text-xs">Flagged</Badge>}
                        {isCorrect ? (
                          <Badge className="bg-[hsl(150,60%,40%)] text-xs">Correct</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Wrong</Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(q.options).map(([letter, text]) => {
                        const isUserPick = userAnswer === letter;
                        const isAnswer = letter === q.correct;
                        let cls = 'border-muted';
                        if (isAnswer) cls = 'border-[hsl(150,60%,40%)] bg-[hsl(150,60%,40%)]/10';
                        else if (isUserPick && !isAnswer) cls = 'border-destructive bg-destructive/10';
                        return (
                          <div key={letter} className={`p-3 rounded-lg border flex items-center gap-3 ${cls}`}>
                            <span className="w-7 h-7 rounded-full border flex items-center justify-center text-sm font-medium shrink-0">
                              {isAnswer ? <CheckCircle2 className="w-5 h-5 text-[hsl(150,60%,40%)]" /> :
                               isUserPick ? <XCircle className="w-5 h-5 text-destructive" /> : letter}
                            </span>
                            <span className="text-sm">{text}</span>
                            {isUserPick && !isAnswer && <span className="ml-auto text-xs text-muted-foreground">Your answer</span>}
                          </div>
                        );
                      })}
                    </div>
                    {!isCorrect && (
                      <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                        💡 {q.explanation}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            <Button className="shadow-sm hover:shadow-md transition-shadow" onClick={() => { setPhase('setup'); setQuestions([]); setAnswers({}); setFlagged(new Set()); }}
              variant="outline" className="w-full" size="lg">
              <RotateCcw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}

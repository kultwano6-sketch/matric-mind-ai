// ============================================================
// Matric Mind AI - Exam Simulator Page
// Full timed exam experience with timer, navigation, and results
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Flag, Clock, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Send } from 'lucide-react';
import {
  startExam,
  getExamResults,
  calculateTimeRemaining,
  formatTime,
  createInitialExamState,
  getExamProgress,
  EXAM_CONFIGS,
  type ExamPaper,
  type ExamQuestion,
  type ExamResult,
  type ExamState,
} from '@/services/examSimulator';
import { useAuth } from '@/hooks/useAuth';

const SUBJECTS = [
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'physical_sciences', label: 'Physical Sciences' },
  { value: 'life_sciences', label: 'Life Sciences' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'business_studies', label: 'Business Studies' },
  { value: 'economics', label: 'Economics' },
  { value: 'english_home_language', label: 'English Home Language' },
  { value: 'history', label: 'History' },
  { value: 'geography', label: 'Geography' },
];

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'hard', label: 'Hard', color: 'bg-orange-100 text-orange-800' },
  { value: 'expert', label: 'Expert', color: 'bg-red-100 text-red-800' },
];

type ViewState = 'setup' | 'exam' | 'results';

export default function ExamSimulator() {
  const { user } = useAuth();
  const [viewState, setViewState] = useState<ViewState>('setup');
  const [subject, setSubject] = useState('mathematics');
  const [difficulty, setDifficulty] = useState('medium');
  const [exam, setExam] = useState<ExamPaper | null>(null);
  const [examState, setExamState] = useState<ExamState>(createInitialExamState());
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Timer effect
  useEffect(() => {
    if (viewState === 'exam' && examState.startTime && !examState.isSubmitted) {
      timerRef.current = setInterval(() => {
        const remaining = calculateTimeRemaining(examState.startTime!, exam?.time_limit_min || 120);
        setTimeRemaining(remaining);

        if (remaining <= 0) {
          handleSubmitExam();
        }
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [viewState, examState.startTime, examState.isSubmitted, exam]);

  const handleStartExam = async () => {
    setLoading(true);
    try {
      const examPaper = await startExam(subject, difficulty, user?.id);
      setExam(examPaper);
      const state = createInitialExamState();
      state.exam = examPaper;
      state.startTime = new Date();
      state.timeRemaining = examPaper.time_limit_min * 60;
      setExamState(state);
      setTimeRemaining(examPaper.time_limit_min * 60);
      setViewState('exam');
    } catch (error) {
      console.error('Failed to start exam:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    setExamState(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: answer },
    }));
  };

  const handleToggleFlag = (questionId: number) => {
    setExamState(prev => {
      const newFlagged = new Set(prev.flagged);
      if (newFlagged.has(questionId)) {
        newFlagged.delete(questionId);
      } else {
        newFlagged.add(questionId);
      }
      return { ...prev, flagged: newFlagged };
    });
  };

  const handleNavigateQuestion = (index: number) => {
    setExamState(prev => ({ ...prev, currentQuestionIndex: index }));
  };

  const handleSubmitExam = useCallback(async () => {
    if (!exam || !examState.startTime) return;

    if (timerRef.current) clearInterval(timerRef.current);
    setExamState(prev => ({ ...prev, isSubmitted: true }));

    try {
      const examResult = await getExamResults(
        exam.exam_id,
        user?.id || 'anonymous',
        subject,
        examState.answers,
        exam.questions,
        examState.startTime!
      );
      setResult(examResult);
      setViewState('results');
    } catch (error) {
      console.error('Failed to get results:', error);
    }
  }, [exam, examState, subject, user]);

  const currentQuestion = exam?.questions[examState.currentQuestionIndex];
  const totalQuestions = exam?.questions.length || 0;
  const progress = getExamProgress(examState);

  // Setup View
  if (viewState === 'setup') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto p-6"
      >
        <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Exam Simulator</CardTitle>
            <CardDescription>
              Practice with timed exams that simulate real test conditions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Subject</label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Difficulty</label>
              <div className="grid grid-cols-4 gap-2">
                {DIFFICULTIES.map(d => (
                  <Button className="shadow-sm hover:shadow-md transition-shadow"
                    key={d.value}
                    variant={difficulty === d.value ? 'default' : 'outline'}
                    onClick={() => setDifficulty(d.value)}
                    className={difficulty === d.value ? '' : ''}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="text-center text-sm text-muted-foreground">
              <p>Time Limit: {EXAM_CONFIGS[subject]?.time || 120} minutes</p>
              <p>Total Marks: {EXAM_CONFIGS[subject]?.marks || 100}</p>
              <p>Sections: {EXAM_CONFIGS[subject]?.sections?.join(', ') || 'General'}</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="shadow-sm hover:shadow-md transition-shadow"
              className="w-full"
              size="lg"
              onClick={handleStartExam}
              disabled={loading}
            >
              {loading ? 'Loading Exam...' : 'Start Exam'}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    );
  }

  // Results View
  if (viewState === 'results' && result) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto p-6"
      >
        <div className="space-y-6">
          {/* Score Header */}
          <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-4"
              >
                <span className="text-4xl font-bold text-primary">
                  {result.percentage}%
                </span>
              </motion.div>
              <CardTitle className="text-2xl">
                Score: {result.score}/{result.total_marks}
              </CardTitle>
              <Badge
                variant={result.percentage >= 50 ? 'default' : 'destructive'}
                className="w-fit mx-auto"
              >
                Grade {result.grade}
              </Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Completed in {result.time_taken_min} minutes
              </p>
            </CardHeader>
          </Card>

          {/* Topic Breakdown */}
          <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle>Topic Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(result.topic_performance).map(([topic, perf]) => (
                  <div key={topic} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{topic}</span>
                      <span>{perf.correct}/{perf.total} ({perf.pct}%)</span>
                    </div>
                    <Progress value={perf.pct} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Feedback */}
          <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle>AI Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{result.ai_feedback}</p>
              <div className="mt-4 space-y-2">
                <h4 className="font-medium text-sm">Recommendations:</h4>
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Question Review */}
          <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle>Question Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.question_breakdown.map((qb, i) => (
                  <div
                    key={qb.id}
                    className={`p-3 rounded-lg border ${
                      qb.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Q{i + 1}</span>
                      <div className="flex items-center gap-2">
                        {qb.correct ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className="text-sm">
                          {qb.marks_earned}/{qb.max_marks} marks
                        </span>
                      </div>
                    </div>
                    <p className="text-sm mt-1">{qb.feedback}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button className="shadow-sm hover:shadow-md transition-shadow"
            className="w-full"
            variant="outline"
            onClick={() => {
              setViewState('setup');
              setExam(null);
              setExamState(createInitialExamState());
              setResult(null);
            }}
          >
            Take Another Exam
          </Button>
        </div>
      </motion.div>
    );
  }

  // Exam View
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-screen"
    >
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r bg-card overflow-hidden"
          >
            <div className="p-4 space-y-4 w-[240px]">
              {/* Timer */}
              <div className={`text-center p-3 rounded-lg ${
                timeRemaining < 300 ? 'bg-red-100 text-red-700' : 'bg-primary/10'
              }`}>
                <div className="flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="font-mono text-xl font-bold">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
                <p className="text-xs mt-1">Time Remaining</p>
              </div>

              {/* Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{progress.answered}/{progress.total}</span>
                </div>
                <Progress value={progress.progressPct} className="h-2" />
              </div>

              <Separator />

              {/* Question Navigator */}
              <div>
                <p className="text-sm font-medium mb-2">Questions</p>
                <ScrollArea className="min-h-screen">
                  <div className="grid grid-cols-5 gap-1.5">
                    {exam?.questions.map((q, i) => {
                      const isAnswered = !!examState.answers[q.id];
                      const isFlagged = examState.flagged.has(q.id);
                      const isCurrent = examState.currentQuestionIndex === i;

                      return (
                        <Button className="shadow-sm hover:shadow-md transition-shadow"
                          key={q.id}
                          variant="ghost"
                          size="sm"
                          className={`h-9 w-9 p-0 relative ${
                            isCurrent
                              ? 'ring-2 ring-primary'
                              : isAnswered
                              ? 'bg-primary/20'
                              : ''
                          }`}
                          onClick={() => handleNavigateQuestion(i)}
                        >
                          {i + 1}
                          {isFlagged && (
                            <Flag className="w-2.5 h-2.5 absolute -top-0.5 -right-0.5 text-orange-500 fill-orange-500" />
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              <Separator />

              {/* Submit Button */}
              <Button className="shadow-sm hover:shadow-md transition-shadow"
                className="w-full"
                onClick={handleSubmitExam}
                disabled={examState.isSubmitted}
              >
                <Send className="w-4 h-4 mr-2" />
                Submit Exam
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="border-b px-6 py-3 flex items-center justify-between bg-card">
          <div>
            <h2 className="font-semibold">{exam?.title}</h2>
            <p className="text-sm text-muted-foreground">
              Question {examState.currentQuestionIndex + 1} of {totalQuestions}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`font-mono text-lg font-bold ${
              timeRemaining < 300 ? 'text-red-600' : ''
            }`}>
              {formatTime(timeRemaining)}
            </div>
            <Button className="shadow-sm hover:shadow-md transition-shadow" variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <ChevronLeft /> : <ChevronRight />}
            </Button>
          </div>
        </div>

        {/* Question Area */}
        <ScrollArea className="flex-1 p-6">
          {currentQuestion && (
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-3xl mx-auto space-y-6"
            >
              {/* Question Header */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Q{examState.currentQuestionIndex + 1}</Badge>
                    <Badge variant="secondary">{currentQuestion.topic}</Badge>
                    <Badge variant="outline">{currentQuestion.marks} marks</Badge>
                    {currentQuestion.section && (
                      <Badge variant="outline">{currentQuestion.section}</Badge>
                    )}
                  </div>
                </div>
                <Button className="shadow-sm hover:shadow-md transition-shadow"
                  variant={examState.flagged.has(currentQuestion.id) ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleToggleFlag(currentQuestion.id)}
                >
                  <Flag className={`w-4 h-4 mr-1 ${
                    examState.flagged.has(currentQuestion.id) ? 'fill-current' : ''
                  }`} />
                  {examState.flagged.has(currentQuestion.id) ? 'Flagged' : 'Flag'}
                </Button>
              </div>

              {/* Question Text */}
              <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <p className="text-lg whitespace-pre-wrap">{currentQuestion.question}</p>
                </CardContent>
              </Card>

              {/* Answer Area */}
              <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">Your Answer</CardTitle>
                </CardHeader>
                <CardContent>
                  {currentQuestion.type === 'mcq' && currentQuestion.options ? (
                    <RadioGroup
                      value={examState.answers[currentQuestion.id] || ''}
                      onValueChange={(val) => handleAnswerChange(currentQuestion.id, val)}
                      className="space-y-3"
                    >
                      {Object.entries(currentQuestion.options).map(([letter, text]) => (
                        <div key={letter} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
                          <RadioGroupItem value={letter} id={`opt-${letter}`} className="mt-1" />
                          <label htmlFor={`opt-${letter}`} className="flex-1 cursor-pointer">
                            <span className="font-medium">{letter}.</span> {text}
                          </label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <Textarea
                      value={examState.answers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      placeholder={currentQuestion.type === 'short_answer'
                        ? 'Write your answer here...'
                        : 'Write your detailed response here...'
                      }
                      className={`min-h-[${currentQuestion.type === 'long_answer' ? '200' : '100'}px]`}
                      rows={currentQuestion.type === 'long_answer' ? 8 : 4}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex justify-between">
                <Button className="shadow-sm hover:shadow-md transition-shadow"
                  variant="outline"
                  disabled={examState.currentQuestionIndex === 0}
                  onClick={() => handleNavigateQuestion(examState.currentQuestionIndex - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button className="shadow-sm hover:shadow-md transition-shadow"
                  variant="outline"
                  disabled={examState.currentQuestionIndex >= totalQuestions - 1}
                  onClick={() => handleNavigateQuestion(examState.currentQuestionIndex + 1)}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}
        </ScrollArea>
      </div>
    </motion.div>
  );
}

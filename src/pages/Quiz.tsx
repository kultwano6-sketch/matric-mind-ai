import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateQuiz, submitQuiz, getQuizHistory } from '@/services/ai';
import { CheckCircle2, XCircle, Clock, ArrowRight, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

// ============================================================
// Local Types (avoiding missing import from service)
// ============================================================

interface QuizQuestion {
  id: number;
  type: 'mcq' | 'short_answer';
  question: string;
  options?: Record<string, string>;
  correct_answer: string;
  marks: number;
  topic: string;
  explanation?: string;
}

interface QuizResult {
  score: number;
  total_marks: number;
  percentage: number;
  results: Array<{
    id: number;
    is_correct: boolean | null;
    marks_earned: number;
    max_marks: number;
    feedback?: string;
  }>;
}

interface QuizHistoryEntry {
  id: string;
  subject: string;
  score: number;
  total_marks: number;
  percentage: number;
  completed_at: string;
}

// ============================================================
// Quiz Generator Component
// ============================================================

export default function QuizPage() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('Mathematics');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [history, setHistory] = useState<QuizHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load quiz history on mount
  useEffect(() => {
    if (!user?.id) return;
    getQuizHistory(user.id)
      .then(setHistory)
      .catch((err) => console.error('Failed to load quiz history:', err));
  }, [user?.id]);

  const handleStartQuiz = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSubmitted(false);
    setResult(null);
    setAnswers({});
    setCurrentQuestion(0);

    try {
      const data = await generateQuiz(subject, topic || undefined, difficulty, 10);
      if (data?.questions && Array.isArray(data.questions)) {
        setQuestions(data.questions);
      } else {
        setError('Invalid quiz format received. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate quiz');
    } finally {
      setLoading(false);
    }
  }, [subject, topic, difficulty]);

  const handleAnswerChange = useCallback((questionId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  const handleSubmitQuiz = useCallback(async () => {
    if (questions.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const quizResult = await submitQuiz(subject, questions, answers);
      setResult(quizResult);
      setSubmitted(true);

      // Refresh history
      if (user?.id) {
        const updatedHistory = await getQuizHistory(user.id);
        setHistory(updatedHistory);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit quiz');
    } finally {
      setLoading(false);
    }
  }, [subject, questions, answers, user?.id]);

  // ============================================================
  // Active Quiz View
  // ============================================================

  if (questions.length > 0 && !submitted) {
    const q = questions[currentQuestion];
    const progress = ((currentQuestion + 1) / questions.length) * 100;

    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <Card className="max-w-3xl mx-auto border-2 border-border/50 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-display">{subject} Quiz</CardTitle>
              <Badge variant="outline" className="bg-background/80">
                Question {currentQuestion + 1} of {questions.length}
              </Badge>
            </div>
            {/* Progress bar with gradient */}
            <div className="w-full bg-muted/50 rounded-full h-2.5 mt-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary to-accent rounded-full h-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {error && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary">{q.topic || 'General'}</Badge>
              <p className="text-lg font-medium leading-relaxed">{q.question}</p>
            </div>

            {/* MCQ Options - Improved styling */}
            {q.type === 'mcq' && q.options && (
              <div className="space-y-3">
                {Object.entries(q.options).map(([letter, text]) => {
                  const isSelected = answers[q.id] === letter;
                  return (
                    <button
                      key={letter}
                      onClick={() => handleAnswerChange(q.id, letter)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${
                        isSelected
                          ? 'border-primary bg-gradient-to-r from-primary/10 to-primary/5 shadow-md'
                          : 'border-border/50 hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        isSelected 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {letter}
                      </div>
                      <span className="flex-1">{text}</span>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Short Answer */}
            {q.type === 'short_answer' && (
              <textarea
                className="w-full p-4 border-2 rounded-xl border-border focus:border-primary outline-none"
                rows={4}
                placeholder="Type your answer here..."
                value={answers[q.id] || ''}
                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              />
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestion === 0}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>

              <div className="flex gap-2">
                {currentQuestion < questions.length - 1 ? (
                  <Button onClick={() => setCurrentQuestion((prev) => prev + 1)} className="gap-2">
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmitQuiz}
                    disabled={loading}
                    className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Submit Quiz <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================
  // Results View
  // ============================================================

  if (submitted && result) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Quiz Results — {subject}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Score - Improved display */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-center p-8 rounded-2xl border-2 ${
                result.percentage >= 70 ? 'border-green-500/30 bg-green-500/10' : 
                result.percentage >= 50 ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-red-500/30 bg-red-500/10'
              }`}
            >
              <p className={`text-6xl font-bold ${
                result.percentage >= 70 ? 'text-green-600' : 
                result.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>{result.percentage}%</p>
              <p className="text-muted-foreground mt-3 text-lg">
                {result.score} / {result.total_marks} marks
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {result.percentage >= 70 ? '🎉 Excellent work!' : result.percentage >= 50 ? '💪 Good effort! Keep practicing!' : '📚 Keep studying, you can do this!'}
              </p>
            </motion.div>

            {/* Question breakdown */}
            <div className="space-y-3">
              <h3 className="font-semibold">Question Breakdown</h3>
              {questions.map((q, i) => {
                const r = result.results?.[i];
                if (!r) return null;
                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-xl border ${
                      r.is_correct === true
                        ? 'border-green-500/30 bg-green-500/5'
                        : r.is_correct === false
                          ? 'border-red-500/30 bg-red-500/5'
                          : 'border-muted bg-muted/30'
                    }`}
                  >
                    <p className="font-medium">{q.question}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your answer: {answers[q.id] || '(no answer)'} | Correct:{' '}
                      {q.correct_answer}
                    </p>
                    {r.feedback && (
                      <p className="text-sm mt-1 italic">{r.feedback}</p>
                    )}
                    <p className="text-sm font-medium mt-1">
                      Marks: {r.marks_earned} / {r.max_marks}
                    </p>
                  </div>
                );
              })}
            </div>

            <Button onClick={() => { setQuestions([]); setSubmitted(false); setResult(null); }}>
              Try Another Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================
  // Quiz Setup View
  // ============================================================

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Generate Quiz</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground">Subject</label>
            <select
              className="w-full mt-1.5 p-3.5 border-2 border-border/50 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              {['Mathematics', 'Physical Sciences', 'Life Sciences', 'English', 'Accounting', 'Geography', 'History', 'Economics', 'Business Studies'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Topic (optional)</label>
            <input
              type="text"
              className="w-full mt-1.5 p-3.5 border-2 border-border/50 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
              placeholder="e.g. Quadratic Equations, Photosynthesis"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Difficulty</label>
            <div className="flex gap-2 mt-1.5">
              {['easy', 'medium', 'hard'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 p-3.5 rounded-xl border-2 capitalize font-medium transition-all duration-200 ${
                    difficulty === d
                      ? 'border-primary bg-gradient-to-r from-primary/10 to-primary/5 shadow-md'
                      : 'border-border/50 hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleStartQuiz}
            disabled={loading}
            className="w-full text-lg font-semibold py-6 mt-2"
            size="lg"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Quiz...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Start Quiz <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </Button>

          {/* Recent history */}
          {history.length > 0 && (
            <div className="mt-8 pt-6 border-t">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Quizzes
              </h3>
              <div className="space-y-2">
                {history.slice(0, 5).map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${h.percentage >= 60 ? 'bg-green-500' : h.percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                      <span className="font-medium">{h.subject}</span>
                    </div>
                    <span className={`font-bold ${h.percentage >= 60 ? 'text-green-600' : h.percentage >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {h.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

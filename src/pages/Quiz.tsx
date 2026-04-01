import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateQuiz, submitQuiz, getQuizHistory } from '@/services/ai';

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
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{subject} Quiz</CardTitle>
              <Badge variant="outline">
                Question {currentQuestion + 1} of {questions.length}
              </Badge>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <div>
              <Badge variant="secondary" className="mb-2">{q.topic || 'General'}</Badge>
              <p className="text-lg font-medium">{q.question}</p>
            </div>

            {/* MCQ Options */}
            {q.type === 'mcq' && q.options && (
              <div className="space-y-2">
                {Object.entries(q.options).map(([letter, text]) => (
                  <button
                    key={letter}
                    onClick={() => handleAnswerChange(q.id, letter)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      answers[q.id] === letter
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <span className="font-medium mr-3">{letter}.</span>
                    {text}
                  </button>
                ))}
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
              >
                Previous
              </Button>

              <div className="flex gap-2">
                {currentQuestion < questions.length - 1 ? (
                  <Button onClick={() => setCurrentQuestion((prev) => prev + 1)}>
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmitQuiz}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {loading ? 'Submitting...' : 'Submit Quiz'}
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
            {/* Score */}
            <div className="text-center p-6 rounded-xl bg-primary/5">
              <p className="text-5xl font-bold">{result.percentage}%</p>
              <p className="text-muted-foreground mt-2">
                {result.score} / {result.total_marks} marks
              </p>
            </div>

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
            <label className="text-sm font-medium">Subject</label>
            <select
              className="w-full mt-1 p-3 border rounded-xl"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              {['Mathematics', 'Physical Sciences', 'Life Sciences', 'English', 'Accounting', 'Geography', 'History'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Topic (optional)</label>
            <input
              type="text"
              className="w-full mt-1 p-3 border rounded-xl"
              placeholder="e.g. Quadratic Equations"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Difficulty</label>
            <div className="flex gap-2 mt-1">
              {['easy', 'medium', 'hard'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 p-3 rounded-xl border-2 capitalize transition-all ${
                    difficulty === d
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
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
            className="w-full"
            size="lg"
          >
            {loading ? 'Generating Quiz...' : 'Start Quiz'}
          </Button>

          {/* Recent history */}
          {history.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium mb-2">Recent Quizzes</h3>
              <div className="space-y-2">
                {history.slice(0, 5).map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">{h.subject}</span>
                    <span className="text-sm font-medium">{h.percentage}%</span>
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

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { Clock, AlertTriangle, ChevronLeft, ChevronRight, Send, Flag, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface Question {
  number: number;
  marks: number;
  type: string;
  question: string;
}

interface PastPaper {
  id: string;
  subject: MatricSubject;
  year: number;
  paper_number: number;
  title: string;
  duration_minutes: number;
  total_marks: number;
  questions: Question[];
  memo: any[];
}

export default function PastPaperExam() {
  const { paperId } = useParams<{ paperId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [startTime] = useState(Date.now());
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  // Fetch paper details
  const { data: paper, isLoading } = useQuery({
    queryKey: ['past-paper', paperId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('past_papers')
        .select('*')
        .eq('id', paperId)
        .single();
      if (error) throw error;
      return data as PastPaper;
    },
    enabled: !!paperId,
  });

  // Create attempt on mount
  useEffect(() => {
    if (!paper || !user || attemptId) return;

    const createAttempt = async () => {
      const { data, error } = await supabase
        .from('past_paper_attempts')
        .insert({
          student_id: user.id,
          paper_id: paper.id,
          answers: {},
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        toast.error('Failed to start exam');
        navigate('/past-papers');
        return;
      }

      setAttemptId(data.id);
      setTimeRemaining(paper.duration_minutes * 60);
    };

    createAttempt();
  }, [paper, user, attemptId, navigate]);

  // Timer
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null) return null;
        const newTime = prev - 1;

        // Show warning at 10 minutes
        if (newTime === 600 && !showTimeWarning) {
          setShowTimeWarning(true);
          toast.warning('10 minutes remaining!');
        }

        // Auto-submit at 0
        if (newTime <= 0) {
          handleSubmit(true);
          return 0;
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, showTimeWarning]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionNumber: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionNumber]: answer }));
  };

  const toggleFlag = (questionNumber: number) => {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionNumber)) {
        newSet.delete(questionNumber);
      } else {
        newSet.add(questionNumber);
      }
      return newSet;
    });
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!paper || !attemptId || !user) return;

    setIsSubmitting(true);
    const timeTaken = Math.round((Date.now() - startTime) / 1000);

    try {
      // Call AI to grade the answers
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/grade-past-paper`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          paperId: paper.id,
          answers,
          questions: paper.questions,
          memo: paper.memo,
          subject: paper.subject,
        }),
      });

      let gradeResult = { score: 0, totalMarks: paper.total_marks, feedback: [] };
      
      if (response.ok) {
        gradeResult = await response.json();
      } else {
        // Fallback: basic grading without AI
        gradeResult = {
          score: Object.keys(answers).length * 5, // Placeholder score
          totalMarks: paper.total_marks,
          feedback: paper.questions.map(q => ({
            question: q.number,
            marks_awarded: answers[q.number] ? Math.round(q.marks * 0.5) : 0,
            feedback: answers[q.number] 
              ? 'Answer submitted - detailed feedback will be available after review.'
              : 'No answer provided.',
          })),
        };
      }

      const percentage = (gradeResult.score / gradeResult.totalMarks) * 100;

      // Update attempt with results
      await supabase
        .from('past_paper_attempts')
        .update({
          answers,
          score: gradeResult.score,
          total_marks: gradeResult.totalMarks,
          percentage,
          time_taken_seconds: timeTaken,
          ai_feedback: gradeResult.feedback,
          is_completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq('id', attemptId);

      queryClient.invalidateQueries({ queryKey: ['past-paper-attempts'] });

      toast.success(autoSubmit ? 'Time\'s up! Paper submitted.' : 'Paper submitted successfully!');
      navigate(`/past-papers/${paper.id}/review/${attemptId}`);
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to submit paper');
      setIsSubmitting(false);
    }
  };

  if (isLoading || !paper) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const questions = paper.questions as Question[];
  const currentQ = questions[currentQuestion];
  const answeredCount = Object.keys(answers).filter(k => answers[parseInt(k)]?.trim()).length;
  const progressPercent = (answeredCount / questions.length) * 100;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{SUBJECT_ICONS[paper.subject]}</span>
            <div>
              <h1 className="font-semibold text-sm sm:text-base line-clamp-1">{paper.title}</h1>
              <p className="text-xs text-muted-foreground">
                Question {currentQuestion + 1} of {questions.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-sm font-bold ${
              timeRemaining && timeRemaining < 600 
                ? 'bg-destructive text-destructive-foreground animate-pulse' 
                : 'bg-muted'
            }`}>
              <Clock className="w-4 h-4" />
              {timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowSubmitDialog(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="max-w-4xl mx-auto mt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span>{answeredCount}/{questions.length} answered</span>
            {flaggedQuestions.size > 0 && (
              <span className="text-orange-500">{flaggedQuestions.size} flagged</span>
            )}
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 max-w-4xl mx-auto w-full">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Question {currentQ.number}
                <Badge variant="outline">{currentQ.marks} marks</Badge>
              </CardTitle>
              <Button
                variant={flaggedQuestions.has(currentQ.number) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleFlag(currentQ.number)}
                className="gap-1"
              >
                <Flag className={`w-4 h-4 ${flaggedQuestions.has(currentQ.number) ? 'fill-current' : ''}`} />
                {flaggedQuestions.has(currentQ.number) ? 'Flagged' : 'Flag'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{currentQ.question}</ReactMarkdown>
            </div>

            <Textarea
              placeholder="Type your answer here..."
              value={answers[currentQ.number] || ''}
              onChange={(e) => handleAnswerChange(currentQ.number, e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
          </CardContent>
        </Card>

        {/* Question Navigation */}
        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestion(prev => prev - 1)}
            disabled={currentQuestion === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          <div className="hidden sm:flex flex-wrap gap-1 justify-center max-w-md">
            {questions.map((q, idx) => (
              <button
                key={q.number}
                onClick={() => setCurrentQuestion(idx)}
                className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                  idx === currentQuestion
                    ? 'bg-primary text-primary-foreground'
                    : answers[q.number]?.trim()
                      ? 'bg-[hsl(var(--teacher-accent))] text-white'
                      : flaggedQuestions.has(q.number)
                        ? 'bg-orange-500 text-white'
                        : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {q.number}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={() => setCurrentQuestion(prev => prev + 1)}
            disabled={currentQuestion === questions.length - 1}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Paper?</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit your paper? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm">Questions Answered</span>
              <span className="font-bold">{answeredCount}/{questions.length}</span>
            </div>

            {answeredCount < questions.length && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  You have {questions.length - answeredCount} unanswered question(s).
                </AlertDescription>
              </Alert>
            )}

            {flaggedQuestions.size > 0 && (
              <Alert>
                <Flag className="w-4 h-4" />
                <AlertDescription>
                  You have {flaggedQuestions.size} flagged question(s) to review.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Continue Working
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Paper
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

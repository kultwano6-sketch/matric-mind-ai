import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { ArrowLeft, Clock, Award, CheckCircle2, XCircle, AlertCircle, RotateCcw, TrendingUp, Loader2 } from 'lucide-react';
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

interface FeedbackItem {
  question: number;
  marks_awarded: number;
  feedback: string;
}

interface Attempt {
  id: string;
  paper_id: string;
  answers: Record<number, string>;
  score: number;
  total_marks: number;
  percentage: number;
  time_taken_seconds: number;
  ai_feedback: FeedbackItem[];
  completed_at: string;
  past_papers: PastPaper;
}

export default function PastPaperReview() {
  const { paperId, attemptId } = useParams<{ paperId: string; attemptId: string }>();
  const navigate = useNavigate();

  const { data: attempt, isLoading } = useQuery({
    queryKey: ['past-paper-attempt', attemptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('past_paper_attempts')
        .select('*, past_papers(*)')
        .eq('id', attemptId)
        .single();
      if (error) throw error;
      return data as Attempt;
    },
    enabled: !!attemptId,
  });

  if (isLoading || !attempt) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const paper = attempt.past_papers;
  const questions = paper.questions as Question[];
  const answers = attempt.answers as Record<number, string>;
  const feedback = (attempt.ai_feedback || []) as FeedbackItem[];
  const memo = (paper.memo || []) as any[];

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins} minutes`;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-[hsl(var(--teacher-accent))]';
    if (percentage >= 60) return 'text-accent';
    if (percentage >= 40) return 'text-orange-500';
    return 'text-destructive';
  };

  const getScoreBg = (percentage: number) => {
    if (percentage >= 80) return 'bg-[hsl(var(--teacher-accent))]/10';
    if (percentage >= 60) return 'bg-accent/10';
    if (percentage >= 40) return 'bg-orange-500/10';
    return 'bg-destructive/10';
  };

  const getGrade = (percentage: number) => {
    if (percentage >= 80) return { code: 7, symbol: 'A', description: 'Outstanding' };
    if (percentage >= 70) return { code: 6, symbol: 'B', description: 'Meritorious' };
    if (percentage >= 60) return { code: 5, symbol: 'C', description: 'Substantial' };
    if (percentage >= 50) return { code: 4, symbol: 'D', description: 'Adequate' };
    if (percentage >= 40) return { code: 3, symbol: 'E', description: 'Moderate' };
    if (percentage >= 30) return { code: 2, symbol: 'F', description: 'Elementary' };
    return { code: 1, symbol: 'G', description: 'Not Achieved' };
  };

  const grade = getGrade(attempt.percentage);

  const getQuestionFeedback = (questionNumber: number): FeedbackItem | undefined => {
    return feedback.find(f => f.question === questionNumber);
  };

  const getMemoAnswer = (questionNumber: number): string | undefined => {
    const memoItem = memo.find(m => m.number === questionNumber);
    return memoItem?.answers;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/past-papers')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <span>{SUBJECT_ICONS[paper.subject]}</span>
            {paper.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Completed {new Date(attempt.completed_at).toLocaleDateString()} at {new Date(attempt.completed_at).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Results Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className={`glass-card col-span-2 ${getScoreBg(attempt.percentage)}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Your Score</p>
                <p className={`text-5xl font-bold ${getScoreColor(attempt.percentage)}`}>
                  {attempt.percentage.toFixed(0)}%
                </p>
                <p className="text-lg text-muted-foreground mt-1">
                  {attempt.score} / {attempt.total_marks} marks
                </p>
              </div>
              <div className="text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold ${getScoreBg(attempt.percentage)} ${getScoreColor(attempt.percentage)}`}>
                  {grade.symbol}
                </div>
                <p className="text-sm mt-2 font-medium">Level {grade.code}</p>
                <p className="text-xs text-muted-foreground">{grade.description}</p>
              </div>
            </div>

            <div className="mt-6">
              <Progress value={attempt.percentage} className="h-3" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Time Taken</p>
                <p className="font-bold">{formatTime(attempt.time_taken_seconds)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Questions</p>
                <p className="font-bold">{questions.length} total</p>
              </div>
            </div>

            <Button className="w-full gap-2" onClick={() => navigate(`/past-papers/${paperId}`)}>
              <RotateCcw className="w-4 h-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Feedback */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Detailed Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="space-y-2">
            {questions.map((question, idx) => {
              const qFeedback = getQuestionFeedback(question.number);
              const memoAnswer = getMemoAnswer(question.number);
              const studentAnswer = answers[question.number];
              const marksAwarded = qFeedback?.marks_awarded ?? 0;
              const percentage = (marksAwarded / question.marks) * 100;

              return (
                <AccordionItem key={question.number} value={`q-${question.number}`} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 w-full">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        percentage >= 70 
                          ? 'bg-[hsl(var(--teacher-accent))]/20 text-[hsl(var(--teacher-accent))]'
                          : percentage >= 40
                            ? 'bg-orange-500/20 text-orange-500'
                            : 'bg-destructive/20 text-destructive'
                      }`}>
                        {percentage >= 70 ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : percentage >= 40 ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="font-medium">Question {question.number}</span>
                        <span className="text-muted-foreground text-sm ml-2">({question.marks} marks)</span>
                      </div>
                      <Badge variant={percentage >= 70 ? 'default' : percentage >= 40 ? 'secondary' : 'destructive'}>
                        {marksAwarded}/{question.marks}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-4">
                    {/* Question */}
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Question</p>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{question.question}</ReactMarkdown>
                      </div>
                    </div>

                    {/* Student Answer */}
                    <div className="p-3 rounded-lg bg-[hsl(var(--student-accent))]/10 border border-[hsl(var(--student-accent))]/20">
                      <p className="text-xs font-medium text-[hsl(var(--student-accent))] mb-1">Your Answer</p>
                      <p className="text-sm whitespace-pre-wrap">{studentAnswer || 'No answer provided'}</p>
                    </div>

                    {/* Memo Answer */}
                    {memoAnswer && (
                      <div className="p-3 rounded-lg bg-[hsl(var(--teacher-accent))]/10 border border-[hsl(var(--teacher-accent))]/20">
                        <p className="text-xs font-medium text-[hsl(var(--teacher-accent))] mb-1">Model Answer</p>
                        <p className="text-sm whitespace-pre-wrap">{memoAnswer}</p>
                      </div>
                    )}

                    {/* AI Feedback */}
                    {qFeedback?.feedback && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <p className="text-xs font-medium text-primary mb-1">AI Feedback</p>
                        <p className="text-sm">{qFeedback.feedback}</p>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Study Tips */}
      <Card className="glass-card border-[hsl(var(--student-accent))]/30">
        <CardContent className="p-6">
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Tips to Improve
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {attempt.percentage < 50 && (
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                Focus on understanding the core concepts before attempting more papers
              </li>
            )}
            {attempt.percentage >= 50 && attempt.percentage < 70 && (
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                Review the model answers carefully and practice similar questions
              </li>
            )}
            {attempt.percentage >= 70 && (
              <li className="flex items-start gap-2">
                <span className="text-[hsl(var(--teacher-accent))]">•</span>
                Great work! Focus on time management and avoiding careless errors
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="text-[hsl(var(--student-accent))]">•</span>
              Use the AI Tutor to clarify any concepts you're unsure about
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[hsl(var(--student-accent))]">•</span>
              Practice similar papers to reinforce your learning
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { toast } from 'sonner';
import { Loader2, Brain, CheckCircle2, XCircle, Sparkles, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];
type Question = {
  question: string;
  options: Record<string, string>;
  correct: string;
  explanation: string;
};

export default function QuizPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState<MatricSubject | ''>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [generating, setGenerating] = useState(false);
  const [grading, setGrading] = useState(false);

  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('student_profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: progress } = useQuery({
    queryKey: ['student-progress', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('student_progress').select('*').eq('student_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const subjects = (studentProfile?.subjects as MatricSubject[]) || [];

  const generateQuiz = async () => {
    if (!subject) return;
    setGenerating(true);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setFeedback('');

    const weakTopics = progress
      ?.filter(p => p.subject === subject && p.mastery_level < 50)
      .map(p => p.topic) || [];

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ subject, weakTopics, count: 5 }),
      });

      if (!resp.ok) throw new Error('Failed to generate quiz');
      const data = await resp.json();
      setQuestions(data.questions || []);
      if (!data.questions?.length) toast.error('Could not generate questions. Try again.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate quiz');
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

    try {
      // Get AI feedback
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/grade-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
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
      await supabase.from('assignments').insert({
        title: `AI Quiz - ${SUBJECT_LABELS[subject as MatricSubject]}`,
        subject: subject as MatricSubject,
        assignment_type: 'quiz',
        is_ai_generated: true,
        created_by: user!.id,
        questions: questions as any,
      }).select().single().then(async ({ data: assignment }) => {
        if (assignment) {
          await supabase.from('assignment_submissions').insert({
            assignment_id: assignment.id,
            student_id: user!.id,
            answers: questions.map((_, i) => answers[i]) as any,
            score,
            ai_feedback: data.feedback,
          });
        }
      });

      // Update progress for wrong topics
      for (const [i, q] of questions.entries()) {
        if (answers[i] !== q.correct) {
          const topic = q.question.slice(0, 60);
          const existing = progress?.find(p => p.subject === subject && p.topic === topic);
          if (existing) {
            await supabase.from('student_progress').update({
              mastery_level: Math.max(0, existing.mastery_level - 5),
              attempts: existing.attempts + 1,
              last_activity: new Date().toISOString(),
            }).eq('id', existing.id);
          } else {
            await supabase.from('student_progress').insert({
              student_id: user!.id,
              subject: subject as MatricSubject,
              topic,
              mastery_level: 30,
              attempts: 1,
            });
          }
        } else {
          const topic = q.question.slice(0, 60);
          const existing = progress?.find(p => p.subject === subject && p.topic === topic);
          if (existing) {
            await supabase.from('student_progress').update({
              mastery_level: Math.min(100, existing.mastery_level + 10),
              attempts: existing.attempts + 1,
              last_activity: new Date().toISOString(),
            }).eq('id', existing.id);
          } else {
            await supabase.from('student_progress').insert({
              student_id: user!.id,
              subject: subject as MatricSubject,
              topic,
              mastery_level: 70,
              attempts: 1,
            });
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['student-progress'] });
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
          <p className="text-muted-foreground mt-1">Personalised quizzes that adapt to your weak areas</p>
        </div>

        {/* Subject selector + generate */}
        {questions.length === 0 && !generating && (
          <Card className="glass-card">
            <CardContent className="p-6 space-y-4">
              <Select value={subject} onValueChange={(v) => setSubject(v as MatricSubject)}>
                <SelectTrigger><SelectValue placeholder="Choose a subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s} value={s}>{SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={generateQuiz} disabled={!subject} className="w-full" size="lg">
                <Sparkles className="w-4 h-4 mr-2" /> Generate Quiz
              </Button>
              {progress && progress.filter(p => p.subject === subject && p.mastery_level < 50).length > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  🎯 Quiz will focus on your weak areas
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {generating && (
          <Card className="glass-card">
            <CardContent className="p-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-accent" />
              <p className="font-medium">Generating your personalised quiz...</p>
              <p className="text-sm text-muted-foreground mt-1">AI is creating questions based on your weak areas</p>
            </CardContent>
          </Card>
        )}

        {/* Questions */}
        {questions.length > 0 && (
          <>
            {submitted && (
              <Card className={`glass-card ${score >= 70 ? 'border-[hsl(150,60%,40%)]/50' : 'border-destructive/30'}`}>
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold mb-2">{score}%</p>
                  <p className="text-muted-foreground">
                    {score >= 80 ? '🌟 Excellent!' : score >= 60 ? '👍 Good effort!' : '💪 Keep practising!'}
                  </p>
                </CardContent>
              </Card>
            )}

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
                      let variant = 'outline' as const;
                      let extraClass = 'hover:bg-muted/50 cursor-pointer';

                      if (submitted) {
                        extraClass = 'cursor-default';
                        if (isCorrect) extraClass += ' border-[hsl(150,60%,40%)] bg-[hsl(150,60%,40%)]/10';
                        else if (selected && !isCorrect) extraClass += ' border-destructive bg-destructive/10';
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

            {!submitted ? (
              <Button onClick={submitQuiz} disabled={grading || Object.keys(answers).length < questions.length} className="w-full" size="lg">
                {grading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Grading...</> : 'Submit Quiz'}
              </Button>
            ) : (
              <>
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
                <Button onClick={() => { setQuestions([]); setAnswers({}); setSubmitted(false); setFeedback(''); }} variant="outline" className="w-full" size="lg">
                  <RotateCcw className="w-4 h-4 mr-2" /> Take Another Quiz
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

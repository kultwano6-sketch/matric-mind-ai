import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { toast } from 'sonner';
import { ArrowLeft, Send, CheckCircle2, Calendar } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

export default function AssignmentSubmission() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const { data: assignment, isLoading } = useQuery({
    queryKey: ['assignment', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('assignments').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: existingSubmission } = useQuery({
    queryKey: ['submission', id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('assignment_id', id!)
        .eq('student_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!id && !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Build answers array
      const answersArr = Object.entries(answers).map(([idx, answer]) => ({
        question_index: parseInt(idx),
        answer,
      }));

      const { error } = await supabase.from('assignment_submissions').insert({
        assignment_id: id!,
        student_id: user!.id,
        answers: answersArr,
        score: null,
        ai_feedback: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Assignment submitted successfully!');
      navigate('/assignments');
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!assignment) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Assignment not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/assignments')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Assignments
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const questions = (assignment.questions as any[]) || [];
  const hasQuestions = questions.length > 0;

  if (existingSubmission) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl space-y-6 animate-fade-in">
          <Button variant="ghost" onClick={() => navigate('/assignments')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Card className="glass-card border-accent/30">
            <CardContent className="p-8 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 mx-auto text-accent" />
              <h2 className="text-2xl font-display font-bold">Already Submitted</h2>
              {existingSubmission.score !== null && (
                <p className="text-3xl font-bold text-accent">{existingSubmission.score}%</p>
              )}
              {existingSubmission.ai_feedback && (
                <div className="text-left bg-muted p-4 rounded-lg">
                  <p className="text-sm font-medium mb-1">AI Feedback:</p>
                  <p className="text-sm text-muted-foreground">{existingSubmission.ai_feedback}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={() => navigate('/assignments')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Assignments
        </Button>

        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">{SUBJECT_ICONS[assignment.subject]}</span>
                  {assignment.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{SUBJECT_LABELS[assignment.subject]}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="secondary">{assignment.assignment_type}</Badge>
                {assignment.due_date && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {new Date(assignment.due_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {assignment.description && (
              <div className="bg-muted/50 p-4 rounded-lg mb-6">
                <p className="text-sm">{assignment.description}</p>
              </div>
            )}

            {hasQuestions ? (
              <div className="space-y-6">
                {questions.map((q: any, i: number) => (
                  <div key={i} className="space-y-2">
                    <Label className="text-base font-medium">
                      Q{i + 1}. {q.question || q.text || `Question ${i + 1}`}
                    </Label>
                    <Textarea
                      value={answers[i] || ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                      placeholder="Type your answer..."
                      rows={3}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-base font-medium">Your Response</Label>
                <Textarea
                  value={answers[0] || ''}
                  onChange={e => setAnswers({ 0: e.target.value })}
                  placeholder="Type your answer here..."
                  rows={8}
                />
              </div>
            )}

            <Button
              className="w-full mt-6"
              size="lg"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || Object.keys(answers).length === 0}
            >
              <Send className="w-4 h-4 mr-2" />
              {submitMutation.isPending ? 'Submitting...' : 'Submit Assignment'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { toast } from 'sonner';
import { Plus, FileText, Calendar } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export default function LessonPlans() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState<MatricSubject | ''>('');
  const [content, setContent] = useState('');
  const [syllabusPosition, setSyllabusPosition] = useState('');

  const { data: teacherProfile } = useQuery({
    queryKey: ['teacher-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('teacher_profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: plans, isLoading } = useQuery({
    queryKey: ['lesson-plans', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('lesson_plans').select('*').eq('teacher_id', user!.id).order('updated_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const createPlan = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('lesson_plans').insert({
        teacher_id: user!.id,
        topic,
        subject: subject as MatricSubject,
        content,
        syllabus_position: syllabusPosition || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
      toast.success('Lesson plan created!');
      setOpen(false);
      setTopic('');
      setSubject('');
      setContent('');
      setSyllabusPosition('');
    },
    onError: (e) => toast.error(e.message),
  });

  const subjects = (teacherProfile?.subjects as MatricSubject[]) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Lesson Plans</h1>
            <p className="text-muted-foreground mt-1">Manage your lesson plans and syllabus progress</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" /> New Plan</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Lesson Plan</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={subject} onValueChange={(v) => setSubject(v as MatricSubject)}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => (
                        <SelectItem key={s} value={s}>{SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Calculus: Derivatives" />
                </div>
                <div className="space-y-2">
                  <Label>Syllabus Position</Label>
                  <Input value={syllabusPosition} onChange={e => setSyllabusPosition(e.target.value)} placeholder="e.g. Term 2, Week 3" />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Describe your lesson plan, objectives, activities..." rows={6} />
                </div>
                <Button onClick={() => createPlan.mutate()} disabled={!topic || !subject || !content || createPlan.isPending} className="w-full">
                  {createPlan.isPending ? 'Creating...' : 'Create Plan'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {plans && plans.length > 0 ? (
          <div className="space-y-3">
            {plans.map(plan => (
              <Card key={plan.id} className="glass-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-1">{SUBJECT_ICONS[plan.subject]}</span>
                      <div>
                        <h3 className="font-semibold">{plan.topic}</h3>
                        <p className="text-sm text-muted-foreground">{SUBJECT_LABELS[plan.subject]}</p>
                        {plan.syllabus_position && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {plan.syllabus_position}
                          </p>
                        )}
                        <p className="text-sm mt-3 text-foreground/80 whitespace-pre-wrap line-clamp-3">{plan.content}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {new Date(plan.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="glass-card">
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No lesson plans yet. Create your first one!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

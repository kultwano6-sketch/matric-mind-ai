import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { toast } from 'sonner';
import { Plus, BookOpen, Calendar, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export default function AssignmentsPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState<MatricSubject | ''>('');
  const [assignmentType, setAssignmentType] = useState('homework');
  const [dueDate, setDueDate] = useState('');

  const profileTable = role === 'teacher' ? 'teacher_profiles' : 'student_profiles';

  const { data: userProfile } = useQuery({
    queryKey: [profileTable, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from(profileTable).select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: assignments } = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => {
      const { data } = await supabase.from('assignments').select('*').order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const createAssignment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('assignments').insert({
        title,
        description,
        subject: subject as MatricSubject,
        assignment_type: assignmentType,
        created_by: user!.id,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        questions: [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment created!');
      setOpen(false);
      setTitle('');
      setDescription('');
      setSubject('');
      setDueDate('');
    },
    onError: (e) => toast.error(e.message),
  });

  const subjects = ((userProfile as any)?.subjects as MatricSubject[]) || [];
  const isTeacher = role === 'teacher' || role === 'admin';

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Assignments</h1>
            <p className="text-muted-foreground mt-1">
              {isTeacher ? 'Create and manage assignments' : 'View your assignments'}
            </p>
          </div>
          {isTeacher && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-1" /> Create Assignment</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>New Assignment</DialogTitle></DialogHeader>
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
                    <Label>Title</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 5 Homework" />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={assignmentType} onValueChange={setAssignmentType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homework">Homework</SelectItem>
                        <SelectItem value="test">Test</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Instructions for students..." rows={4} />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  </div>
                  <Button onClick={() => createAssignment.mutate()} disabled={!title || !subject || createAssignment.isPending} className="w-full">
                    {createAssignment.isPending ? 'Creating...' : 'Create Assignment'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="space-y-3">
          {assignments?.map(a => (
            <Card key={a.id} className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-1">{SUBJECT_ICONS[a.subject]}</span>
                    <div>
                      <h3 className="font-semibold">{a.title}</h3>
                      <p className="text-sm text-muted-foreground">{SUBJECT_LABELS[a.subject]}</p>
                      {a.description && <p className="text-sm mt-1 text-foreground/80 line-clamp-2">{a.description}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="secondary">{a.assignment_type}</Badge>
                    {a.due_date && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {new Date(a.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {role === 'student' && (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/assignments/${a.id}`)}>
                        <Send className="w-3 h-3 mr-1" /> Submit
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!assignments || assignments.length === 0) && (
            <Card className="glass-card">
              <CardContent className="p-8 text-center text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No assignments yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

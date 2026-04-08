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

type UserProfile = {
  subjects?: MatricSubject[];
} | null;

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

  const { data: userProfile } = useQuery<UserProfile>({
    queryKey: [profileTable, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from(profileTable).select('*').eq('user_id', user!.id).single();
      return data as UserProfile;
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

  const subjects = userProfile?.subjects || [];
  const isTeacher = role === 'teacher' || role === 'admin';

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl gradient-gold flex items-center justify-center shadow-lg shadow-primary/20">
              <BookOpen className="w-7 h-7 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Assignments
              </h1>
              <p className="text-muted-foreground mt-1">
                {isTeacher ? 'Create and manage assignments' : 'View your assignments'}
              </p>
            </div>
          </div>
          {isTeacher && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-hero shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                  <Plus className="w-4 h-4 mr-1" /> Create Assignment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg glass-card border-2 border-primary/20">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg gradient-gold flex items-center justify-center">
                      <Plus className="w-4 h-4 text-secondary-foreground" />
                    </div>
                    New Assignment
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary" /> Subject
                    </Label>
                    <Select value={subject} onValueChange={(v) => setSubject(v as MatricSubject)}>
                      <SelectTrigger className="bg-muted/50 border-primary/20"><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map(s => (
                          <SelectItem key={s} value={s}>{SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" /> Title
                    </Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 5 Homework" className="bg-muted/50 border-primary/20" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Type
                    </Label>
                    <Select value={assignmentType} onValueChange={setAssignmentType}>
                      <SelectTrigger className="bg-muted/50 border-primary/20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homework">Homework</SelectItem>
                        <SelectItem value="test">Test</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" /> Description
                    </Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Instructions for students..." rows={4} className="bg-muted/50 border-primary/20" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" /> Due Date
                    </Label>
                    <Input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-muted/50 border-primary/20" />
                  </div>
                  <Button className="gradient-hero shadow-lg hover:shadow-xl w-full" onClick={() => createAssignment.mutate()} disabled={!title || !subject || createAssignment.isPending}>
                    {createAssignment.isPending ? 'Creating...' : 'Create Assignment'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="space-y-3">
          {assignments?.map(a => (
            <Card key={a.id} className="glass-card border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-lg hover:scale-[1.01]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                      <span className="text-2xl">{SUBJECT_ICONS[a.subject]}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{a.title}</h3>
                      <p className="text-sm text-primary font-medium">{SUBJECT_LABELS[a.subject]}</p>
                      {a.description && <p className="text-sm mt-2 text-muted-foreground">{a.description}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <Badge className="bg-primary/10 text-primary border-primary/20">{a.assignment_type}</Badge>
                    {a.due_date && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-lg">
                        <Calendar className="w-3 h-3" /> Due: {new Date(a.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {role === 'student' && (
                      <Button className="gradient-hero shadow-md hover:shadow-lg" size="sm" onClick={() => navigate(`/assignments/${a.id}`)}>
                        <Send className="w-3 h-3 mr-1" /> Submit
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!assignments || assignments.length === 0) && (
            <Card className="glass-card border-2 border-dashed border-primary/20">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl gradient-gold flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-secondary-foreground" />
                </div>
                <p className="text-lg font-medium text-muted-foreground">No assignments yet</p>
                <p className="text-sm text-muted-foreground mt-1">Check back later for new assignments</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, TrendingUp, BookOpen, Flame } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: progress } = useQuery({
    queryKey: ['student-progress', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_progress')
        .select('*')
        .eq('student_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const subjects = (studentProfile?.subjects as MatricSubject[]) || [];

  const getSubjectProgress = (subject: MatricSubject) => {
    const subjectProgress = progress?.filter(p => p.subject === subject) || [];
    if (subjectProgress.length === 0) return 0;
    return Math.round(subjectProgress.reduce((acc, p) => acc + p.mastery_level, 0) / subjectProgress.length);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold">
          Welcome back, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Ready to ace your matric? Let's get started.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(200,80%,50%)]/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[hsl(200,80%,50%)]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{subjects.length}</p>
                <p className="text-xs text-muted-foreground">Subjects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{subjects.length > 0 ? Math.round(subjects.reduce((acc, s) => acc + getSubjectProgress(s), 0) / subjects.length) : 0}%</p>
                <p className="text-xs text-muted-foreground">Avg Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(150,60%,40%)]/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-[hsl(150,60%,40%)]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progress?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Topics Covered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subjects Grid */}
      <div>
        <h2 className="text-xl font-display font-semibold mb-4">My Subjects</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map(subject => {
            const prog = getSubjectProgress(subject);
            return (
              <Card key={subject} className="glass-card hover:shadow-xl transition-shadow cursor-pointer group" onClick={() => navigate(`/tutor?subject=${subject}`)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="text-2xl">{SUBJECT_ICONS[subject]}</span>
                      <h3 className="font-semibold mt-2">{SUBJECT_LABELS[subject]}</h3>
                    </div>
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Chat
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{prog}%</span>
                    </div>
                    <Progress value={prog} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {subjects.length === 0 && (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No subjects configured yet. Please update your profile with your matric subjects.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

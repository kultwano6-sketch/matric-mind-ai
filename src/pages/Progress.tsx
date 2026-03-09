import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { TrendingUp, Target, AlertCircle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export default function ProgressPage() {
  const { user } = useAuth();

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

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold">My Progress</h1>
          <p className="text-muted-foreground mt-1">Track your performance across all subjects</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map(subject => {
            const subjectProgress = progress?.filter(p => p.subject === subject) || [];
            const avgMastery = subjectProgress.length > 0
              ? Math.round(subjectProgress.reduce((a, p) => a + p.mastery_level, 0) / subjectProgress.length)
              : 0;
            const mastered = subjectProgress.filter(p => p.mastery_level >= 80);
            const needsWork = subjectProgress.filter(p => p.mastery_level < 50);

            return (
              <Card key={subject} className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span>{SUBJECT_ICONS[subject]}</span>
                    {SUBJECT_LABELS[subject]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Overall</span>
                      <span className="font-medium">{avgMastery}%</span>
                    </div>
                    <ProgressBar value={avgMastery} className="h-2" />
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-[hsl(150,60%,40%)]" />
                      <span>{mastered.length} mastered</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <span>{needsWork.length} needs work</span>
                    </div>
                  </div>
                  {subjectProgress.length === 0 && (
                    <p className="text-xs text-muted-foreground">Start studying to track progress</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {subjects.length === 0 && (
          <Card className="glass-card">
            <CardContent className="p-8 text-center text-muted-foreground">
              No subjects configured. Update your profile to see progress.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

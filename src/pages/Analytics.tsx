import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SUBJECT_LABELS } from '@/lib/subjects';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

const COLORS = ['hsl(220,70%,50%)', 'hsl(160,50%,40%)', 'hsl(260,50%,50%)', 'hsl(0,60%,50%)', 'hsl(38,45%,45%)', 'hsl(30,80%,55%)', 'hsl(170,60%,45%)'];

export default function AnalyticsPage() {
  const { user, effectiveRole } = useAuth();
  
  const { data: teacherProfile } = useQuery({
    queryKey: ['teacher-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('teacher_profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user && (effectiveRole === 'teacher' || effectiveRole === 'head_teacher'),
  });

  const teacherSubjects = (teacherProfile?.subjects as MatricSubject[]) || [];

  const { data: progress } = useQuery({
    queryKey: ['analytics-progress'],
    queryFn: async () => {
      const { data } = await supabase.from('student_progress').select('*');
      return data || [];
    },
  });

  // Filter progress by teacher's subjects if teacher
  const filteredProgress = (effectiveRole === 'teacher' && teacherSubjects.length > 0)
    ? progress?.filter(p => teacherSubjects.includes(p.subject as MatricSubject)) || []
    : progress || [];

  const { data: submissions } = useQuery({
    queryKey: ['analytics-submissions'],
    queryFn: async () => {
      const { data } = await supabase.from('assignment_submissions').select('*');
      return data || [];
    },
  });

  // Subject averages - filtered by teacher's subjects
  const subjectMap = new Map<string, number[]>();
  filteredProgress.forEach(p => {
    const arr = subjectMap.get(p.subject) || [];
    arr.push(p.mastery_level);
    subjectMap.set(p.subject, arr);
  });

  const subjectData = Array.from(subjectMap.entries()).map(([subject, levels]) => ({
    subject: SUBJECT_LABELS[subject as MatricSubject]?.slice(0, 15) || subject,
    avg: Math.round(levels.reduce((a, b) => a + b, 0) / levels.length),
    students: levels.length,
  })).sort((a, b) => b.avg - a.avg);

  // Performance distribution - filtered
  const distribution = [
    { range: '0-20%', count: filteredProgress.filter(p => p.mastery_level <= 20).length },
    { range: '21-40%', count: filteredProgress.filter(p => p.mastery_level > 20 && p.mastery_level <= 40).length },
    { range: '41-60%', count: filteredProgress.filter(p => p.mastery_level > 40 && p.mastery_level <= 60).length },
    { range: '61-80%', count: filteredProgress.filter(p => p.mastery_level > 60 && p.mastery_level <= 80).length },
    { range: '81-100%', count: filteredProgress.filter(p => p.mastery_level > 80).length },
  ];

  // Test scores distribution
  const scoreData = submissions?.filter(s => s.score != null).map(s => ({ score: s.score })) || [];

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold">
            {effectiveRole === 'teacher' ? 'My Subject Analytics' : 'School Analytics'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {effectiveRole === 'teacher' 
              ? `Performance overview for your subjects: ${teacherSubjects.map(s => SUBJECT_LABELS[s]).join(', ')}`
              : 'Comprehensive performance overview'
            }
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg">Average Mastery by Subject</CardTitle></CardHeader>
            <CardContent>
              {subjectData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={subjectData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis type="category" dataKey="subject" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="avg" fill="hsl(200,80%,50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-16">No data yet</p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg">Performance Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={distribution}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {distribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">Subject Student Coverage</CardTitle></CardHeader>
          <CardContent>
            {subjectData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={subjectData} dataKey="students" nameKey="subject" cx="50%" cy="50%" outerRadius={100} label>
                    {subjectData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

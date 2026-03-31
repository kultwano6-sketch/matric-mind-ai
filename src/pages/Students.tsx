import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export default function StudentsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [filterSubject, setFilterSubject] = useState<string>(searchParams.get('subject') || 'all');

  const { data: teacherProfile } = useQuery({
    queryKey: ['teacher-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('teacher_profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: studentProgress } = useQuery({
    queryKey: ['all-student-progress'],
    queryFn: async () => {
      const { data } = await supabase.from('student_progress').select('*');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: profiles } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: studentProfiles } = useQuery({
    queryKey: ['all-student-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('student_profiles').select('*');
      return data || [];
    },
    enabled: !!user,
  });

  const teacherSubjects = (teacherProfile?.subjects as MatricSubject[]) || [];

  // Filter students to only those who have at least one of the teacher's subjects
  const filteredStudentProfiles = studentProfiles?.filter(sp => {
    const studentSubjects = (sp.subjects as MatricSubject[]) || [];
    return studentSubjects.some(s => teacherSubjects.includes(s));
  }) || [];

  // Get student IDs that match
  const filteredStudentIds = new Set(filteredStudentProfiles.map(sp => sp.user_id));

  // Group progress by student - only for filtered students
  const filtered = filterSubject === 'all'
    ? studentProgress?.filter(p => filteredStudentIds.has(p.student_id)) || []
    : studentProgress?.filter(p => filteredStudentIds.has(p.student_id) && p.subject === filterSubject) || [];

  const studentMap = new Map<string, typeof filtered>();
  filtered.forEach(p => {
    const arr = studentMap.get(p.student_id) || [];
    arr.push(p);
    studentMap.set(p.student_id, arr);
  });

  const students = Array.from(studentMap.entries()).map(([id, progress]) => {
    const avg = Math.round(progress.reduce((a, p) => a + p.mastery_level, 0) / progress.length);
    const prof = profiles?.find(p => p.user_id === id);
    return { id, name: prof?.full_name || 'Unknown', avgMastery: avg, topics: progress.length, progress };
  }).sort((a, b) => a.avgMastery - b.avgMastery);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Student Progress</h1>
            <p className="text-muted-foreground mt-1">Monitor your students' performance</p>
          </div>
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All my subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All My Subjects</SelectItem>
              {teacherSubjects.map(s => (
                <SelectItem key={s} value={s}>{SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{students.length}</p>
                <p className="text-xs text-muted-foreground">Total Students</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{students.filter(s => s.avgMastery >= 70).length}</p>
                <p className="text-xs text-muted-foreground">Excelling</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{students.filter(s => s.avgMastery < 40).length}</p>
                <p className="text-xs text-muted-foreground">Struggling</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          {students.map(student => (
            <Card key={student.id} className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-medium text-sm">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.topics} topics covered</p>
                    </div>
                  </div>
                  <Badge variant={student.avgMastery >= 70 ? 'default' : student.avgMastery >= 40 ? 'secondary' : 'destructive'}>
                    {student.avgMastery}%
                  </Badge>
                </div>
                <Progress value={student.avgMastery} className="h-2" />
              </CardContent>
            </Card>
          ))}
          {students.length === 0 && (
            <Card className="glass-card">
              <CardContent className="p-8 text-center text-muted-foreground">
                No student progress data found for your subjects yet.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

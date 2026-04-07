import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Brain, Target, BookOpen, AlertTriangle, CheckCircle, RefreshCw, Loader2
} from 'lucide-react';

interface SubjectScore {
  subject: string;
  score: number;
  total: number;
  average: number;
}

interface LearnerReadiness {
  overall_score: number;
  subjects: SubjectScore[];
  quiz_count: number;
  total_study_time_minutes: number;
  strong_areas: string[];
  weak_areas: string[];
  recommendations: string[];
}

const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: '#3b82f6',
  'Physical Sciences': '#22c55e',
  'Life Sciences': '#8b5cf6',
  English: '#f59e0b',
  Accounting: '#ef4444',
  Geography: '#14b8a6',
  History: '#ec4899',
  Economics: '#f97316',
};

export default function MatricReadiness() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState<LearnerReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch quiz results from Supabase
        const { data: quizResults, error: quizError } = await supabase
          .from('quiz_results')
          .select('score, total_marks, subject, completed_at')
          .eq('student_id', user.id)
          .order('completed_at', { ascending: true })
          .limit(50);

        if (quizError) throw quizError;

        if (!quizResults || quizResults.length === 0) {
          setReadiness({
            overall_score: 0,
            subjects: [],
            quiz_count: 0,
            total_study_time_minutes: 0,
            strong_areas: [],
            weak_areas: [],
            recommendations: ['Complete some quizzes to see your readiness data'],
          });
          setLoading(false);
          return;
        }

        // Calculate subject averages
        const subjectScores: Record<string, number[]> = {};
        quizResults.forEach((quiz: any) => {
          if (!subjectScores[quiz.subject]) {
            subjectScores[quiz.subject] = [];
          }
          const percentage = (quiz.score / quiz.total_marks) * 100;
          subjectScores[quiz.subject].push(percentage);
        });

        const subjectData: SubjectScore[] = Object.entries(subjectScores).map(([subject, scores]) => {
          const average = scores.reduce((a, b) => a + b, 0) / scores.length;
          return {
            subject,
            score: Math.round(average),
            total: 100,
            average: Math.round(average),
          };
        });

        // Calculate overall score
        const allScores = Object.values(subjectScores).flat();
        const overallScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

        // Identify strong and weak areas
        const strongAreas = subjectData.filter(s => s.average >= 60).map(s => s.subject);
        const weakAreas = subjectData.filter(s => s.average < 60).map(s => s.subject);

        // Generate recommendations
        const recommendations: string[] = [];
        if (weakAreas.length > 0) {
          recommendations.push(`Focus on improving ${weakAreas.join(', ')}`);
        }
        if (overallScore < 50) {
          recommendations.push('Start with foundational topics to build confidence');
        } else if (overallScore < 70) {
          recommendations.push('Practice more questions to improve speed and accuracy');
        } else {
          recommendations.push('Keep up the great work! Focus on exam-style questions');
        }

        setReadiness({
          overall_score: overallScore,
          subjects: subjectData,
          quiz_count: quizResults.length,
          total_study_time_minutes: quizResults.length * 15,
          strong_areas: strongAreas,
          weak_areas: weakAreas,
          recommendations,
        });
      } catch (err: any) {
        console.error('Error fetching readiness:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  const handleRefresh = () => {
    window.location.reload();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] gap-4">
          <p className="text-red-500">Error: {error}</p>
          <Button onClick={handleRefresh}>Retry</Button>
        </div>
      </DashboardLayout>
    );
  }

  const hasData = readiness && readiness.quiz_count > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Learner Readiness</h1>
            <p className="text-muted-foreground">Track your exam preparation progress</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {!hasData ? (
          <Card className="p-8 text-center">
            <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Data Yet</h3>
            <p className="text-muted-foreground mb-4">Complete some quizzes to see your readiness assessment.</p>
            <Button onClick={() => window.location.href = '/quiz'}>
              <Target className="w-4 h-4 mr-2" />
              Take a Quiz
            </Button>
          </Card>
        ) : (
          <>
            {/* Main Score Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Overall Readiness
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="relative w-40 h-40">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                        <circle
                          cx="50" cy="50" r="45" fill="none"
                          stroke={readiness!.overall_score >= 60 ? '#22c55e' : readiness!.overall_score >= 40 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="8"
                          strokeDasharray={`${(readiness!.overall_score / 100) * 283} 283`}
                          strokeLinecap="round"
                          transform="rotate(-90 50 50)"
                          className="transition-all duration-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl font-bold">{readiness!.overall_score}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-center text-muted-foreground">
                    Based on {readiness!.quiz_count} quizzes completed
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Quizzes</span>
                    <span className="font-semibold">{readiness!.quiz_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Subjects</span>
                    <span className="font-semibold">{readiness!.subjects.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Study Time</span>
                    <span className="font-semibold">{Math.round(readiness!.total_study_time_minutes / 60)}h</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Subject Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Subject Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={readiness!.subjects} layout="vertical">
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="subject" width={100} />
                      <Tooltip />
                      <Bar dataKey="average" radius={[0, 4, 4, 0]}>
                        {readiness!.subjects.map((entry, index) => (
                          <Cell key={index} fill={SUBJECT_COLORS[entry.subject] || '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Strong & Weak Areas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Strong Areas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {readiness!.strong_areas.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {readiness!.strong_areas.map(area => (
                        <Badge key={area} variant="secondary" className="bg-green-100 text-green-700">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Keep practicing to build strong areas!</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    Areas to Improve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {readiness!.weak_areas.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {readiness!.weak_areas.map(area => (
                        <Badge key={area} variant="secondary" className="bg-yellow-100 text-yellow-700">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">All subjects are performing well!</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Study Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {readiness!.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
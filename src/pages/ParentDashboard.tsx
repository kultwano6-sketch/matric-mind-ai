import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SUBJECT_LABELS } from '@/lib/subjects';
import {
  Users, Plus, X, BarChart3, Clock, BookOpen, Target,
  AlertTriangle, TrendingUp, TrendingDown, FileText,
  Loader2, ExternalLink, ChevronRight, Shield
} from 'lucide-react';

interface ChildInfo {
  id: string;
  name: string;
  avatar_url: string | null;
  grade: number | null;
}

interface ChildReport {
  student: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  study_summary: {
    total_hours: number;
    total_sessions: number;
    completed_sessions: number;
    completion_rate: number;
  };
  quiz_summary: {
    quizzes_taken: number;
    avg_score_this_week: number | null;
    avg_score_last_week: number | null;
    trend: 'improving' | 'declining' | 'stable';
    trend_value: number;
    subject_performance: Array<{ subject: string; avg_score: number; quiz_count: number }>;
  };
  matric_readiness: {
    score: number;
    status: string;
  };
  weak_subjects: Array<{ subject: string; avg_score: number; quiz_count: number }>;
  weak_topics: Array<{ subject: string; topic: string; mastery_pct: number }>;
  recommendations: Array<{ subject: string; topic: string; reason: string; priority: number }>;
  ai_summary: string;
  generated_at: string;
  week_period: {
    from: string;
    to: string;
  };
}

const READINESS_COLORS: Record<string, string> = {
  excellent: '#22c55e',
  good: '#3b82f6',
  needs_work: '#f59e0b',
  critical: '#ef4444',
};

export default function ParentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [linkedChildren, setLinkedChildren] = useState<ChildInfo[]>([]);
  const [reports, setReports] = useState<Map<string, ChildReport>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linking, setLinking] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ChildReport | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportLoading, setReportLoading] = useState<string | null>(null);

  // Fetch linked children
  const fetchLinkedChildren = useCallback(async () => {
    if (!user?.id) {
      console.warn('No user logged in');
      setLoading(false);
      return;
    }

    try {
      // Fetch parent links
      const { data: links, error: linksError } = await supabase
        .from('parent_links')
        .select('student_user_id, relationship')
        .eq('parent_user_id', user.id);

      if (linksError) {
        console.error('Error fetching parent_links:', linksError);
        throw new Error(linksError.message);
      }

      if (!links || links.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch student profiles
      const studentIds = links.map((l: any) => l.student_user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', studentIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw new Error(profilesError.message);
      }

      // Fetch grades
      const { data: studentProfiles, error: studentProfilesError } = await supabase
        .from('student_profiles')
        .select('user_id, grade')
        .in('user_id', studentIds);

      if (studentProfilesError) {
        console.error('Error fetching student_profiles:', studentProfilesError);
      }

      const gradeMap = new Map<number | null>();
      if (studentProfiles) {
        for (const sp of (studentProfiles as any[])) {
          gradeMap.set(sp.user_id, sp.grade);
        }
      }

      const children: ChildInfo[] = (profiles || []).map((p: any) => ({
        id: p.id,
        name: p.full_name || 'Student',
        avatar_url: p.avatar_url,
        grade: gradeMap.get(p.id) as number | null,
      }));

      setLinkedChildren(children);

      // Fetch reports for each child
      for (const child of children) {
        await fetchChildReport(child.id);
      }
    } catch (error: any) {
      console.error('Error fetching linked children:', error);
      toast({
        title: 'Error',
        description: error.message || 'Could not load linked student accounts.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const fetchChildReport = async (studentId: string) => {
    setReportLoading(studentId);
    try {
      const response = await fetch('/api/parent-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API error: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.error) {
        throw new Error(data.message || data.error);
      }

      setReports(prev => {
        const next = new Map(prev);
        next.set(studentId, data.report);
        return next;
      });
    } catch (error: any) {
      console.error('Error fetching report for', studentId, error);
    } finally {
      setReportLoading(null);
    }
  };

  useEffect(() => {
    fetchLinkedChildren();
  }, [fetchLinkedChildren]);

  const handleLinkChild = async () => {
    if (!user?.id || !linkEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please log in and enter a student email.',
        variant: 'destructive',
      });
      return;
    }

    setLinking(true);
    try {
      // Look up student by email
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', linkEmail.trim().toLowerCase())
        .maybeSingle();

      if (error) {
        console.error('Profile lookup error:', error);
        throw new Error('Could not search for student. Please try again.');
      }

      if (!profiles) {
        throw new Error('No account found with that email address.');
      }

      const studentId = profiles.id;

      // Check if already linked
      const { data: existing, error: existingError } = await supabase
        .from('parent_links')
        .select('id')
        .eq('parent_user_id', user.id)
        .eq('student_user_id', studentId)
        .maybeSingle();

      if (existingError) {
        console.error('Check existing link error:', existingError);
      }

      if (existing) {
        throw new Error('This student is already linked to your account.');
      }

      // Create the link
      const { error: linkError } = await supabase
        .from('parent_links')
        .insert({
          parent_user_id: user.id,
          student_user_id: studentId,
          relationship: 'parent',
        });

      if (linkError) {
        console.error('Link creation error:', linkError);
        throw new Error(linkError.message);
      }

      toast({
        title: 'Student Linked',
        description: `${profiles.full_name || 'Student'} has been linked to your account.`,
      });

      setLinkEmail('');
      setShowLinkDialog(false);
      await fetchLinkedChildren();
    } catch (error: any) {
      toast({
        title: 'Link Failed',
        description: error.message || 'Could not link student account.',
        variant: 'destructive',
      });
    } finally {
      setLinking(false);
    }
  };

  const handleRemoveLink = async (studentId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('parent_links')
        .delete()
        .eq('parent_user_id', user.id)
        .eq('student_user_id', studentId);

      setLinkedChildren(prev => prev.filter(c => c.id !== studentId));
      setReports(prev => {
        const next = new Map(prev);
        next.delete(studentId);
        return next;
      });

      toast({
        title: 'Student Removed',
        description: 'The student link has been removed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not remove student link.',
        variant: 'destructive',
      });
    }
  };

  const viewDetailedReport = (report: ChildReport) => {
    setSelectedReport(report);
    setShowReportModal(true);
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

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Parent Dashboard</h1>
            <p className="text-muted-foreground">Monitor your children's academic progress</p>
          </div>
          <Button onClick={() => setShowLinkDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Link Student
          </Button>
        </div>

        {/* No children state */}
        {linkedChildren.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="pt-12 pb-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-display font-semibold mb-2">No Students Linked</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Link your child's Matric Mind AI account to monitor their study progress,
                quiz scores, and get weekly reports.
              </p>
              <Button onClick={() => setShowLinkDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Link Your First Student
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Children Reports */
          <div className="space-y-6">
            {linkedChildren.map((child) => {
              const report = reports.get(child.id);
              const loading = reportLoading === child.id;

              return (
                <motion.div
                  key={child.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="glass-card overflow-hidden">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                            {child.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{child.name}</CardTitle>
                            <CardDescription>
                              {child.grade ? `Grade ${child.grade}` : 'Student'}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {report && (
                            <Button variant="outline" size="sm" onClick={() => fetchChildReport(child.id)}>
                              <Loader2 className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                              Refresh
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveLink(child.id)}>
                            <X className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      {loading && !report ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          <span className="ml-2 text-sm text-muted-foreground">Loading report...</span>
                        </div>
                      ) : report ? (
                        <div className="space-y-4">
                          {/* Summary Cards */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="w-4 h-4 text-blue-500" />
                                <span className="text-xs text-muted-foreground">Study Time</span>
                              </div>
                              <p className="text-lg font-bold">{report.study_summary.total_hours}h</p>
                              <p className="text-xs text-muted-foreground">
                                {report.study_summary.completed_sessions} sessions completed
                              </p>
                            </div>

                            <div className="p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2 mb-1">
                                <Target className="w-4 h-4 text-green-500" />
                                <span className="text-xs text-muted-foreground">Avg Score</span>
                              </div>
                              <p className="text-lg font-bold">
                                {report.quiz_summary.avg_score_this_week !== null
                                  ? `${report.quiz_summary.avg_score_this_week}%`
                                  : 'N/A'}
                              </p>
                              <div className="flex items-center gap-1">
                                {report.quiz_summary.trend === 'improving' ? (
                                  <TrendingUp className="w-3 h-3 text-green-500" />
                                ) : report.quiz_summary.trend === 'declining' ? (
                                  <TrendingDown className="w-3 h-3 text-red-500" />
                                ) : null}
                                <span className={`text-xs ${
                                  report.quiz_summary.trend === 'improving' ? 'text-green-500' :
                                  report.quiz_summary.trend === 'declining' ? 'text-red-500' : 'text-muted-foreground'
                                }`}>
                                  {report.quiz_summary.trend === 'improving' ? 'Improving' :
                                   report.quiz_summary.trend === 'declining' ? 'Declining' : 'Stable'}
                                </span>
                              </div>
                            </div>

                            <div className="p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2 mb-1">
                                <BookOpen className="w-4 h-4 text-purple-500" />
                                <span className="text-xs text-muted-foreground">Quizzes</span>
                              </div>
                              <p className="text-lg font-bold">{report.quiz_summary.quizzes_taken}</p>
                              <p className="text-xs text-muted-foreground">this week</p>
                            </div>

                            <div className="p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2 mb-1">
                                <BarChart3 className="w-4 h-4 text-yellow-500" />
                                <span className="text-xs text-muted-foreground">Readiness</span>
                              </div>
                              <p className="text-lg font-bold" style={{ color: READINESS_COLORS[report.matric_readiness.status] || '#6b7280' }}>
                                {report.matric_readiness.score}%
                              </p>
                              <Badge variant="outline" className="text-xs mt-1">
                                {report.matric_readiness.status}
                              </Badge>
                            </div>
                          </div>

                          {/* Weak Subjects Alert */}
                          {report.weak_subjects.length > 0 && (
                            <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                <span className="text-sm font-medium">Subjects Needing Attention</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {report.weak_subjects.map((ws) => (
                                  <Badge key={ws.subject} variant="outline" className="border-yellow-500/50 text-yellow-700">
                                    {SUBJECT_LABELS[ws.subject as keyof typeof SUBJECT_LABELS] || ws.subject}
                                    {' '}({ws.avg_score}%)
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* AI Summary */}
                          {report.ai_summary && (
                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                              <p className="text-sm text-muted-foreground italic">
                                "{report.ai_summary}"
                              </p>
                            </div>
                          )}

                          {/* View Full Report Button */}
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => viewDetailedReport(report)}
                          >
                            View Detailed Report
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <p className="text-sm">Report data unavailable</p>
                          <Button variant="ghost" size="sm" onClick={() => fetchChildReport(child.id)} className="mt-2">
                            Try Again
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Link Student Dialog */}
        <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link Student Account</DialogTitle>
              <DialogDescription>
                Enter the email address associated with your child's Matric Mind AI account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="student-email">Student Email</Label>
                <Input
                  id="student-email"
                  type="email"
                  placeholder="student@example.com"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLinkChild()}
                />
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <Shield className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">
                  The student will be able to see that a parent is linked to their account.
                  They can remove the link at any time.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleLinkChild} disabled={!linkEmail.trim() || linking}>
                  {linking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Link Student
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Detailed Report Modal */}
        <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedReport && (
              <>
                <DialogHeader>
                  <DialogTitle>Weekly Report - {selectedReport.student.name}</DialogTitle>
                  <DialogDescription>
                    Week of {new Date(selectedReport.week_period.from).toLocaleDateString()} - {new Date(selectedReport.week_period.to).toLocaleDateString()}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                  {/* Study Summary */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Study Summary</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-xl font-bold">{selectedReport.study_summary.total_hours}h</p>
                        <p className="text-xs text-muted-foreground">Total Hours</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-xl font-bold">{selectedReport.study_summary.completed_sessions}</p>
                        <p className="text-xs text-muted-foreground">Sessions Done</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-xl font-bold">{selectedReport.study_summary.completion_rate}%</p>
                        <p className="text-xs text-muted-foreground">Completion Rate</p>
                      </div>
                    </div>
                  </div>

                  {/* Subject Performance Chart */}
                  {selectedReport.quiz_summary.subject_performance.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Subject Performance</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={selectedReport.quiz_summary.subject_performance}>
                          <XAxis
                            dataKey="subject"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) => SUBJECT_LABELS[v as keyof typeof SUBJECT_LABELS]?.substring(0, 10) || v}
                          />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                            formatter={(value: number) => [`${value}%`, 'Avg Score']}
                            labelFormatter={(label) => SUBJECT_LABELS[label as keyof typeof SUBJECT_LABELS] || label}
                          />
                          <Bar dataKey="avg_score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Weak Topics */}
                  {selectedReport.weak_topics.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Weak Topics</h3>
                      <div className="space-y-2">
                        {selectedReport.weak_topics.map((wt, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                            <div>
                              <span className="text-sm font-medium">{wt.topic}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({SUBJECT_LABELS[wt.subject as keyof typeof SUBJECT_LABELS] || wt.subject})
                              </span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {wt.mastery_pct}% mastery
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {selectedReport.recommendations.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Study Recommendations</h3>
                      <div className="space-y-2">
                        {selectedReport.recommendations.map((rec, idx) => (
                          <div key={idx} className="p-3 rounded-lg border border-primary/10 bg-primary/5">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {SUBJECT_LABELS[rec.subject as keyof typeof SUBJECT_LABELS] || rec.subject}
                              </Badge>
                              <span className="text-sm font-medium">{rec.topic}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{rec.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Summary */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">AI Summary</h3>
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                      <p className="text-sm">{selectedReport.ai_summary}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// ============================================================
// Matric Mind AI - Teacher Insights & Decision Panel
// Actionable insights, at-risk interventions, decision support
// ============================================================

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, TrendingUp, BookOpen, Users, Lightbulb, 
  Target, Brain, Clock, ChevronRight, Loader2, ArrowUp,
  ArrowDown, AlertCircle, CheckCircle
} from 'lucide-react';

interface Insight {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  problem: string;
  cause: string;
  action: string;
  affected_count?: number;
  subjects?: string[];
  timestamp: string;
}

interface AtRiskStudent {
  student_id: string;
  student_name: string;
  readiness_score: number;
  risk_reasons: string[];
  recommended_topics: string[];
  intervention_plan: string;
}

interface ClassDecision {
  question: string;
  answer: string;
  confidence: number;
  supporting_data: string[];
}

export default function TeacherInsights() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [decisions, setDecisions] = useState<ClassDecision[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  async function loadData() {
    if (!user?.id) return;
    setLoading(true);
    
    try {
      // Load insights
      const insightsRes = await fetch('/api/insights-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: user.id, type: 'class' }),
      });
      const insightsData = await insightsRes.json();
      setInsights(insightsData.insights || []);

      // Load class stats for decisions
      const statsRes = await fetch('/api/teacher-analytics', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: user.id }),
      });
      const statsData = await statsRes.json();
      setStats(statsData);

      // Generate decision questions
      const decisions: ClassDecision[] = [
        {
          question: 'What should I teach next?',
          answer: insightsData.insights?.find((i: Insight) => i.type === 'class' && i.severity === 'critical')
            ? `Focus on: ${insightsData.insights[0]?.action?.split('.')[0] || 'topics causing class-wide struggles'}`
            : 'Continue with planned curriculum. Class performance is stable.',
          confidence: 85,
          supporting_data: ['Class weak topics analysis', 'Quiz performance trends'],
        },
        {
          question: 'Which students need immediate help?',
          answer: statsData.at_risk?.length > 0 
            ? `${statsData.at_risk.length} students require intervention. Top priority: ${statsData.at_risk[0]?.student_name || 'student'}` 
            : 'All students are performing adequately.',
          confidence: 90,
          supporting_data: ['At-risk classification', 'Readiness scores'],
        },
        {
          question: 'What are the top weak topics this week?',
          answer: insightsData.insights?.filter((i: Insight) => i.affected_count)
            .slice(0, 3).map((i: Insight) => i.title).join(', ') || 'No critical weak topics identified',
          confidence: 75,
          supporting_data: ['Topic mastery data', 'Error pattern analysis'],
        },
      ];
      setDecisions(decisions);

    } catch (error) {
      console.error('Error loading teacher insights:', error);
    } finally {
      setLoading(false);
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'warning': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
    }
  }

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
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500/20 via-purple-500/10 to-pink-500/20 p-6"
        >
          <div className="relative z-10">
            <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
              Teacher Insights
            </h1>
            <p className="text-muted-foreground mt-1">Actionable intelligence for better decisions</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="absolute right-6 top-6 bg-background/50">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </motion.div>

        {/* Decision Panel - Most Important */}
        <div className="grid md:grid-cols-3 gap-4">
          {decisions.map((decision, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="h-full border-2 border-indigo-500/20 shadow-lg bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-indigo-500" />
                    {decision.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium text-indigo-700 dark:text-indigo-300">{decision.answer}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{decision.confidence}% confidence</span>
                    <span>{decision.supporting_data.length} data points</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="insights" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="insights" className="rounded-lg">Actionable Insights</TabsTrigger>
            <TabsTrigger value="at-risk" className="rounded-lg">At-Risk Interventions</TabsTrigger>
            <TabsTrigger value="summary" className="rounded-lg">Class Summary</TabsTrigger>
          </TabsList>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-4">
            {insights.length === 0 ? (
              <Card className="border-2 border-border/50">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p className="font-medium text-green-600">No critical issues detected</p>
                  <p className="text-sm text-muted-foreground">Your class is performing well!</p>
                </CardContent>
              </Card>
            ) : (
              insights.map((insight, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className={`border-2 ${getSeverityColor(insight.severity).split(' ')[2]} ${getSeverityColor(insight.severity).split(' ')[0]}/10`}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${getSeverityColor(insight.severity).split(' ')[0]}`}>
                          {insight.severity === 'critical' ? (
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                          ) : insight.severity === 'warning' ? (
                            <AlertCircle className="w-5 h-5 text-yellow-500" />
                          ) : (
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{insight.title}</h3>
                            <Badge variant={insight.severity === 'critical' ? 'destructive' : 'secondary'}>
                              {insight.severity}
                            </Badge>
                            {insight.affected_count && (
                              <Badge variant="outline">{insight.affected_count} affected</Badge>
                            )}
                          </div>
                          
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-medium text-red-500">Problem: </span>
                              <span>{insight.problem}</span>
                            </div>
                            <div>
                              <span className="font-medium text-yellow-600">Cause: </span>
                              <span className="text-muted-foreground">{insight.cause}</span>
                            </div>
                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                              <span className="font-medium text-green-600">✓ Action: </span>
                              <span>{insight.action}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </TabsContent>

          {/* At-Risk Tab */}
          <TabsContent value="at-risk" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Critical */}
              <Card className="border-2 border-red-200/50 bg-red-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                    Critical (Score &lt;50%)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stats?.at_risk_critical || 0}</p>
                  <p className="text-sm text-muted-foreground">students need immediate intervention</p>
                </CardContent>
              </Card>

              {/* Warning */}
              <Card className="border-2 border-yellow-200/50 bg-yellow-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-600">
                    <AlertCircle className="w-5 h-5" />
                    Warning (Score 50-65%)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stats?.at_risk_warning || 0}</p>
                  <p className="text-sm text-muted-foreground">students need extra support</p>
                </CardContent>
              </Card>
            </div>

            {/* Suggested Interventions */}
            <Card className="border-2 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Suggested Interventions
                </CardTitle>
                <CardDescription>Automated actions based on at-risk patterns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { title: 'After-school tutoring', description: 'Schedule 2 sessions per week for critical students', icon: Clock },
                  { title: 'Parent meetings', description: 'Send progress reports to parents of at-risk students', icon: Users },
                  { title: 'Peer tutoring', description: 'Pair strong students with struggling ones', icon: BookOpen },
                  { title: 'Extra practice', description: 'Assign targeted worksheets on weak topics', icon: Target },
                ].map((intervention, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <intervention.icon className="w-5 h-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">{intervention.title}</p>
                      <p className="text-sm text-muted-foreground">{intervention.description}</p>
                    </div>
                    <Button size="sm" variant="outline">Apply</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-2 border-border/50">
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-green-500">{stats?.students_above_65 || 0}</p>
                  <p className="text-muted-foreground">performing well</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-border/50">
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-yellow-500">{stats?.students_between_50_65 || 0}</p>
                  <p className="text-muted-foreground">need monitoring</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-border/50">
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-red-500">{stats?.students_below_50 || 0}</p>
                  <p className="text-muted-foreground">need urgent help</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-2 border-border/50">
              <CardHeader>
                <CardTitle>AI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                  <p className="text-indigo-700">
                    Your class is progressing {stats?.trend || 'steadily'}. 
                    Focus on {stats?.priority_topic || 'reviewing weak topics'} this week.
                    {stats?.at_risk_critical > 0 ? ` ${stats.at_risk_critical} students need immediate attention.` : ''}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
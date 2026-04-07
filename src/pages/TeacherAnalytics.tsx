// ============================================================
// Matric Mind AI - Teacher Analytics Dashboard
// ============================================================
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, TrendingUp, AlertTriangle, BookOpen, RefreshCw, Loader2, GraduationCap } from 'lucide-react';

export default function TeacherAnalytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-[calc(100vh-8rem)]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500/20 via-purple-500/10 to-pink-500/20 p-6">
          <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">Teacher Analytics</h1>
          <p className="text-muted-foreground mt-1">Class performance insights and student monitoring</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users, label: 'Total Students', value: '0', color: 'blue' },
            { icon: TrendingUp, label: 'Avg Score', value: '0%', color: 'green' },
            { icon: BookOpen, label: 'Subjects', value: '0', color: 'purple' },
            { icon: AlertTriangle, label: 'At Risk', value: '0', color: 'red' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-2 border-border/50 shadow-sm"><CardContent className="p-4 text-center">
                <div className={`w-12 h-12 rounded-full bg-${stat.color}-500/10 flex items-center justify-center mx-auto mb-3`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent></Card>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
            <TabsTrigger value="subjects" className="rounded-lg">Subjects</TabsTrigger>
            <TabsTrigger value="at-risk" className="rounded-lg">At Risk</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card className="border-2 border-border/50 shadow-sm">
              <CardHeader><CardTitle>Class Overview</CardTitle><CardDescription>Teacher analytics coming soon</CardDescription></CardHeader>
              <CardContent className="py-12 text-center text-muted-foreground">
                Connect students to see analytics
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
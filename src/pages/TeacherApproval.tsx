import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { toast } from 'sonner';
import { 
  UserCheck, UserX, Clock, Mail, BookOpen, Shield, 
  CheckCircle2, XCircle, Loader2 
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface TeacherRequest {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  subjects: MatricSubject[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function TeacherApproval() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState<string | null>(null);

  // Check if user is admin or head teacher
  const { data: userRole } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .single();
      return data?.role;
    },
    enabled: !!user,
  });

  const isAdmin = userRole === 'admin' || userRole === 'head_teacher';

  // Fetch pending teacher requests
  const { data: pendingRequests = [], isLoading } = useQuery({
    queryKey: ['pending-teachers'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('teacher_approval_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TeacherRequest[];
    },
    enabled: !!user && isAdmin,
  });

  // Fetch all teacher requests for history
  const { data: allRequests = [] } = useQuery({
    queryKey: ['all-teacher-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_approval_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TeacherRequest[];
    },
    enabled: !!user && isAdmin,
  });

  const handleReview = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessing(requestId);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/teachers/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ requestId, action }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process request');
      }

      toast.success(`Teacher ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      queryClient.invalidateQueries({ queryKey: ['pending-teachers'] });
      queryClient.invalidateQueries({ queryKey: ['all-teacher-requests'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to process request');
    } finally {
      setProcessing(null);
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-bold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                Only admins and head teachers can access this page.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <UserCheck className="w-8 h-8 text-accent" /> Teacher Approvals
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and approve teacher registration requests
          </p>
        </div>

        {/* Pending Requests */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Pending Requests
              {pendingRequests.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingRequests.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Teachers waiting for approval to access the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500/50" />
                <p>No pending requests</p>
                <p className="text-sm">All teacher registrations are up to date</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <Card key={request.id} className="border-yellow-500/30 bg-yellow-500/5">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{request.full_name}</h3>
                            <Badge variant="outline" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" /> Pending
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            {request.email}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                            <div className="flex flex-wrap gap-1">
                              {request.subjects?.map((subject) => (
                                <Badge key={subject} variant="secondary" className="text-xs">
                                  {SUBJECT_ICONS[subject]} {SUBJECT_LABELS[subject]}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Registered: {new Date(request.created_at).toLocaleDateString('en-ZA', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-2"
                            disabled={processing === request.id}
                            onClick={() => handleReview(request.id, 'approve')}
                          >
                            {processing === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-2"
                            disabled={processing === request.id}
                            onClick={() => handleReview(request.id, 'reject')}
                          >
                            {processing === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <UserX className="w-4 h-4" />
                            )}
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request History */}
        {allRequests.filter(r => r.status !== 'pending').length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-muted-foreground" />
                Review History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allRequests
                  .filter(r => r.status !== 'pending')
                  .slice(0, 10)
                  .map((request) => (
                    <div 
                      key={request.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        {request.status === 'approved' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{request.full_name}</p>
                          <p className="text-xs text-muted-foreground">{request.email}</p>
                        </div>
                      </div>
                      <Badge 
                        variant={request.status === 'approved' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {request.status}
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

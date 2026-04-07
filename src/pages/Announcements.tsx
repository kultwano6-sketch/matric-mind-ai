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
import { toast } from 'sonner';
import { Plus, Bell, Megaphone } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const ROLE_LABELS: Record<string, string> = { student: 'Students', teacher: 'Teachers', head_teacher: 'Head Teachers', admin: 'Admins' };

export default function AnnouncementsPage() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetRole, setTargetRole] = useState<string>('all');

  const canCreate = role === 'head_teacher' || role === 'admin';

  const { data: announcements } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: profiles } = useQuery({
    queryKey: ['all-profiles-ann'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    },
    enabled: !!user,
  });

  const createAnnouncement = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('announcements').insert({
        title,
        content,
        created_by: user!.id,
        target_role: targetRole === 'all' ? null : targetRole as AppRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement posted!');
      setOpen(false);
      setTitle('');
      setContent('');
      setTargetRole('all');
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Announcements</h1>
            <p className="text-muted-foreground mt-1">School-wide announcements and notices</p>
          </div>
          {canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-sm hover:shadow-md transition-shadow"><Plus className="w-4 h-4 mr-1" /> New Announcement</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Post Announcement</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Announcement title" />
                  </div>
                  <div className="space-y-2">
                    <Label>Target Audience</Label>
                    <Select value={targetRole} onValueChange={setTargetRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Everyone</SelectItem>
                        <SelectItem value="student">Students Only</SelectItem>
                        <SelectItem value="teacher">Teachers Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your announcement..." rows={5} />
                  </div>
                  <Button className="shadow-sm hover:shadow-md transition-shadow" onClick={() => createAnnouncement.mutate()} disabled={!title || !content || createAnnouncement.isPending} className="w-full">
                    {createAnnouncement.isPending ? 'Posting...' : 'Post Announcement'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="space-y-4">
          {announcements?.map(a => {
            const author = profiles?.find(p => p.user_id === a.created_by);
            return (
              <Card key={a.id} className="glass-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-5 h-5 text-accent" />
                      <h3 className="font-semibold">{a.title}</h3>
                    </div>
                    {a.target_role && <Badge variant="secondary">{ROLE_LABELS[a.target_role] || a.target_role}</Badge>}
                  </div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{a.content}</p>
                  <p className="text-xs text-muted-foreground mt-3">
                    {author?.full_name || 'Admin'} • {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            );
          })}
          {(!announcements || announcements.length === 0) && (
            <Card className="glass-card">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No announcements yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

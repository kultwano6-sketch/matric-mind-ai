import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, Megaphone, BookOpen, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';

export function NotificationsDropdown() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: announcements } = useQuery({
    queryKey: ['notifications-announcements'],
    queryFn: async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .or(`target_role.is.null,target_role.eq.${role}`)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  type SubmissionWithAssignment = {
    id: string;
    score: number;
    submitted_at: string;
    assignments?: { title?: string };
  };

  const { data: recentSubmissions } = useQuery<SubmissionWithAssignment[]>({
    queryKey: ['notifications-submissions'],
    queryFn: async () => {
      if (role !== 'student') return [];
      const { data } = await supabase
        .from('assignment_submissions')
        .select('*, assignments(title)')
        .eq('student_id', user!.id)
        .order('submitted_at', { ascending: false })
        .limit(3);
      return (data as SubmissionWithAssignment[]) || [];
    },
    enabled: !!user,
  });

  const { data: upcomingAssignments } = useQuery({
    queryKey: ['notifications-due'],
    queryFn: async () => {
      const { data } = await supabase
        .from('assignments')
        .select('*')
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(3);
      return data || [];
    },
    enabled: !!user,
  });

  const totalCount = (announcements?.length || 0) + (upcomingAssignments?.length || 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h3 className="font-display font-semibold text-sm">Notifications</h3>
        </div>
        <ScrollArea className="max-h-80">
          <div className="p-2 space-y-1">
            {upcomingAssignments?.map(a => (
              <button
                key={a.id}
                onClick={() => { navigate('/assignments'); setOpen(false); }}
                className="w-full text-left flex items-start gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <BookOpen className="w-4 h-4 mt-0.5 text-accent shrink-0" />
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">Due {new Date(a.due_date!).toLocaleDateString()}</p>
                </div>
              </button>
            ))}
            {recentSubmissions?.map(s => (
              <button
                key={s.id}
                onClick={() => { navigate('/progress'); setOpen(false); }}
                className="w-full text-left flex items-start gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Trophy className="w-4 h-4 mt-0.5 text-accent shrink-0" />
                <div>
                  <p className="text-sm font-medium">{s.assignments?.title || 'Quiz'}: {s.score}%</p>
                  <p className="text-xs text-muted-foreground">{new Date(s.submitted_at).toLocaleDateString()}</p>
                </div>
              </button>
            ))}
            {announcements?.map(a => (
              <button
                key={a.id}
                onClick={() => { navigate('/announcements'); setOpen(false); }}
                className="w-full text-left flex items-start gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Megaphone className="w-4 h-4 mt-0.5 text-accent shrink-0" />
                <div>
                  <p className="text-sm font-medium line-clamp-1">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</p>
                </div>
              </button>
            ))}
            {totalCount === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

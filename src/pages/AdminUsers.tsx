import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Search, UserCog } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const ROLE_LABELS: Record<AppRole, string> = {
  student: 'Student',
  teacher: 'Teacher',
  head_teacher: 'Head Teacher',
  admin: 'Admin',
};

const ROLE_VARIANT: Record<AppRole, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  student: 'default',
  teacher: 'secondary',
  head_teacher: 'outline',
  admin: 'destructive',
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  const { data: userRoles } = useQuery({
    queryKey: ['admin-all-roles'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('*');
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['admin-all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error } = await supabase.from('user_roles').update({ role: newRole }).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-roles'] });
      toast.success('Role updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const users = useMemo(() => {
    let list = userRoles?.map(ur => {
      const prof = profiles?.find(p => p.user_id === ur.user_id);
      return { ...ur, name: prof?.full_name || 'Unknown', joinedAt: prof?.created_at };
    }) || [];

    if (filterRole !== 'all') list = list.filter(u => u.role === filterRole);
    if (search) list = list.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [userRoles, profiles, filterRole, search]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { student: 0, teacher: 0, head_teacher: 0, admin: 0 };
    userRoles?.forEach(r => { counts[r.role] = (counts[r.role] || 0) + 1; });
    return counts;
  }, [userRoles]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage all platform users and roles</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([role, label]) => (
            <Card key={role} className="glass-card cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFilterRole(filterRole === role ? 'all' : role)}>
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="w-6 h-6 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{roleCounts[role]}</p>
                  <p className="text-xs text-muted-foreground">{label}s</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All roles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="student">Students</SelectItem>
              <SelectItem value="teacher">Teachers</SelectItem>
              <SelectItem value="head_teacher">Head Teachers</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCog className="w-5 h-5" /> {users.length} Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-medium text-sm">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{u.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <Select value={u.role} onValueChange={(v) => updateRole.mutate({ userId: u.user_id, newRole: v as AppRole })}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="head_teacher">Head Teacher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No users match your filters</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

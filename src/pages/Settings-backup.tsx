import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ALL_SUBJECTS, SUBJECT_LABELS, normalizeSubject } from '@/lib/subjects';
import { toast } from 'sonner';
import { User, BookOpen, Save, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export default function SettingsPage() {
  const { user, role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [subjects, setSubjects] = useState<MatricSubject[]>([]);

  const profileTable = role === 'teacher' ? 'teacher_profiles' : 'student_profiles';

  const { data: roleProfile } = useQuery<{ subjects?: MatricSubject[] } | null>({
    queryKey: [profileTable, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from(profileTable).select('*').eq('user_id', user!.id).single();
      return data as { subjects?: MatricSubject[] } | null;
    },
    enabled: !!user && (role === 'student' || role === 'teacher'),
  });

  useEffect(() => {
    if (profile) setFullName(profile.full_name);
    if (roleProfile?.subjects) {
      // Normalize old subject names to new ones
      setSubjects(roleProfile.subjects.map(s => normalizeSubject(s)));
    }
  }, [profile, roleProfile]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', user!.id);
      if (profileError) throw profileError;

      if ((role === 'student' || role === 'teacher') && roleProfile) {
        const { error: roleError } = await supabase
          .from(profileTable)
          .update({ subjects })
          .eq('user_id', user!.id);
        if (roleError) throw roleError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: [profileTable] });
      toast.success('Profile updated!');
    },
    onError: (e: unknown) => {
      const errorMessage = e instanceof Error ? e.message : 'Failed to update profile';
      toast.error(errorMessage);
    },
  });

  const toggleSubject = (subject: MatricSubject) => {
    setSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile and preferences</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" /> Profile</CardTitle>
            <CardDescription>Your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={role === 'head_teacher' ? 'Head Teacher' : (role || '').charAt(0).toUpperCase() + (role || '').slice(1)} disabled className="opacity-60" />
            </div>
          </CardContent>
        </Card>

        {(role === 'student' || role === 'teacher') && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5" /> Subjects</CardTitle>
              <CardDescription>Select your {role === 'student' ? 'enrolled' : 'teaching'} subjects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {ALL_SUBJECTS.map(subject => (
                  <label key={subject} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-2 rounded-lg">
                    <Checkbox
                      checked={subjects.includes(subject)}
                      onCheckedChange={() => toggleSubject(subject)}
                    />
                    <span className="truncate">{SUBJECT_LABELS[subject]}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
        </Button>

        <Separator className="my-8" />

        {/* Sign Out Section */}
        <Card className="glass-card border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <LogOut className="w-5 h-5" /> Sign Out
            </CardTitle>
            <CardDescription>Sign out of your account on this device</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              size="lg" 
              className="w-full"
              onClick={async () => {
                await signOut();
                navigate('/auth');
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

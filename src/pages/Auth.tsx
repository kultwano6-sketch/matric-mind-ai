import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ALL_SUBJECTS, SUBJECT_LABELS } from '@/lib/subjects';
import { GraduationCap } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
type MatricSubject = Database['public']['Enums']['matric_subject'];

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<AppRole>('student');
  const [regSubjects, setRegSubjects] = useState<MatricSubject[]>([]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) {
      toast.error(error.message);
    } else {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regSubjects.length === 0) {
      toast.error('Please select at least one subject');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        data: { full_name: regName },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Insert role
      await supabase.from('user_roles').insert({ user_id: data.user.id, role: regRole });

      // Insert role-specific profile
      if (regRole === 'student') {
        await supabase.from('student_profiles').insert({
          user_id: data.user.id,
          grade: 12,
          subjects: regSubjects,
        });
      } else if (regRole === 'teacher') {
        await supabase.from('teacher_profiles').insert({
          user_id: data.user.id,
          subjects: regSubjects,
        });
      }

      toast.success('Account created! Check your email to confirm.');
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const toggleSubject = (subject: MatricSubject) => {
    setRegSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-secondary-foreground" />
            </div>
            <h1 className="text-3xl font-display font-bold text-primary-foreground">MatricMind</h1>
          </div>
          <p className="text-primary-foreground/70">Your AI-powered matric study companion</p>
        </div>

        <Card className="glass-card">
          <Tabs defaultValue="login">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Full Name</Label>
                    <Input id="reg-name" value={regName} onChange={e => setRegName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input id="reg-email" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input id="reg-password" type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label>I am a</Label>
                    <Select value={regRole} onValueChange={(v) => setRegRole(v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subjects</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                      {ALL_SUBJECTS.map(subject => (
                        <label key={subject} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-1 rounded">
                          <Checkbox
                            checked={regSubjects.includes(subject)}
                            onCheckedChange={() => toggleSubject(subject)}
                          />
                          <span className="truncate">{SUBJECT_LABELS[subject]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

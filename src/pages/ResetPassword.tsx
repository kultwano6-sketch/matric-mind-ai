import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { GraduationCap, ArrowLeft, Mail, KeyRound } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isUpdateMode = searchParams.get('type') === 'recovery';

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sent, setSent] = useState(false);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password?type=recovery`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success('Check your email for the reset link!');
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully!');
      navigate('/dashboard');
    }
    setLoading(false);
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
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isUpdateMode ? <KeyRound className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
              {isUpdateMode ? 'Set New Password' : 'Reset Password'}
            </CardTitle>
            <CardDescription>
              {isUpdateMode
                ? 'Enter your new password below.'
                : 'Enter your email and we\'ll send you a reset link.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isUpdateMode ? (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            ) : sent ? (
              <div className="text-center space-y-4 py-4">
                <Mail className="w-12 h-12 mx-auto text-accent" />
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to <strong>{email}</strong>. Check your inbox!
                </p>
                <Button variant="outline" onClick={() => navigate('/auth')}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSendReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate('/auth')}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

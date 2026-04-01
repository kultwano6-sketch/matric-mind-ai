import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ALL_SUBJECTS, SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, Mail, Lock, User, ArrowRight, Eye, EyeOff, 
  ChevronLeft, Check, Sparkles
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
type MatricSubject = Database['public']['Enums']['matric_subject'];

// Admin role assignment is handled server-side only
const needsSubjects = (role: AppRole) => role === 'student' || role === 'teacher';

// Animated background component
const AnimatedBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 gradient-hero" />
    <motion.div
      animate={{ 
        x: [0, 30, 0],
        y: [0, -30, 0],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      className="absolute top-20 right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl"
    />
    <motion.div
      animate={{ 
        x: [0, -30, 0],
        y: [0, 30, 0],
      }}
      transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      className="absolute bottom-20 left-10 w-72 h-72 bg-secondary/10 rounded-full blur-3xl"
    />
  </div>
);

// Animated input with icon
const AnimatedInput = ({ 
  icon: Icon, 
  type = 'text',
  placeholder,
  value,
  onChange,
  required = false,
  minLength,
}: {
  icon: React.ComponentType<{ className?: string }>;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  minLength?: number;
}) => {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <motion.div 
      className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors ${
        focused ? 'border-primary bg-primary/5' : 'border-border bg-background/50'
      }`}
      animate={{ scale: focused ? 1.01 : 1 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <Icon className={`w-5 h-5 transition-colors ${focused ? 'text-primary' : 'text-muted-foreground'}`} />
      <input
        type={type === 'password' ? (showPassword ? 'text' : 'password') : type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
      />
      {type === 'password' && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </motion.div>
  );
};

// Subject chip selector
const SubjectChip = ({ 
  subject, 
  selected, 
  onClick 
}: { 
  subject: MatricSubject; 
  selected: boolean; 
  onClick: () => void;
}) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileTap={{ scale: 0.95 }}
    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
      selected 
        ? 'bg-primary text-primary-foreground shadow-md' 
        : 'bg-muted/50 hover:bg-muted text-foreground'
    }`}
  >
    <span>{SUBJECT_ICONS[subject]}</span>
    <span className="truncate">{SUBJECT_LABELS[subject]}</span>
    {selected && <Check className="w-4 h-4 ml-auto" />}
  </motion.button>
);

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'login' | 'register' | 'subjects'>('login');
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
    
    if (needsSubjects(regRole) && regSubjects.length === 0) {
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
      try {
        if (regRole === 'teacher') {
          const { error: reqError } = await supabase.from('teacher_approval_requests').insert({
            user_id: data.user.id,
            full_name: regName,
            email: regEmail,
            subjects: regSubjects,
            status: 'pending'
          });
          if (reqError) throw reqError;
          toast.success('Registration submitted! Your account will be reviewed by an admin.');
        } else {
          const { error: roleError } = await supabase.from('user_roles').insert({ user_id: data.user.id, role: regRole });
          if (roleError) throw roleError;
          const { error: profileError } = await supabase.from('student_profiles').insert({
            user_id: data.user.id,
            grade: 12,
            subjects: regSubjects,
          });
          if (profileError) throw profileError;
          toast.success('Account created! Check your email to confirm.');
        }
        navigate('/dashboard');
      } catch (err: any) {
        console.error('Registration insert error:', err);
        toast.error(err.message || 'Failed to complete registration. Please try again.');
      }
    }
    setLoading(false);
  };

  const toggleSubject = (subject: MatricSubject) => {
    setRegSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
    exit: { opacity: 0, y: -20 }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      
      <div className="relative z-10 flex-1 flex flex-col p-4 safe-area-inset-top safe-area-inset-bottom">
        {/* Logo Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-8 pb-6"
        >
          <div className="inline-flex items-center gap-3 mb-3">
            <motion.div 
              className="w-14 h-14 rounded-2xl gradient-gold flex items-center justify-center shadow-lg"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
            >
              <GraduationCap className="w-8 h-8 text-secondary-foreground" />
            </motion.div>
            <div className="text-left">
              <h1 className="text-3xl font-display font-bold text-primary-foreground">MatricMind</h1>
              <p className="text-xs text-primary-foreground/60">AI Study Companion</p>
            </div>
          </div>
        </motion.div>

        {/* Main Card */}
        <motion.div 
          className="flex-1 max-w-md mx-auto w-full"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="glass-card rounded-3xl overflow-hidden shadow-2xl">
            <AnimatePresence mode="wait">
              {step === 'login' && (
                <motion.div
                  key="login"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="p-6 space-y-6"
                >
                  {/* Tab Switcher */}
                  <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
                    <button className="flex-1 py-2.5 px-4 rounded-lg bg-background text-foreground font-medium shadow-sm text-sm">
                      Sign In
                    </button>
                    <button 
                      onClick={() => setStep('register')}
                      className="flex-1 py-2.5 px-4 rounded-lg text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      Register
                    </button>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <motion.div variants={itemVariants}>
                      <AnimatedInput
                        icon={Mail}
                        type="email"
                        placeholder="Email address"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <AnimatedInput
                        icon={Lock}
                        type="password"
                        placeholder="Password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <button
                        type="button"
                        onClick={() => navigate('/reset-password')}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        Forgot password?
                      </button>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <Button 
                        type="submit" 
                        className="w-full h-12 rounded-xl text-base font-semibold group"
                        disabled={loading}
                      >
                        {loading ? (
                          <motion.div 
                            className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          />
                        ) : (
                          <>
                            Sign In
                            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </form>

                  <motion.div variants={itemVariants} className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Don't have an account?{' '}
                      <button 
                        onClick={() => setStep('register')}
                        className="text-primary font-medium hover:underline"
                      >
                        Register
                      </button>
                    </p>
                  </motion.div>
                </motion.div>
              )}

              {step === 'register' && (
                <motion.div
                  key="register"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="p-6 space-y-5"
                >
                  {/* Back button and header */}
                  <div className="flex items-center gap-3 mb-2">
                    <button 
                      onClick={() => setStep('login')}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-lg font-semibold">Create Account</h2>
                      <p className="text-xs text-muted-foreground">Join thousands of matric learners</p>
                    </div>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (needsSubjects(regRole)) {
                      setStep('subjects');
                    } else {
                      handleRegister(e);
                    }
                  }} className="space-y-4">
                    <motion.div variants={itemVariants}>
                      <AnimatedInput
                        icon={User}
                        placeholder="Full name"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        required
                      />
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <AnimatedInput
                        icon={Mail}
                        type="email"
                        placeholder="Email address"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                      />
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <AnimatedInput
                        icon={Lock}
                        type="password"
                        placeholder="Password (min 6 characters)"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </motion.div>

                    {!isAdminEmail && (
                      <motion.div variants={itemVariants}>
                        <Label className="text-xs text-muted-foreground mb-2 block">I am a...</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'student', label: 'Learner', icon: '🎓' },
                            { value: 'teacher', label: 'Teacher', icon: '📚' }
                          ].map((role) => (
                            <motion.button
                              key={role.value}
                              type="button"
                              onClick={() => setRegRole(role.value as AppRole)}
                              whileTap={{ scale: 0.95 }}
                              className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                                regRole === role.value 
                                  ? 'border-primary bg-primary/10 text-primary' 
                                  : 'border-border hover:border-primary/30'
                              }`}
                            >
                              <span className="text-xl block mb-1">{role.icon}</span>
                              {role.label}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    <motion.div variants={itemVariants}>
                      <Button 
                        type="submit" 
                        className="w-full h-12 rounded-xl text-base font-semibold group"
                        disabled={loading}
                      >
                        {loading ? (
                          <motion.div 
                            className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          />
                        ) : (
                          <>
                            Continue
                            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </form>

                  <motion.div variants={itemVariants} className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Already have an account?{' '}
                      <button 
                        onClick={() => setStep('login')}
                        className="text-primary font-medium hover:underline"
                      >
                        Sign In
                      </button>
                    </p>
                  </motion.div>
                </motion.div>
              )}

              {step === 'subjects' && (
                <motion.div
                  key="subjects"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="p-6 space-y-5"
                >
                  {/* Back button and header */}
                  <div className="flex items-center gap-3 mb-2">
                    <button 
                      onClick={() => setStep('register')}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-lg font-semibold">Select Your Subjects</h2>
                      <p className="text-xs text-muted-foreground">
                        {regRole === 'teacher' ? 'Subjects you teach' : 'Subjects you study'}
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-4">
                    <motion.div variants={itemVariants} className="space-y-3">
                      <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
                        {ALL_SUBJECTS.map((subject) => (
                          <SubjectChip
                            key={subject}
                            subject={subject}
                            selected={regSubjects.includes(subject)}
                            onClick={() => toggleSubject(subject)}
                          />
                        ))}
                      </div>

                      {regSubjects.length > 0 && (
                        <motion.p 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-xs text-muted-foreground text-center"
                        >
                          {regSubjects.length} subject{regSubjects.length > 1 ? 's' : ''} selected
                        </motion.p>
                      )}
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <Button 
                        type="submit" 
                        className="w-full h-12 rounded-xl text-base font-semibold group"
                        disabled={loading || regSubjects.length === 0}
                      >
                        {loading ? (
                          <motion.div 
                            className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          />
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            Create Account
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-4"
        >
          <p className="text-xs text-primary-foreground/40">
            By continuing, you agree to our Terms & Privacy Policy
          </p>
        </motion.div>
      </div>
    </div>
  );
}

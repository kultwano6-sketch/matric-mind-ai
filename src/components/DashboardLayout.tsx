import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationsDropdown } from '@/components/NotificationsDropdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  GraduationCap, LayoutDashboard, MessageSquare, BarChart3, BookOpen,
  Users, FileText, Bell, Settings, Shield, LogOut, Menu, Brain, Eye, Sparkles, Zap, Mic
} from 'lucide-react';
import { useState } from 'react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const NAV_ITEMS = {
  student: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'AI Tutor', icon: MessageSquare, path: '/tutor' },
    { label: 'Voice Tutor', icon: Mic, path: '/voice-tutor' },
    { label: 'Study Planner', icon: FileText, path: '/study-planner' },
    { label: 'SnapSolve', icon: Sparkles, path: '/snap-solve' },
    { label: 'Gamification', icon: Sparkles, path: '/gamification' },
    { label: 'AI Quiz', icon: Brain, path: '/quiz' },
    { label: 'My Progress', icon: BarChart3, path: '/progress' },
    { label: 'Assignments', icon: BookOpen, path: '/assignments' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  teacher: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Students', icon: Users, path: '/students' },
    { label: 'Lesson Plans', icon: FileText, path: '/lesson-plans' },
    { label: 'Assignments', icon: BookOpen, path: '/assignments' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  head_teacher: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Analytics', icon: BarChart3, path: '/analytics' },
    { label: 'Teachers', icon: Users, path: '/teachers' },
    { label: 'Students', icon: GraduationCap, path: '/students' },
    { label: 'Announcements', icon: Bell, path: '/announcements' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  admin: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Users', icon: Users, path: '/admin/users' },
    { label: 'Analytics', icon: BarChart3, path: '/analytics' },
    { label: 'Announcements', icon: Bell, path: '/announcements' },
    { label: 'System', icon: Shield, path: '/admin/system' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
};

const ROLE_COLORS = {
  student: 'border-[hsl(200,80%,50%)]',
  teacher: 'border-[hsl(150,60%,40%)]',
  head_teacher: 'border-[hsl(45,85%,55%)]',
  admin: 'border-[hsl(0,65%,50%)]',
};

const ROLE_LABELS: Record<AppRole, string> = {
  student: 'Learner',
  teacher: 'Teacher',
  head_teacher: 'Head Teacher',
  admin: 'System Admin',
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { role, effectiveRole, viewingAs, isAdmin, profile, signOut, setViewingAs } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = effectiveRole ? NAV_ITEMS[effectiveRole] : [];
  const roleColor = effectiveRole ? ROLE_COLORS[effectiveRole] : '';
  const roleLabel = effectiveRole ? ROLE_LABELS[effectiveRole] : '';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleRoleSwitch = (value: string) => {
    if (value === 'admin') {
      setViewingAs(null);
    } else {
      setViewingAs(value as AppRole);
    }
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 gradient-navy flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6 text-secondary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold text-sidebar-foreground">MatricMind</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full role-badge-${effectiveRole?.replace('_', '-')}`}>{roleLabel}</span>
          </div>
        </div>

        {/* Admin Role Switcher */}
        {isAdmin && (
          <div className="px-4 mb-3">
            <div className="p-2 rounded-lg bg-sidebar-accent/30 border border-sidebar-border">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Eye className="w-3 h-3 text-sidebar-foreground/70" />
                <span className="text-[10px] font-medium text-sidebar-foreground/70 uppercase tracking-wider">View as</span>
              </div>
              <Select value={viewingAs || 'admin'} onValueChange={handleRoleSwitch}>
                <SelectTrigger className="h-8 text-xs bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">🛡️ Admin (Default)</SelectItem>
                  <SelectItem value="head_teacher">👔 Head Teacher</SelectItem>
                  <SelectItem value="teacher">📚 Teacher</SelectItem>
                  <SelectItem value="student">🎓 Learner</SelectItem>
                </SelectContent>
              </Select>
              {viewingAs && (
                <button
                  onClick={() => { setViewingAs(null); navigate('/dashboard'); }}
                  className="text-[10px] text-destructive hover:underline mt-1 w-full text-center"
                >
                  ← Back to Admin
                </button>
              )}
            </div>
          </div>
        )}

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-medium text-sidebar-foreground border-2 ${roleColor}`}>
              {profile?.full_name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name}</p>
              {viewingAs && (
                <p className="text-[10px] text-sidebar-foreground/50">Viewing as {ROLE_LABELS[viewingAs]}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b flex items-center px-4 lg:px-8 gap-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          {viewingAs && (
            <Badge variant="outline" className="text-xs border-destructive/50 text-destructive">
              <Eye className="w-3 h-3 mr-1" /> Viewing as {ROLE_LABELS[viewingAs]}
            </Badge>
          )}
          <div className="flex-1" />
          <NotificationsDropdown />
          <ThemeToggle />
        </header>
        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

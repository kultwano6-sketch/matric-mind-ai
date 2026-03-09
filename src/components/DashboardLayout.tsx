import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  GraduationCap, LayoutDashboard, MessageSquare, BarChart3, BookOpen,
  Users, FileText, Bell, Settings, Shield, LogOut, Menu, X
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = {
  student: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'AI Tutor', icon: MessageSquare, path: '/tutor' },
    { label: 'My Progress', icon: BarChart3, path: '/progress' },
    { label: 'Assignments', icon: BookOpen, path: '/assignments' },
  ],
  teacher: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Students', icon: Users, path: '/students' },
    { label: 'Lesson Plans', icon: FileText, path: '/lesson-plans' },
    { label: 'Assignments', icon: BookOpen, path: '/assignments' },
  ],
  head_teacher: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Analytics', icon: BarChart3, path: '/analytics' },
    { label: 'Teachers', icon: Users, path: '/teachers' },
    { label: 'Announcements', icon: Bell, path: '/announcements' },
  ],
  admin: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Users', icon: Users, path: '/admin/users' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
    { label: 'System', icon: Shield, path: '/admin/system' },
  ],
};

const ROLE_COLORS = {
  student: 'border-[hsl(200,80%,50%)]',
  teacher: 'border-[hsl(150,60%,40%)]',
  head_teacher: 'border-[hsl(45,85%,55%)]',
  admin: 'border-[hsl(0,65%,50%)]',
};

const ROLE_LABELS = {
  student: 'Student',
  teacher: 'Teacher',
  head_teacher: 'Head Teacher',
  admin: 'System Admin',
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = role ? NAV_ITEMS[role] : [];
  const roleColor = role ? ROLE_COLORS[role] : '';
  const roleLabel = role ? ROLE_LABELS[role] : '';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
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
            <span className={`text-xs px-2 py-0.5 rounded-full role-badge-${role?.replace('_', '-')}`}>{roleLabel}</span>
          </div>
        </div>

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
          <div className="flex-1" />
        </header>
        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

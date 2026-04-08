import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  GraduationCap, LayoutDashboard, MessageSquare, BarChart3, BookOpen,
  Users, FileText, Bell, Settings, Shield, LogOut, Brain, Sparkles, Mic,
  FileStack, Search, Clock, Home, Trophy, Calendar, UserCheck, ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';
type AppRole = Database['public']['Enums']['app_role'];
interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}
// Student nav - study focused
const STUDENT_BOTTOM_NAV: NavItem[] = [
  { label: 'Home', icon: Home, path: '/dashboard' },
  { label: 'Tutor', icon: MessageSquare, path: '/tutor' },
  { label: 'Quiz', icon: Brain, path: '/quiz' },
  { label: 'Notes', icon: BookOpen, path: '/study-notes' },
  { label: 'More', icon: LayoutDashboard, path: '/dashboard' },
];
const STUDENT_MORE_ITEMS: NavItem[] = [
  { label: 'Voice Tutor', icon: Mic, path: '/voice-tutor' },
  { label: 'SnapSolve', icon: Sparkles, path: '/snap-solve' },
  { label: 'Practice Exam', icon: Clock, path: '/practice-exam' },
  { label: 'Past Papers', icon: FileStack, path: '/past-papers' },
  { label: 'Explain Mistake', icon: Search, path: '/explain-mistake' },
  { label: 'Assignments', icon: FileText, path: '/assignments' },
  { label: 'Progress', icon: BarChart3, path: '/progress' },
  { label: 'Study Planner', icon: Calendar, path: '/study-planner' },
  { label: 'Achievements', icon: Trophy, path: '/gamification' },
  { label: 'Daily Challenges', icon: Sparkles, path: '/daily-challenges' },
  { label: 'Exam Simulator', icon: Clock, path: '/exam-simulator' },
  { label: 'Learner Readiness', icon: Brain, path: '/matric-readiness' },
  { label: 'Conversation Tutor', icon: MessageSquare, path: '/conversation-tutor' },
  { label: 'Textbook Scan', icon: FileStack, path: '/textbook-scan' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];
// Teacher nav - NO learner features, just teaching tools
const TEACHER_NAV: NavItem[] = [
  { label: 'Home', icon: Home, path: '/dashboard' },
  { label: 'My Classes', icon: Users, path: '/students' },
  { label: 'Lesson Plans', icon: ClipboardList, path: '/lesson-plans' },
  { label: 'Assignments', icon: BookOpen, path: '/assignments' },
  { label: 'More', icon: LayoutDashboard, path: '/dashboard' },
];
const TEACHER_MORE_ITEMS: NavItem[] = [
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Announcements', icon: Bell, path: '/announcements' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];
// Head Teacher nav - admin/management focused, NO learner features
const HEAD_TEACHER_NAV: NavItem[] = [
  { label: 'Home', icon: Home, path: '/dashboard' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Teachers', icon: UserCheck, path: '/teachers' },
  { label: 'Students', icon: Users, path: '/students' },
  { label: 'More', icon: LayoutDashboard, path: '/dashboard' },
];
const HEAD_TEACHER_MORE_ITEMS: NavItem[] = [
  { label: 'Approvals', icon: UserCheck, path: '/admin/teachers' },
  { label: 'Announcements', icon: Bell, path: '/announcements' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];
// Admin nav
const ADMIN_NAV: NavItem[] = [
  { label: 'Home', icon: Home, path: '/dashboard' },
  { label: 'Users', icon: Users, path: '/admin/users' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'System', icon: Shield, path: '/admin/system' },
  { label: 'More', icon: LayoutDashboard, path: '/dashboard' },
];
const ADMIN_MORE_ITEMS: NavItem[] = [
  { label: 'Approvals', icon: UserCheck, path: '/admin/teachers' },
  { label: 'Announcements', icon: Bell, path: '/announcements' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];
const ROLE_LABELS: Record<AppRole, string> = {
  student: 'Learner',
  teacher: 'Teacher',
  head_teacher: 'Head Teacher',
  admin: 'Admin',
};
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, role, effectiveRole, viewingAs, isAdmin, profile, signOut, setViewingAs } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  // Close menus on route change
  useEffect(() => {
    setShowMoreMenu(false);
    setShowProfileMenu(false);
  }, [location.pathname]);
  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };
  // Get nav items based on role - no learner features for teachers
  const getNavItems = () => {
    switch (effectiveRole) {
      case 'teacher': return TEACHER_NAV;
      case 'head_teacher': return HEAD_TEACHER_NAV;
      case 'admin': return ADMIN_NAV;
      default: return STUDENT_BOTTOM_NAV;
    }
  };
  const getMoreItems = () => {
    switch (effectiveRole) {
      case 'teacher': return TEACHER_MORE_ITEMS;
      case 'head_teacher': return HEAD_TEACHER_MORE_ITEMS;
      case 'admin': return ADMIN_MORE_ITEMS;
      default: return STUDENT_MORE_ITEMS;
    }
  };
  const navItems = getNavItems();
  const moreItems = getMoreItems();
  const isMoreActive = moreItems.some(item => item.path === location.pathname);
  // Bottom Navigation Component (mobile only)
  const BottomNav = () => (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t safe-area-inset-bottom lg:hidden">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isMore = item.label === 'More';
          const isActive = isMore 
            ? isMoreActive 
            : location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => {
                if (isMore) {
                  setShowMoreMenu(true);
                } else {
                  navigate(item.path);
                }
              }}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-4 rounded-2xl transition-all duration-300 ${
                isActive 
                  ? 'text-primary bg-primary/10 scale-105 shadow-lg shadow-primary/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-primary/10 rounded-2xl"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <div className={`relative ${isActive ? 'animate-bounce-subtle' : ''}`}>
                <item.icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : ''}`} />
              </div>
              <span className={`text-[10px] font-semibold relative z-10 ${isActive ? 'text-primary' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
  // Tablet/Desktop Sidebar Navigation
  const SidebarNav = () => (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-card border-r">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b">
        <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center shrink-0">
          <GraduationCap className="w-6 h-6 text-secondary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-display font-bold">MatricMind</h1>
          <span className="text-xs text-muted-foreground">{ROLE_LABELS[effectiveRole || 'student']}</span>
        </div>
      </div>
      {/* Admin Role Switcher */}
      {isAdmin && (
        <div className="p-3 mx-3 mt-3 rounded-xl bg-muted/50 border border-border">
          <p className="text-xs font-medium mb-2 text-muted-foreground">View As</p>
          <div className="grid grid-cols-2 gap-1">
            {(['admin', 'head_teacher', 'teacher', 'student'] as AppRole[]).map((r) => (
              <button
                key={r}
                onClick={() => {
                  setViewingAs(r === 'admin' ? null : r);
                  navigate('/dashboard');
                }}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                  (r === 'admin' && !viewingAs) || viewingAs === r
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Nav Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.filter(item => item.label !== 'More').map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-primary/20 to-primary/5 text-primary font-semibold shadow-sm shadow-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-primary/20' : 'bg-muted/50 group-hover:bg-muted'}`}>
                <item.icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
              </div>
              {item.label}
            </Link>
          );
        })}
        
        {/* More Items for Students */}
        {effectiveRole === 'student' && (
          <>
            <div className="pt-4 mt-4 border-t border-border/50">
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                More
              </p>
              {STUDENT_MORE_ITEMS.filter(item => item.label !== 'Settings').map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-primary/20 to-primary/5 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-primary/20' : 'bg-muted/30 group-hover:bg-muted'}`}>
                      <item.icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                    </div>
                    <span className="text-xs">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
        {/* More Items for Teachers */}
        {effectiveRole === 'teacher' && (
          <>
            <div className="pt-4 mt-4 border-t">
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                More
              </p>
              {TEACHER_MORE_ITEMS.filter(item => item.label !== 'Settings').map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="text-xs">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>
      {/* Profile Section with Sign Out */}
      <div className="p-3 border-t space-y-2">
        {/* Theme Toggle - Visible on Tablet/Desktop */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/30">
          <span className="text-sm text-muted-foreground">Dark Mode</span>
          <ThemeToggle />
        </div>
        <Link
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <Settings className="w-5 h-5" />
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
  // More Menu Modal
  const MoreMenu = () => (
    <AnimatePresence>
      {showMoreMenu && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50"
            onClick={() => setShowMoreMenu(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl border-t shadow-xl max-h-[80vh] overflow-auto safe-area-inset-bottom"
          >
            <div className="sticky top-0 bg-background p-4 border-b">
              <div className="w-12 h-1 bg-muted rounded-full mx-auto" />
              <h3 className="text-lg font-semibold text-center mt-2">More Options</h3>
            </div>
            <div className="p-4 grid grid-cols-3 gap-3">
              {moreItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMoreMenu(false)}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-gradient-to-br from-card to-muted/30 border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <item.icon className="w-7 h-7 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-center text-foreground/90 group-hover:text-primary transition-colors">{item.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
  // Profile Menu (preserved from original but trimmed for space)
  const ProfileMenu = () => (
    <AnimatePresence>
      {showProfileMenu && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50"
            onClick={() => setShowProfileMenu(false)}
          />
        </>
      )}
    </AnimatePresence>
  );
  return (
    <div className="min-h-screen bg-background">
      <SidebarNav />
      <BottomNav />
      <MoreMenu />
      <ProfileMenu />
      <main className="lg:ml-64 pb-20 lg:pb-6">
        <div className="p-3 sm:p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

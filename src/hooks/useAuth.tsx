import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  viewingAs: AppRole | null;
  effectiveRole: AppRole | null;
  profile: { full_name: string; avatar_url: string | null } | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  setViewingAs: (role: AppRole | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  viewingAs: null,
  effectiveRole: null,
  profile: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
  setViewingAs: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [viewingAs, setViewingAs] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = role === 'admin';
  const effectiveRole = viewingAs || role;

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const [roleRes, profileRes] = await Promise.all([
        supabase.rpc('get_user_role', { _user_id: userId }),
        supabase.from('profiles').select('full_name, avatar_url').eq('user_id', userId).single(),
      ]);
      if (roleRes.data) setRole(roleRes.data as AppRole);
      if (profileRes.data) setProfile(profileRes.data);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Fetch user data without setTimeout to avoid stale closures
        fetchUserData(session.user.id);
      } else {
        setRole(null);
        setProfile(null);
        setViewingAs(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
    setViewingAs(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, viewingAs, effectiveRole, profile, loading, isAdmin, signOut, setViewingAs }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

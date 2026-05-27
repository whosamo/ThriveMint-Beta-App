import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type { UserProfile, UserRole } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  hasProfile: boolean;
  signUp: (params: SignUpParams) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  // Fetch public.users row + check if onboarding profile exists
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data as UserProfile);

      const role = (data?.role ?? 'business') as UserRole;
      let profileExists = false;

      if (role === 'business') {
        const { data: bp } = await supabase
          .from('business_profiles')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();
        profileExists = !!bp;
      } else if (role === 'freelancer') {
        const { data: fp } = await supabase
          .from('freelancer_profiles')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();
        profileExists = !!fp;
      } else {
        // 'both' — either profile counts
        const [{ data: bp }, { data: fp }] = await Promise.all([
          supabase.from('business_profiles').select('id').eq('user_id', userId).maybeSingle(),
          supabase.from('freelancer_profiles').select('id').eq('user_id', userId).maybeSingle(),
        ]);
        profileExists = !!(bp || fp);
      }

      setHasProfile(profileExists);
    } catch (e) {
      console.error('[AuthContext] fetchProfile error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Subscribe to auth state changes on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setHasProfile(false);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ---------------------------------------------------------------------------
  // Auth actions
  // ---------------------------------------------------------------------------

  const signUp = async ({ email, password, fullName, role }: SignUpParams) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Sign up failed — no user returned.');

    // Upsert so we set `role` regardless of whether the DB trigger already ran
    const { error: upsertErr } = await supabase.from('users').upsert(
      { id: data.user.id, email, full_name: fullName, role },
      { onConflict: 'id' },
    );
    if (upsertErr) throw upsertErr;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      setIsLoading(true);
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        hasProfile,
        signUp,
        signIn,
        signOut,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

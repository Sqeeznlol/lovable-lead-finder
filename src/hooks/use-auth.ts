import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'office' | 'mobile_swipe';

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    roles: [],
    loading: true,
  });

  const fetchRoles = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    return (data || []).map(r => r.role as AppRole);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const roles = await fetchRoles(session.user.id);
          setState({ user: session.user, session, roles, loading: false });
        } else {
          setState({ user: null, session: null, roles: [], loading: false });
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const roles = await fetchRoles(session.user.id);
        setState({ user: session.user, session, roles, loading: false });
      } else {
        setState({ user: null, session: null, roles: [], loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRoles]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => state.roles.includes(role);
  const isAdmin = hasRole('admin');
  const isOffice = hasRole('office') || isAdmin;
  const isMobileSwipe = hasRole('mobile_swipe');

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    hasRole,
    isAdmin,
    isOffice,
    isMobileSwipe,
  };
}

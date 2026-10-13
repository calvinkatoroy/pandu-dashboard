import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { UserRole } from '../lib/types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) fetchProfile(data.session);
      else setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) fetchProfile(s);
      else { setUser(null); setLoading(false); }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchProfile(s: Session) {
    const { data } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('user_id', s.user.id)
      .single();
    setUser({
      id: s.user.id,
      email: s.user.email ?? '',
      name: data?.name ?? s.user.email?.split('@')[0] ?? '',
      role: data?.role ?? 'viewer',
    });
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }

  async function signUp(email: string, password: string, name: string) {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } },
    });
    return error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }

  return { session, user, loading, signIn, signUp, signOut };
}

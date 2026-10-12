import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { apiFetchProfileMe } from '../api';
import type { Session, User } from '@supabase/supabase-js';
import { AuthContext } from './auth-context';

type AccountResponse = {
  role?: 'user' | 'admin' | 'system_admin' | 'inspector';
  branch?: string | null;
  error?: string;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'user' | 'admin' | 'system_admin' | 'inspector' | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);

  const fetchUserRole = useCallback(async (sessionToken: string) => {
    setAccountError(null);
    try {
      const res = await apiFetchProfileMe(sessionToken);
      const data = await res.json().catch(() => ({})) as AccountResponse;

      if (!res.ok) {
        throw new Error(data.error || 'Account API returned status ' + res.status);
      }

      setRole(data.role || 'user');
      setBranch(data.branch || null);
    } catch (error) {
      console.error('Account data loading failed:', error);
      setRole(null);
      setBranch(null);
      setAccountError('無法讀取使用者資料與權限，請確認後端環境變數後再重試。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchUserRole(session.access_token);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchUserRole(session.access_token);
      } else {
        setRole(null);
        setBranch(null);
        setAccountError(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRole]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setBranch(null);
    setAccountError(null);
  };

  const retryAccountLoad = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    await fetchUserRole(session.access_token);
  }, [fetchUserRole, session]);

  const getToken = useCallback(() => {
    return session?.access_token || '';
  }, [session?.access_token]);

  return (
    <AuthContext.Provider value={{
      session,
      user,
      role,
      branch,
      loading,
      accountError,
      signInWithGoogle,
      signOut,
      retryAccountLoad,
      getToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

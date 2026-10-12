import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthState {
  session: Session | null;
  user: User | null;
  role: 'user' | 'admin' | 'system_admin' | 'inspector' | null;
  branch: string | null;
  loading: boolean;
  accountError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  retryAccountLoad: () => Promise<void>;
  getToken: () => string;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);

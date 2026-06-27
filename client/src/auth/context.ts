import { createContext, useContext } from 'react';
import type { LoginInput, SignupInput, User } from '../api/auth';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signup: (input: SignupInput) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  // Admin: switch into a user's session / return to the admin's own session.
  impersonate: (userId: string) => Promise<User>;
  stopImpersonating: () => Promise<User>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

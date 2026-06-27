import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '../api/auth';
import type { User } from '../api/auth';
import { impersonateUser } from '../api/admin';
import { AuthContext } from './context';
import type { AuthContextValue } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .getMe()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    signup: async (input) => {
      const { user } = await authApi.signup(input);
      setUser(user);
    },
    login: async (input) => {
      const { user } = await authApi.login(input);
      setUser(user);
    },
    logout: async () => {
      await authApi.logout();
      setUser(null);
    },
    refresh: async () => {
      const { user } = await authApi.getMe();
      setUser(user);
    },
    impersonate: async (userId) => {
      const { user } = await impersonateUser(userId);
      setUser(user);
      return user;
    },
    stopImpersonating: async () => {
      const { user } = await authApi.stopImpersonating();
      setUser(user);
      return user;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

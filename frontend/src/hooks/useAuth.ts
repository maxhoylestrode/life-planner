import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import apiClient from '../api/client';

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const useAuthProvider = (): AuthContextValue => {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const stored = localStorage.getItem('user');
      const token = localStorage.getItem('accessToken');
      if (stored && token) {
        return {
          user: JSON.parse(stored) as User,
          isAuthenticated: true,
          isLoading: false,
        };
      }
    } catch {
      // ignore parse errors
    }
    return { user: null, isAuthenticated: false, isLoading: false };
  });

  const setAuth = useCallback((user: User, accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const response = await apiClient.post<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>('/auth/login', { email, password });

      const { user, accessToken, refreshToken } = response.data;
      setAuth(user, accessToken, refreshToken);
    },
    [setAuth]
  );

  const register = useCallback(
    async (email: string, username: string, password: string): Promise<void> => {
      const response = await apiClient.post<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>('/auth/register', { email, username, password });

      const { user, accessToken, refreshToken } = response.data;
      setAuth(user, accessToken, refreshToken);
    },
    [setAuth]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore errors
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  // Verify token on mount
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const verify = async () => {
      try {
        const response = await apiClient.get<{ user: User }>('/auth/me');
        const freshUser = response.data.user;
        localStorage.setItem('user', JSON.stringify(freshUser));
        setState((prev) => ({ ...prev, user: freshUser }));
      } catch {
        clearAuth();
      }
    };

    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    login,
    register,
    logout,
  };
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

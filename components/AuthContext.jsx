'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import apiClient from '@/lib/apiClient';

const AuthContext = createContext({
  user: null,
  loading: true,
  error: '',
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.get('/auth/me');
      setUser(data?.user || null);
    } catch (err) {
      setUser(null);
      setError(err.message || 'Not authenticated');
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (_) {
      // ignore — we're logging out regardless
    } finally {
      setUser(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, error, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Role hierarchy helper — mirrors the backend's ADMIN > MANAGER > STAFF > VIEWER.
const ROLE_RANK = { VIEWER: 0, STAFF: 1, MANAGER: 2, ADMIN: 3 };

export function roleAtLeast(userRole, minRole) {
  if (!userRole || !minRole) return false;
  const userRank = ROLE_RANK[userRole];
  const minRank = ROLE_RANK[minRole];
  if (userRank === undefined || minRank === undefined) return false;
  return userRank >= minRank;
}

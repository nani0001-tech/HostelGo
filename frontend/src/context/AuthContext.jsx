import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, clearToken, getToken, saveToken, setUnauthorizedHandler } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async ({ remote = true } = {}) => {
    if (remote && getToken()) {
      try { await authApi.logout(); } catch { /* The client still clears its local session. */ }
    }
    clearToken();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken();
      setUser(null);
      const from = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      navigate('/login', { replace: true, state: { from: { pathname: from } } });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  useEffect(() => {
    let active = true;
    async function restore() {
      if (!getToken()) {
        if (active) setLoading(false);
        return;
      }
      try {
        const response = await authApi.me();
        if (active) setUser(response.user);
      } catch (error) {
        if (error.status === 401) clearToken();
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    restore();
    return () => { active = false; };
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await authApi.login(credentials);
    saveToken(response.token);
    setUser(response.user);
    return response.user;
  }, []);

  const register = useCallback(async (details) => {
    await authApi.register(details);
    return login({ email: details.email, password: details.password });
  }, [login]);

  const value = useMemo(() => ({ user, loading, isAuthenticated: Boolean(user), login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}

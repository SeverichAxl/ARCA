'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  AUTH_MODE,
  AUTH_NOTICE_KEY,
  AUTH_SESSION_KEY,
  authenticate,
  authenticatedApiRequest,
  readStoredSession,
  refreshAuthentication,
  revokeAuthentication,
  type AuthSession,
  type RoleCode,
} from '@/lib/auth';

interface AuthContextValue {
  session: AuthSession | null;
  isReady: boolean;
  login: (username: string, password: string, mockRole?: RoleCode) => Promise<AuthSession>;
  logout: () => Promise<void>;
  request: (path: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  const saveSession = useCallback((nextSession: AuthSession | null) => {
    if (nextSession) {
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(nextSession));
    } else {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    }
    setSession(nextSession);
  }, []);

  const refresh = useCallback(
    async (currentSession: AuthSession) => {
      const nextSession = await refreshAuthentication(currentSession);
      saveSession(nextSession);
      return nextSession;
    },
    [saveSession],
  );

  useEffect(() => {
    let active = true;

    const restore = async () => {
      try {
        const storedSession = readStoredSession();
        if (!storedSession) {
          sessionStorage.removeItem(AUTH_SESSION_KEY);
          return;
        }

        const currentSession =
          storedSession.expiresAt <= Date.now()
            ? await refreshAuthentication(storedSession)
            : storedSession;
        if (active) saveSession(currentSession);
      } catch {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        sessionStorage.setItem(
          AUTH_NOTICE_KEY,
          'Tu sesión expiró o ya no es válida. Inicia sesión nuevamente.',
        );
      } finally {
        if (active) setIsReady(true);
      }
    };

    void restore();
    return () => {
      active = false;
    };
  }, [saveSession]);

  useEffect(() => {
    if (!session) return;

    const refreshDelay = Math.max(session.expiresAt - Date.now() - 30_000, 1_000);
    const timer = window.setTimeout(() => {
      void refresh(session).catch(() => {
        saveSession(null);
        sessionStorage.setItem(
          AUTH_NOTICE_KEY,
          'Tu sesión expiró y no pudo renovarse. Inicia sesión nuevamente.',
        );
        router.replace('/login');
      });
    }, refreshDelay);

    return () => window.clearTimeout(timer);
  }, [refresh, router, saveSession, session]);

  const login = useCallback(
    async (username: string, password: string, mockRole?: RoleCode) => {
      const nextSession = await authenticate(username, password, mockRole);
      saveSession(nextSession);
      return nextSession;
    },
    [saveSession],
  );

  const logout = useCallback(async () => {
    const currentSession = session;
    saveSession(null);

    if (!currentSession || currentSession.mode !== 'api') return;
    try {
      await revokeAuthentication(currentSession);
    } catch {
      sessionStorage.setItem(
        AUTH_NOTICE_KEY,
        'La sesión se cerró en este navegador, pero el servidor no confirmó el cierre.',
      );
    }
  }, [saveSession, session]);

  const request = useCallback(
    async (path: string, options: RequestInit = {}) => {
      if (!session) throw new Error('Tu sesión terminó. Inicia sesión nuevamente.');
      if (session.mode === 'mock') throw new Error('El modo mock no realiza solicitudes al API.');

      let response = await authenticatedApiRequest(path, session.accessToken, options);
      if (response.status !== 401) return response;

      try {
        const renewedSession = await refresh(session);
        response = await authenticatedApiRequest(path, renewedSession.accessToken, options);
        if (response.status !== 401) return response;
      } catch {
        // The refresh failure is reported below as an expired session.
      }

      saveSession(null);
      sessionStorage.setItem(
        AUTH_NOTICE_KEY,
        'Tu sesión expiró y no pudo renovarse. Inicia sesión nuevamente.',
      );
      router.replace('/login');
      throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
    },
    [refresh, router, saveSession, session],
  );

  const value = useMemo(
    () => ({ session, isReady, login, logout, request }),
    [isReady, login, logout, request, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return context;
}

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from './AuthContextCore';
import {
  centralLoginUrl,
  centralLogoutUrl,
  fetchCentralSession,
  type CentralAuthSession,
} from '../lib/centralAuth';
import { isLocalMockAuthEnabled, LOCAL_MOCK_USER } from '../lib/localDev';

const initialSession: CentralAuthSession = {
  authenticated: false,
  user: null,
};

const localMockSession: CentralAuthSession = {
  authenticated: true,
  user: LOCAL_MOCK_USER,
};

const LOCAL_SESSION_KEY = 'keshi.localMockAuth';

function readStoredLocalSession(): CentralAuthSession {
  if (typeof window === 'undefined') return localMockSession;
  try {
    const raw = window.localStorage.getItem(LOCAL_SESSION_KEY);
    if (raw === '0') return initialSession;
  } catch {
    // ignore storage errors in private mode
  }
  return localMockSession;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const localMock = isLocalMockAuthEnabled();
  const [session, setSession] = useState<CentralAuthSession>(
    localMock ? readStoredLocalSession() : initialSession,
  );
  const [loading, setLoading] = useState(!localMock);

  const refresh = useCallback(async () => {
    if (localMock) {
      setSession(readStoredLocalSession());
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setSession(await fetchCentralSession());
    } catch (error) {
      console.warn('Central auth session check failed', error);
      setSession(initialSession);
    } finally {
      setLoading(false);
    }
  }, [localMock]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authenticated: session.authenticated,
      loading,
      user: session.user,
      refresh,
      login: (returnTo = window.location.href) => {
        if (localMock) {
          try {
            window.localStorage.setItem(LOCAL_SESSION_KEY, '1');
          } catch {
            // ignore
          }
          setSession(localMockSession);
          return;
        }
        window.location.href = centralLoginUrl(returnTo);
      },
      logout: (returnTo = window.location.href) => {
        if (localMock) {
          try {
            window.localStorage.setItem(LOCAL_SESSION_KEY, '0');
          } catch {
            // ignore
          }
          setSession(initialSession);
          return;
        }
        window.location.href = centralLogoutUrl(returnTo);
      },
    }),
    [loading, localMock, refresh, session.authenticated, session.user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

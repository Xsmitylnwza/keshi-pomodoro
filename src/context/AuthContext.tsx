import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from './AuthContextCore';
import {
  centralLoginUrl,
  centralLogoutUrl,
  fetchCentralSession,
  type CentralAuthSession,
} from '../lib/centralAuth';

const initialSession: CentralAuthSession = {
  authenticated: false,
  user: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CentralAuthSession>(initialSession);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSession(await fetchCentralSession());
    } catch (error) {
      console.warn('Central auth session check failed', error);
      setSession(initialSession);
    } finally {
      setLoading(false);
    }
  }, []);

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
        window.location.href = centralLoginUrl(returnTo);
      },
      logout: (returnTo = window.location.origin) => {
        window.location.href = centralLogoutUrl(returnTo);
      },
    }),
    [loading, refresh, session.authenticated, session.user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

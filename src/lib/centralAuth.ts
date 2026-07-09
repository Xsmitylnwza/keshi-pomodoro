export interface CentralAuthUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface CentralAuthSession {
  authenticated: boolean;
  user: CentralAuthUser | null;
}

export function centralAuthBaseUrl() {
  const configured = import.meta.env.VITE_CENTRAL_AUTH_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:3210`;
    }
    if (hostname.endsWith('.xsmity.cloud')) return 'https://xsmity.cloud';
  }

  return 'http://localhost:3210';
}

export function centralLoginUrl(returnTo = window.location.href) {
  return `${centralAuthBaseUrl()}/auth/login?return_to=${encodeURIComponent(returnTo)}`;
}

export function centralLogoutUrl(returnTo = window.location.origin) {
  return `${centralAuthBaseUrl()}/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
}

export async function fetchCentralSession(): Promise<CentralAuthSession> {
  const response = await fetch(`${centralAuthBaseUrl()}/auth/session`, {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Central auth session failed (${response.status})`);
  }

  const payload = (await response.json()) as CentralAuthSession;
  return {
    authenticated: Boolean(payload.authenticated && payload.user),
    user: payload.user ?? null,
  };
}

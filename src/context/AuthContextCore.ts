import { createContext } from 'react';
import type { CentralAuthUser } from '../lib/centralAuth';

export interface AuthContextValue {
  authenticated: boolean;
  loading: boolean;
  user: CentralAuthUser | null;
  refresh: () => Promise<void>;
  login: (returnTo?: string) => void;
  logout: (returnTo?: string) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

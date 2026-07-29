import {
  centralLoginUrl,
  centralLogoutUrl,
  fetchCentralSession,
  type CentralAuthSession,
} from './centralAuth';

export interface AuthPort {
  fetchSession(): Promise<CentralAuthSession>;
  login(returnTo: string): void | Promise<DesktopLoginResult | void>;
  logout(returnTo: string): void | Promise<void>;
  logoutAndRemoveLocalData?(returnTo: string): void | Promise<void>;
}

export interface DesktopLoginResult {
  status: 'authenticated' | 'cancelled' | 'expired';
}

export const browserAuthPort: AuthPort = {
  fetchSession: fetchCentralSession,
  login(returnTo) {
    window.location.href = centralLoginUrl(returnTo);
  },
  logout(returnTo) {
    window.location.href = centralLogoutUrl(returnTo);
  },
};

const desktopBridge = typeof window !== 'undefined' ? window.keshiDesktop?.auth : undefined;

export const authPort: AuthPort = desktopBridge
  ? {
      fetchSession: fetchCentralSession,
      login() {
        return desktopBridge.login();
      },
      logout() {
        return desktopBridge.logout();
      },
      logoutAndRemoveLocalData() {
        return desktopBridge.logoutAndRemoveLocalData();
      },
    }
  : browserAuthPort;

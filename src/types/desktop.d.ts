export {};

import type { DesktopTimerSnapshot } from '../lib/timer/DesktopTimerPort';
import type {
  StartServerTimerInput,
  VersionedServerTimerInput,
} from '../lib/timer/ServerTimerPort.mjs';

declare global {
  interface Window {
    keshiDesktop?: {
      runtime: {
        kind: 'electron';
        bridgeVersion: 1;
        platform: 'win32';
        appVersion: string;
      };
      auth: {
        login(): Promise<{ status: 'authenticated' | 'cancelled' | 'expired' }>;
        logout(): Promise<void>;
        logoutAndRemoveLocalData(): Promise<void>;
      };
      timer: {
        snapshot(): Promise<DesktopTimerSnapshot>;
        start(input: StartServerTimerInput): Promise<DesktopTimerSnapshot>;
        pause(input: VersionedServerTimerInput): Promise<DesktopTimerSnapshot>;
        resume(input: VersionedServerTimerInput): Promise<DesktopTimerSnapshot>;
        cancel(input: VersionedServerTimerInput): Promise<DesktopTimerSnapshot>;
        subscribe(listener: (snapshot: DesktopTimerSnapshot) => void): () => void;
        signalVisibility(visible: boolean): void;
        signalOnline(): void;
      };
      preferences: {
        setSoundEnabled(enabled: boolean): Promise<void>;
      };
    };
  }
}

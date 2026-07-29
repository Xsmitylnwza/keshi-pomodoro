// ESM declarations for ServerTimerPort.mjs.
import type { TimerMode } from './TimerPort';

export interface ServerTimerActive {
  runId: string;
  ownerClientId: string;
  ownerKind: 'web' | 'desktop';
  mode: TimerMode;
  taskId: string | null;
  taskTitle: string | null;
  plannedSeconds: number;
  remainingSeconds: number;
  status: 'running' | 'paused';
  startedAt: string;
  endAt: string | null;
  pausedAt: string | null;
  businessTimeZone: string;
}

export interface ServerTimerRuntime {
  schemaVersion: 1;
  revision: number;
  active: ServerTimerActive | null;
  startEnabled?: boolean;
}

export interface TimerCommandResult {
  status: 'ok';
  idempotent: boolean;
  resultRevision: number;
  runtime: ServerTimerRuntime;
  completion?: {
    runId: string;
    mode: TimerMode;
    completedAt: string;
    businessDate: string;
    history: unknown;
    pomodoro: unknown | null;
  };
}

export interface StartServerTimerInput {
  runId?: string;
  expectedRevision: number;
  mode: TimerMode;
  taskId?: string | null;
  taskTitle?: string | null;
  plannedSeconds: number;
}

export interface VersionedServerTimerInput {
  runId: string;
  expectedRevision: number;
  commandId?: string;
}

export interface ServerTimerPort {
  kind: 'server' | 'desktop';
  clientId: string;
  runtime(): Promise<ServerTimerRuntime>;
  start(input: StartServerTimerInput): Promise<TimerCommandResult>;
  pause(input: VersionedServerTimerInput): Promise<TimerCommandResult>;
  resume(input: VersionedServerTimerInput): Promise<TimerCommandResult>;
  cancel(input: VersionedServerTimerInput): Promise<TimerCommandResult>;
  complete(input: VersionedServerTimerInput): Promise<TimerCommandResult>;
}

export function createServerTimerPort(options?: {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  storage?: Storage | null;
  randomUUID?: () => string;
  now?: () => Date;
  ownerKind?: 'web' | 'desktop';
}): ServerTimerPort;

export function validateRuntime(
  value: unknown,
  options?: { includeStartEnabled?: boolean },
): ServerTimerRuntime;

export const serverTimerPort: ServerTimerPort;

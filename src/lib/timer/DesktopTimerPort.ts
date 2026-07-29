import type {
  ServerTimerRuntime,
  StartServerTimerInput,
  TimerCommandResult,
  VersionedServerTimerInput,
} from './ServerTimerPort.mjs';

export type DesktopTimerConnection =
  | 'initializing'
  | 'online'
  | 'offline'
  | 'signed_out'
  | 'wrong_user'
  | 'conflict'
  | 'recovery_blocked'
  | 'error';

export interface DesktopTimerSnapshot extends ServerTimerRuntime {
  clientId: string | null;
  connection: DesktopTimerConnection;
  conflict: string | null;
  completionPending: boolean;
  presentedMode: 'focus' | 'break' | null;
  queuedCommandCount: number;
}

export interface DesktopTimerPort {
  kind: 'desktop';
  readonly clientId: string;
  runtime(): Promise<ServerTimerRuntime>;
  start(input: StartServerTimerInput): Promise<TimerCommandResult>;
  pause(input: VersionedServerTimerInput): Promise<TimerCommandResult>;
  resume(input: VersionedServerTimerInput): Promise<TimerCommandResult>;
  cancel(input: VersionedServerTimerInput): Promise<TimerCommandResult>;
  subscribe(listener: (snapshot: DesktopTimerSnapshot) => void): () => void;
  setVisible(visible: boolean): void;
  signalOnline(): void;
  setSoundEnabled(enabled: boolean): Promise<void>;
}

export function createDesktopTimerPort(
  bridge = typeof window === 'undefined' ? undefined : window.keshiDesktop,
): DesktopTimerPort | null {
  if (bridge?.runtime?.bridgeVersion !== 1 || !bridge.timer) return null;

  let latest: DesktopTimerSnapshot | null = null;
  const toRuntime = (snapshot: DesktopTimerSnapshot): ServerTimerRuntime => ({
    schemaVersion: 1,
    revision: snapshot.revision,
    active: snapshot.active,
    startEnabled: snapshot.startEnabled,
  });
  const command = async (
    operation: (input: VersionedServerTimerInput) => Promise<DesktopTimerSnapshot>,
    input: VersionedServerTimerInput,
  ): Promise<TimerCommandResult> => {
    const snapshot = await operation(input);
    latest = snapshot;
    return commandResult(snapshot);
  };

  return {
    kind: 'desktop',
    get clientId() {
      return latest?.clientId || '';
    },
    async runtime() {
      latest = await bridge.timer.snapshot();
      return toRuntime(latest);
    },
    async start(input) {
      latest = await bridge.timer.start(input);
      return commandResult(latest);
    },
    pause: input => command(bridge.timer.pause, input),
    resume: input => command(bridge.timer.resume, input),
    cancel: input => command(bridge.timer.cancel, input),
    subscribe(listener) {
      return bridge.timer.subscribe(snapshot => {
        latest = snapshot;
        listener(snapshot);
      });
    },
    setVisible: visible => bridge.timer.signalVisibility(visible),
    signalOnline: () => bridge.timer.signalOnline(),
    setSoundEnabled: enabled => bridge.preferences.setSoundEnabled(enabled),
  };
}

function commandResult(snapshot: DesktopTimerSnapshot): TimerCommandResult {
  return {
    status: 'ok',
    idempotent: false,
    resultRevision: snapshot.revision,
    runtime: {
      schemaVersion: 1,
      revision: snapshot.revision,
      active: snapshot.active,
      startEnabled: snapshot.startEnabled,
    },
  };
}

export const desktopTimerPort = createDesktopTimerPort();

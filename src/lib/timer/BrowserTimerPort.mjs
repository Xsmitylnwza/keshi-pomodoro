function positiveInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
}

export function plannedSeconds(mode, durations) {
  const minutes = mode === 'focus' ? durations.focusMinutes : durations.breakMinutes;
  return positiveInteger(minutes) * 60;
}

export function remainingSeconds(endTimeMs, nowMs = Date.now()) {
  return Math.max(0, Math.ceil((endTimeMs - nowMs) / 1000));
}

export function nextMode(mode) {
  return mode === 'focus' ? 'break' : 'focus';
}

export function createTimerEvent(input, runtime = {}) {
  const randomUUID = runtime.randomUUID ?? (() => crypto.randomUUID());
  const now = runtime.now ?? (() => new Date());
  const sessionId = input.sessionId || randomUUID();
  const eventId = randomUUID();
  const remaining = positiveInteger(input.remainingSeconds);
  const elapsed = input.elapsedSeconds === undefined
    ? Math.max(0, positiveInteger(input.plannedSeconds) - remaining)
    : positiveInteger(input.elapsedSeconds);

  return {
    sessionId,
    event: {
      id: eventId,
      sessionId,
      type: input.type,
      mode: input.mode,
      taskId: input.selectedTask?.id ?? null,
      taskTitle: input.selectedTask?.title ?? null,
      plannedSeconds: positiveInteger(input.plannedSeconds),
      elapsedSeconds: elapsed,
      remainingSeconds: remaining,
      createdAt: now().toISOString(),
      businessDate: input.businessDate,
      source: 'keshi-pomodoro',
      idempotencyKey: `keshi:event:${eventId}`,
    },
  };
}

export function createCompletionHistoryItem(input, runtime = {}) {
  const randomUUID = runtime.randomUUID ?? (() => crypto.randomUUID());
  const now = runtime.now ?? (() => new Date());
  const formatDate = runtime.formatDate ?? ((date) => date.toLocaleString(
    'en-US',
    { hour: 'numeric', minute: 'numeric', month: 'short', day: 'numeric' },
  ));
  const completedAt = now();
  const id = randomUUID();

  return {
    mode: input.mode,
    duration: input.mode === 'focus'
      ? positiveInteger(input.durations.focusMinutes)
      : positiveInteger(input.durations.breakMinutes),
    date: formatDate(completedAt),
    id,
    taskId: input.selectedTask?.id,
    taskTitle: input.selectedTask?.title,
    businessDate: input.businessDate,
    idempotencyKey: `keshi:history:${id}`,
  };
}

export const browserTimerPort = {
  ...serverTimerPort,
  plannedSeconds,
  remainingSeconds,
  nextMode,
  event: createTimerEvent,
  historyItem: createCompletionHistoryItem,
};
import { serverTimerPort } from './ServerTimerPort.mjs';

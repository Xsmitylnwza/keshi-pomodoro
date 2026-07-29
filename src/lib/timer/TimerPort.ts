import type { HistoryItem, PomodoroEvent, PomodoroEventType, SprintTask } from '../../types';
import type { ServerTimerPort } from './ServerTimerPort.mjs';

export type TimerMode = 'focus' | 'break';

export interface TimerDurations {
  focusMinutes: number;
  breakMinutes: number;
}

export interface TimerEventInput {
  type: PomodoroEventType;
  mode: TimerMode;
  selectedTask?: SprintTask | null;
  plannedSeconds: number;
  remainingSeconds: number;
  elapsedSeconds?: number;
  sessionId?: string | null;
  businessDate: string;
}

export interface TimerEventResult {
  event: PomodoroEvent;
  sessionId: string;
}

export interface CompletionHistoryInput {
  mode: TimerMode;
  durations: TimerDurations;
  selectedTask?: SprintTask | null;
  businessDate: string;
}

export interface BrowserTimerPort extends ServerTimerPort {
  plannedSeconds(mode: TimerMode, durations: TimerDurations): number;
  remainingSeconds(endTimeMs: number, nowMs?: number): number;
  nextMode(mode: TimerMode): TimerMode;
  event(input: TimerEventInput): TimerEventResult;
  historyItem(input: CompletionHistoryInput): HistoryItem;
}

// ESM declarations for BrowserTimerPort.mjs.
import type {
  BrowserTimerPort,
  CompletionHistoryInput,
  TimerEventInput,
  TimerEventResult,
  TimerMode,
  TimerDurations,
} from './TimerPort';
import type { HistoryItem } from '../../types';

export function plannedSeconds(mode: TimerMode, durations: TimerDurations): number;
export function remainingSeconds(endTimeMs: number, nowMs?: number): number;
export function nextMode(mode: TimerMode): TimerMode;
export function createTimerEvent(input: TimerEventInput): TimerEventResult;
export function createCompletionHistoryItem(input: CompletionHistoryInput): HistoryItem;
export const browserTimerPort: BrowserTimerPort;

export interface SprintSubtask {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

export interface SprintTask {
  id: string;
  title: string;
  status: 'todo' | 'doing' | 'done';
  sprint?: string;
  order?: number;
  createdAt?: string;
  updatedAt: string;
  subtasks?: SprintSubtask[];
}

export interface HistoryItem {
  mode: string;
  duration: number;
  date: string;
  id: string;
  taskId?: string;
  taskTitle?: string;
  syncedAt?: string;
  syncError?: string;
}

export type PomodoroEventType =
  | 'pomodoro_started'
  | 'pomodoro_paused'
  | 'pomodoro_resumed'
  | 'pomodoro_cancelled'
  | 'pomodoro_completed';

export interface PomodoroEvent {
  id: string;
  sessionId: string;
  type: PomodoroEventType;
  mode: 'focus' | 'break';
  taskId?: string | null;
  taskTitle?: string | null;
  plannedSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  createdAt: string;
  source: string;
}

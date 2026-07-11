import type { HistoryItem, PomodoroEvent, SprintTask } from '../types';
import { apiBaseUrl, buildApiUrl } from './apiBase';

export const sprintApiBaseUrl = apiBaseUrl;

export function normalizeTask(task: SprintTask, fallbackOrder = 0): SprintTask {
  const now = new Date().toISOString();
  return {
    ...task,
    status: task.status ?? 'doing',
    sprint: task.sprint ?? 'Today',
    order: task.order ?? fallbackOrder,
    createdAt: task.createdAt ?? task.updatedAt ?? now,
    updatedAt: task.updatedAt ?? now,
    businessDate: task.businessDate,
    idempotencyKey: task.idempotencyKey,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
  };
}

export function normalizeTasks(tasks: SprintTask[]): SprintTask[] {
  const total = tasks.length;
  return tasks
    .map((task, index) => normalizeTask(task, total - index))
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
}

export async function fetchSprintTasks(): Promise<SprintTask[]> {
  const response = await fetch(buildApiUrl('/tasks'), {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`Task sync failed (${response.status})`);

  const data = await response.json();
  const tasks = Array.isArray(data) ? data : data.tasks;
  if (!Array.isArray(tasks)) throw new Error('Task sync returned an invalid shape');

  return normalizeTasks(tasks);
}

export async function createSprintTask(task: SprintTask) {
  const response = await fetch(buildApiUrl('/tasks'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(task),
  });

  if (!response.ok) throw new Error(`Task create failed (${response.status})`);
  const data = await response.json().catch(() => null);
  return data?.task ?? task;
}

export async function updateSprintTask(task: SprintTask) {
  const response = await fetch(buildApiUrl(`/tasks/${encodeURIComponent(task.id)}`), {
    method: 'PUT',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(task),
  });

  if (!response.ok) throw new Error(`Task update failed (${response.status})`);
  const data = await response.json().catch(() => null);
  return data?.task ?? task;
}

export async function deleteSprintTask(taskId: string) {
  const response = await fetch(buildApiUrl(`/tasks/${encodeURIComponent(taskId)}`), {
    method: 'DELETE',
    credentials: 'include',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`Task delete failed (${response.status})`);
  return response.json().catch(() => null);
}

export async function pushPomodoroSession(item: HistoryItem, sessionId?: string | null) {
  if (item.mode !== 'focus') return null;

  const response = await fetch(buildApiUrl('/pomodoros'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      id: item.id,
      sessionId: sessionId ?? null,
      taskId: item.taskId,
      taskTitle: item.taskTitle,
      durationMinutes: item.duration,
      completedAt: new Date().toISOString(),
      businessDate: item.businessDate,
      source: 'keshi-pomodoro',
      idempotencyKey: item.idempotencyKey ? `${item.idempotencyKey}:pomodoro` : `keshi:pomodoro:${item.id}`,
    }),
  });

  if (!response.ok) throw new Error(`Session sync failed (${response.status})`);
  return response.json().catch(() => null);
}

export async function pushPomodoroEvent(event: PomodoroEvent) {
  const response = await fetch(buildApiUrl('/events'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) throw new Error(`Event sync failed (${response.status})`);
  return response.json().catch(() => null);
}

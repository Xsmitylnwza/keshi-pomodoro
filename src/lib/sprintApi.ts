import type { HistoryItem, PomodoroEvent, SprintTask } from '../types';

const TASKS_KEY = 'keshi_sprint_tasks';
const SELECTED_TASK_KEY = 'keshi_selected_task_id';

const defaultTasks: SprintTask[] = [
  {
    id: 'inbox',
    title: 'Inbox / planning',
    status: 'doing',
    sprint: 'Today',
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subtasks: [],
  },
];

export const sprintApiBaseUrl = import.meta.env.VITE_HERMES_TASKS_API_URL?.replace(/\/$/, '') ?? '';

export function loadLocalTasks(): SprintTask[] {
  const raw = localStorage.getItem(TASKS_KEY);
  if (!raw) return defaultTasks;

  try {
    const parsed = JSON.parse(raw) as SprintTask[];
    return Array.isArray(parsed) && parsed.length > 0 ? normalizeTasks(parsed) : defaultTasks;
  } catch {
    return defaultTasks;
  }
}

export function saveLocalTasks(tasks: SprintTask[]) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(normalizeTasks(tasks)));
}

export function normalizeTask(task: SprintTask, fallbackOrder = 0): SprintTask {
  const now = new Date().toISOString();
  return {
    ...task,
    status: task.status ?? 'doing',
    sprint: task.sprint ?? 'Today',
    order: task.order ?? fallbackOrder,
    createdAt: task.createdAt ?? task.updatedAt ?? now,
    updatedAt: task.updatedAt ?? now,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
  };
}

export function normalizeTasks(tasks: SprintTask[]): SprintTask[] {
  const total = tasks.length;
  return tasks
    .map((task, index) => normalizeTask(task, total - index))
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
}

export function loadSelectedTaskId() {
  return localStorage.getItem(SELECTED_TASK_KEY) ?? 'inbox';
}

export function saveSelectedTaskId(taskId: string) {
  localStorage.setItem(SELECTED_TASK_KEY, taskId);
}

export async function fetchSprintTasks(): Promise<SprintTask[]> {
  if (!sprintApiBaseUrl) return loadLocalTasks();

  const response = await fetch(`${sprintApiBaseUrl}/tasks`, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`Task sync failed (${response.status})`);

  const data = await response.json();
  const tasks = Array.isArray(data) ? data : data.tasks;
  if (!Array.isArray(tasks)) throw new Error('Task sync returned an invalid shape');

  const normalized = normalizeTasks(tasks);
  saveLocalTasks(normalized);
  return normalized;
}

export async function createSprintTask(task: SprintTask) {
  if (!sprintApiBaseUrl) return task;

  const response = await fetch(`${sprintApiBaseUrl}/tasks`, {
    method: 'POST',
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
  if (!sprintApiBaseUrl) return task;

  const response = await fetch(`${sprintApiBaseUrl}/tasks/${encodeURIComponent(task.id)}`, {
    method: 'PUT',
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
  if (!sprintApiBaseUrl) return null;

  const response = await fetch(`${sprintApiBaseUrl}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`Task delete failed (${response.status})`);
  return response.json().catch(() => null);
}

export async function pushPomodoroSession(item: HistoryItem) {
  if (!sprintApiBaseUrl || item.mode !== 'focus') return null;

  const response = await fetch(`${sprintApiBaseUrl}/pomodoros`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      id: item.id,
      taskId: item.taskId,
      taskTitle: item.taskTitle,
      durationMinutes: item.duration,
      completedAt: new Date().toISOString(),
      source: 'keshi-pomodoro',
    }),
  });

  if (!response.ok) throw new Error(`Session sync failed (${response.status})`);
  return response.json().catch(() => null);
}

export async function pushPomodoroEvent(event: PomodoroEvent) {
  if (!sprintApiBaseUrl) return null;

  const response = await fetch(`${sprintApiBaseUrl}/events`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) throw new Error(`Event sync failed (${response.status})`);
  return response.json().catch(() => null);
}

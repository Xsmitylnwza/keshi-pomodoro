import type { SprintTask } from '../types';

export const DISCIPLINE_SCORE_BLOCKS = [
  { key: 'deep_work', label: 'Deep work' },
  { key: 'reading', label: 'Reading' },
  { key: 'exercise', label: 'Exercise' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'discipline', label: 'Discipline' },
] as const;

export type DisciplineScoreKey = typeof DISCIPLINE_SCORE_BLOCKS[number]['key'];
export type DisciplineScoreMap = Record<string, number>;

export interface DisciplineScoreRecord {
  date: string;
  scores: DisciplineScoreMap;
  notes: string;
  total: number;
  average: number;
  createdAt: string | null;
  updatedAt: string | null;
  isGoodDay?: boolean;
  is_good_day?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DisciplineStreak {
  current: number;
  longest: number;
  lastScoreDate: string | null;
  updatedAt: string;
  current_streak?: number;
  longest_streak?: number;
  last_score_date?: string | null;
  updated_at?: string;
}

export interface DisciplineReadingEntry {
  id: string;
  date: string;
  title: string;
  pages: number;
  minutes: number;
  notes: string;
  createdAt: string;
}

export interface DisciplineExerciseEntry {
  id: string;
  date: string;
  type: string;
  durationMinutes: number;
  intensity: string;
  notes: string;
  createdAt: string;
}

export interface DisciplinePomodoroSession {
  id: string;
  taskId: string | null;
  taskTitle: string | null;
  durationMinutes: number;
  completedAt: string;
  source: string;
  storedAt?: string;
}

export interface DisciplineEvent {
  id: string;
  sessionId: string;
  type: 'pomodoro_started' | 'pomodoro_paused' | 'pomodoro_resumed' | 'pomodoro_cancelled' | 'pomodoro_completed';
  mode: 'focus' | 'break';
  taskId: string | null;
  taskTitle: string | null;
  plannedSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  createdAt: string;
  source: string;
}

export interface DisciplineReviewPayload {
  date: string;
  score: DisciplineScoreRecord | null;
  streak: DisciplineStreak;
  reading: DisciplineReadingEntry[];
  exercise: DisciplineExerciseEntry[];
  tasks: SprintTask[];
  pomodoros: DisciplinePomodoroSession[];
  events: DisciplineEvent[];
  generatedAt: string;
}

export interface DisciplineTrendPoint {
  date: string;
  scores: DisciplineScoreMap | null;
  notes: string;
  total: number;
  average: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DisciplineTrendResponse {
  days: number;
  from?: string;
  to?: string;
  startDate: string;
  endDate: string;
  trend: DisciplineTrendPoint[];
}

export interface DisciplineScoreSaveResponse {
  score: DisciplineScoreRecord;
  streak: DisciplineStreak;
}

export interface DisciplineLogSaveResponse {
  reading?: DisciplineReadingEntry;
  exercise?: DisciplineExerciseEntry;
}

const disciplineApiBase = import.meta.env.VITE_HERMES_DISCIPLINE_API_URL?.replace(/\/$/, '') ?? '/api/discipline';

function buildDisciplineUrl(path = '') {
  if (!path) return disciplineApiBase;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${disciplineApiBase}${normalizedPath}`;
}

async function disciplineRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const response = await fetch(buildDisciplineUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ? `Discipline API error: ${payload.error}` : `Discipline API request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export async function fetchDisciplineScores(date: string) {
  return disciplineRequest<{ score: DisciplineScoreRecord | null }>(`/scores?date=${encodeURIComponent(date)}`);
}

export async function fetchDisciplineTrend(days: 7 | 30, endDate: string) {
  const end = new Date(`${endDate}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const from = start.toISOString().slice(0, 10);
  return disciplineRequest<DisciplineTrendResponse>(`/scores/trend?from=${encodeURIComponent(from)}&to=${encodeURIComponent(endDate)}`);
}

export async function fetchDisciplineStreak() {
  return disciplineRequest<{ streak: DisciplineStreak }>('/streak');
}

export async function fetchDisciplineReading(date: string) {
  return disciplineRequest<{ date: string; reading: DisciplineReadingEntry[] }>(`/reading?date=${encodeURIComponent(date)}`);
}

export async function fetchDisciplineExercise(date: string) {
  return disciplineRequest<{ date: string; exercise: DisciplineExerciseEntry[] }>(`/exercise?date=${encodeURIComponent(date)}`);
}

export async function fetchDisciplineReview(date: string) {
  return disciplineRequest<DisciplineReviewPayload>(`/review?date=${encodeURIComponent(date)}`);
}

export async function saveDisciplineScores(date: string, scores: DisciplineScoreMap, notes = '') {
  return disciplineRequest<DisciplineScoreSaveResponse>('/scores', {
    method: 'POST',
    body: JSON.stringify({ date, scores, notes }),
  });
}

export async function addDisciplineReading(entry: {
  date: string;
  title: string;
  pages: number;
  minutes: number;
  notes?: string;
}) {
  return disciplineRequest<DisciplineLogSaveResponse>('/reading', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function addDisciplineExercise(entry: {
  date: string;
  type: string;
  durationMinutes: number;
  intensity?: string;
  notes?: string;
}) {
  return disciplineRequest<DisciplineLogSaveResponse>('/exercise', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

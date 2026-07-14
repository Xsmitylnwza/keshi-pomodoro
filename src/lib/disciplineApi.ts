import type { SprintTask } from '../types';

export const DISCIPLINE_SCORE_BLOCKS = [
  { key: 'deep_work', label: 'Deep work' },
  { key: 'reading', label: 'Reading' },
  { key: 'exercise', label: 'Exercise' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'discipline', label: 'Discipline' },
] as const;

export type DisciplineScoreKey = string;
export type DisciplineScoreMap = Record<string, number>;

export type HabitColorKey =
  | 'rose' | 'amber' | 'emerald' | 'sky' | 'lime' | 'violet'
  | 'orange' | 'cyan' | 'fuchsia' | 'teal' | 'indigo' | 'pink';

export type HabitIconKey =
  | 'bar-chart-3' | 'book-open' | 'dumbbell' | 'moon' | 'apple' | 'badge-check'
  | 'target' | 'brain' | 'heart' | 'coffee' | 'code-2' | 'pen-line' | 'music'
  | 'sun' | 'leaf' | 'flame' | 'timer' | 'check-circle-2' | 'sparkles' | 'wallet'
  | 'users' | 'phone' | 'camera' | 'globe' | 'home' | 'star';

export interface DisciplineHabitDefinition {
  key: string;
  label: string;
  icon: HabitIconKey | string;
  color: HabitColorKey | string;
  sortOrder: number;
  active: boolean;
  system: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** Binary completion only: 0 = not done, 1 = done. Legacy 0-10 maps with >0 => 1. */
export const HABIT_SCORE_MAX = 1;
export const HABIT_COUNT = DISCIPLINE_SCORE_BLOCKS.length;
export const DAY_HABIT_MAX = HABIT_COUNT * HABIT_SCORE_MAX;

export const HABIT_COLOR_KEYS: HabitColorKey[] = [
  'rose', 'amber', 'emerald', 'sky', 'lime', 'violet',
  'orange', 'cyan', 'fuchsia', 'teal', 'indigo', 'pink',
];

export const HABIT_ICON_KEYS: HabitIconKey[] = [
  'bar-chart-3', 'book-open', 'dumbbell', 'moon', 'apple', 'badge-check',
  'target', 'brain', 'heart', 'coffee', 'code-2', 'pen-line', 'music',
  'sun', 'leaf', 'flame', 'timer', 'check-circle-2', 'sparkles', 'wallet',
  'users', 'phone', 'camera', 'globe', 'home', 'star',
];

export type HabitVisual = {
  accent: string;
  track: string;
  fill: string;
  tint: string;
  swatch: string;
  soft: string;
};

export const HABIT_COLOR_VISUAL: Record<HabitColorKey, HabitVisual> = {
  rose: { accent: 'text-rose-300', track: 'bg-rose-400/15', fill: 'bg-rose-400', tint: 'bg-rose-400/10', swatch: 'bg-rose-400', soft: 'bg-rose-400/25' },
  amber: { accent: 'text-amber-300', track: 'bg-amber-400/15', fill: 'bg-amber-400', tint: 'bg-amber-400/10', swatch: 'bg-amber-400', soft: 'bg-amber-400/25' },
  emerald: { accent: 'text-emerald-300', track: 'bg-emerald-400/15', fill: 'bg-emerald-400', tint: 'bg-emerald-400/10', swatch: 'bg-emerald-400', soft: 'bg-emerald-400/25' },
  sky: { accent: 'text-sky-300', track: 'bg-sky-400/15', fill: 'bg-sky-400', tint: 'bg-sky-400/10', swatch: 'bg-sky-400', soft: 'bg-sky-400/25' },
  lime: { accent: 'text-lime-300', track: 'bg-lime-400/15', fill: 'bg-lime-400', tint: 'bg-lime-400/10', swatch: 'bg-lime-400', soft: 'bg-lime-400/25' },
  violet: { accent: 'text-violet-300', track: 'bg-violet-400/15', fill: 'bg-violet-400', tint: 'bg-violet-400/10', swatch: 'bg-violet-400', soft: 'bg-violet-400/25' },
  orange: { accent: 'text-orange-300', track: 'bg-orange-400/15', fill: 'bg-orange-400', tint: 'bg-orange-400/10', swatch: 'bg-orange-400', soft: 'bg-orange-400/25' },
  cyan: { accent: 'text-cyan-300', track: 'bg-cyan-400/15', fill: 'bg-cyan-400', tint: 'bg-cyan-400/10', swatch: 'bg-cyan-400', soft: 'bg-cyan-400/25' },
  fuchsia: { accent: 'text-fuchsia-300', track: 'bg-fuchsia-400/15', fill: 'bg-fuchsia-400', tint: 'bg-fuchsia-400/10', swatch: 'bg-fuchsia-400', soft: 'bg-fuchsia-400/25' },
  teal: { accent: 'text-teal-300', track: 'bg-teal-400/15', fill: 'bg-teal-400', tint: 'bg-teal-400/10', swatch: 'bg-teal-400', soft: 'bg-teal-400/25' },
  indigo: { accent: 'text-indigo-300', track: 'bg-indigo-400/15', fill: 'bg-indigo-400', tint: 'bg-indigo-400/10', swatch: 'bg-indigo-400', soft: 'bg-indigo-400/25' },
  pink: { accent: 'text-pink-300', track: 'bg-pink-400/15', fill: 'bg-pink-400', tint: 'bg-pink-400/10', swatch: 'bg-pink-400', soft: 'bg-pink-400/25' },
};

export const DEFAULT_HABIT_DEFINITIONS: DisciplineHabitDefinition[] = DISCIPLINE_SCORE_BLOCKS.map((block, index) => {
  const defaults: Record<string, { icon: HabitIconKey; color: HabitColorKey }> = {
    deep_work: { icon: 'bar-chart-3', color: 'rose' },
    reading: { icon: 'book-open', color: 'amber' },
    exercise: { icon: 'dumbbell', color: 'emerald' },
    sleep: { icon: 'moon', color: 'sky' },
    nutrition: { icon: 'apple', color: 'lime' },
    discipline: { icon: 'badge-check', color: 'violet' },
  };
  const meta = defaults[block.key] ?? { icon: 'target', color: HABIT_COLOR_KEYS[index % HABIT_COLOR_KEYS.length] };
  return {
    key: block.key,
    label: block.label,
    icon: meta.icon,
    color: meta.color,
    sortOrder: index,
    active: true,
    system: true,
  };
});

export const HABIT_VISUAL: Record<string, HabitVisual> = Object.fromEntries(
  DEFAULT_HABIT_DEFINITIONS.map((habit) => [habit.key, HABIT_COLOR_VISUAL[habit.color as HabitColorKey]]),
);

export function getHabitVisual(colorOrKey?: string | null): HabitVisual {
  if (colorOrKey && colorOrKey in HABIT_COLOR_VISUAL) {
    return HABIT_COLOR_VISUAL[colorOrKey as HabitColorKey];
  }
  if (colorOrKey && colorOrKey in HABIT_VISUAL) {
    return HABIT_VISUAL[colorOrKey];
  }
  return HABIT_COLOR_VISUAL.violet;
}

export function normalizeHabitDefinitions(habits?: DisciplineHabitDefinition[] | null): DisciplineHabitDefinition[] {
  if (!habits || habits.length === 0) return DEFAULT_HABIT_DEFINITIONS.map((habit) => ({ ...habit }));
  return habits
    .map((habit, index) => ({
      key: String(habit.key || '').trim(),
      label: String(habit.label || habit.key || 'Habit').trim() || 'Habit',
      icon: String(habit.icon || 'target'),
      color: String(habit.color || HABIT_COLOR_KEYS[index % HABIT_COLOR_KEYS.length]),
      sortOrder: Number.isFinite(Number(habit.sortOrder)) ? Number(habit.sortOrder) : index,
      active: habit.active !== false,
      system: Boolean(habit.system),
      createdAt: habit.createdAt ?? null,
      updatedAt: habit.updatedAt ?? null,
    }))
    .filter((habit) => habit.key)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
}

export function getActiveHabits(habits?: DisciplineHabitDefinition[] | null) {
  return normalizeHabitDefinitions(habits).filter((habit) => habit.active);
}

export function toBinaryHabitScore(value: unknown): 0 | 1 {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return 1;
}

export function normalizeHabitScoreMap(
  scores?: Record<string, number> | null,
  habits: readonly DisciplineHabitDefinition[] = DEFAULT_HABIT_DEFINITIONS,
): Record<string, 0 | 1> {
  const keys = getActiveHabits(habits as DisciplineHabitDefinition[]).map((habit) => habit.key);
  const sourceKeys = keys.length > 0 ? keys : DISCIPLINE_SCORE_BLOCKS.map((block) => block.key);
  return Object.fromEntries(
    sourceKeys.map((key) => [key, toBinaryHabitScore(scores?.[key])]),
  );
}

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
  businessDate?: string;
  idempotencyKey?: string;
}

export interface DisciplineExerciseEntry {
  id: string;
  date: string;
  type: string;
  durationMinutes: number;
  intensity: string;
  notes: string;
  createdAt: string;
  businessDate?: string;
  idempotencyKey?: string;
}

export interface DisciplinePomodoroSession {
  id: string;
  sessionId?: string | null;
  taskId: string | null;
  taskTitle: string | null;
  durationMinutes: number;
  completedAt: string;
  businessDate?: string;
  source: string;
  storedAt?: string;
  idempotencyKey?: string;
}

export interface DisciplineFocusActivity {
  focusMinutes: number;
  completedSessions: number;
  firstStartedAt: string | null;
  hourlyMinutes: number[];
  segments: Array<{
    sessionId: string;
    startedAt: string;
    endedAt: string;
    durationMinutes: number;
    taskTitle: string | null;
    source: 'event' | 'inferred';
  }>;
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
  businessDate?: string;
  source: string;
  idempotencyKey?: string;
}

export interface DisciplineTaskSnapshot {
  date: string;
  tasks: SprintTask[];
  source: string;
  generatedAt: string;
  idempotencyKey?: string;
}

export interface DisciplineReviewPayload {
  date: string;
  score: DisciplineScoreRecord | null;
  streak: DisciplineStreak;
  habits?: DisciplineHabitDefinition[];
  reading: DisciplineReadingEntry[];
  exercise: DisciplineExerciseEntry[];
  tasks: SprintTask[];
  taskSnapshot: DisciplineTaskSnapshot | null;
  taskSnapshotSource: string;
  taskSnapshotGeneratedAt: string | null;
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
  activity?: DisciplineFocusActivity;
}

export interface DisciplineTrendResponse {
  days: number;
  from?: string;
  to?: string;
  startDate: string;
  endDate: string;
  habits?: DisciplineHabitDefinition[];
  trend: DisciplineTrendPoint[];
}

export interface DisciplineHabitsResponse {
  habits: DisciplineHabitDefinition[];
  activeCount: number;
  colors: string[];
  icons: string[];
}

export interface DisciplineHabitMutationResponse {
  habit?: DisciplineHabitDefinition;
  habits: DisciplineHabitDefinition[];
  key?: string;
  deleted?: boolean;
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

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
    credentials: 'include',
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
  const from = toDateKey(start);
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
  businessDate?: string;
  title: string;
  pages: number;
  minutes: number;
  notes?: string;
  idempotencyKey?: string;
}) {
  return disciplineRequest<DisciplineLogSaveResponse>('/reading', {
    method: 'POST',
    body: JSON.stringify({ ...entry, businessDate: entry.businessDate ?? entry.date }),
  });
}

export async function addDisciplineExercise(entry: {
  date: string;
  businessDate?: string;
  type: string;
  durationMinutes: number;
  intensity?: string;
  notes?: string;
  idempotencyKey?: string;
}) {
  return disciplineRequest<DisciplineLogSaveResponse>('/exercise', {
    method: 'POST',
    body: JSON.stringify({ ...entry, businessDate: entry.businessDate ?? entry.date }),
  });
}


export async function fetchDisciplineHabits(includeInactive = true) {
  return disciplineRequest<DisciplineHabitsResponse>(`/habits?includeInactive=${includeInactive ? '1' : '0'}`);
}

export async function createDisciplineHabit(input: {
  key?: string;
  label: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  active?: boolean;
}) {
  return disciplineRequest<DisciplineHabitMutationResponse>('/habits', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateDisciplineHabit(key: string, input: {
  label?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  active?: boolean;
}) {
  return disciplineRequest<DisciplineHabitMutationResponse>(`/habits/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteDisciplineHabit(key: string) {
  return disciplineRequest<DisciplineHabitMutationResponse>(`/habits/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
}

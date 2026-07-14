import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Apple,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  Coffee,
  Dumbbell,
  Flame,
  Globe,
  Heart,
  History as HistoryIcon,
  Home,
  Leaf,
  LogOut,
  Moon,
  Music,
  Pause,
  PenLine,
  Phone,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Settings2,
  Sparkles,
  Star,
  Sun,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  UserCircle,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CustomCursor } from './CustomCursor';
import {
  DEFAULT_HABIT_DEFINITIONS,
  HABIT_COLOR_KEYS,
  HABIT_ICON_KEYS,
  HABIT_SCORE_MAX,
  createDisciplineHabit,
  deleteDisciplineHabit,
  fetchDisciplineHabits,
  getActiveHabits,
  getHabitVisual,
  normalizeHabitDefinitions,
  toBinaryHabitScore,
  updateDisciplineHabit,
  type DisciplineHabitDefinition,
  type DisciplineReviewPayload,
  type DisciplineScoreKey,
  type DisciplineTrendPoint,
  type HabitColorKey,
  type HabitIconKey,
  addDisciplineExercise,
  addDisciplineReading,
  fetchDisciplineReview,
  fetchDisciplineTrend,
  saveDisciplineScores,
} from '../lib/disciplineApi';
import {
  buildDisciplineDashboardModel,
  buildHabitTrendSummaries,
  getRecoveryRiskSummary,
  type HabitTrendSummary,
  type RecoveryRiskLevel,
} from '../lib/disciplineDashboardModel';
import type { CentralAuthUser } from '../lib/centralAuth';

const HEATMAP_DAYS = 30;
const CONSISTENCY_RANGE_OPTIONS = [
  { days: 7 as const, label: '7 days', shortLabel: '7D' },
  { days: 30 as const, label: '30 days', shortLabel: '30D' },
] as const;
type ConsistencyRangeDays = (typeof CONSISTENCY_RANGE_OPTIONS)[number]['days'];
const DEFAULT_CONSISTENCY_DAYS: ConsistencyRangeDays = 7;

type ScoreDraft = Record<DisciplineScoreKey, number>;
type HabitVisualMeta = {
  icon: LucideIcon;
  accent: string;
  track: string;
  fill: string;
  tint: string;
  swatch: string;
  soft: string;
};

const HABIT_ICON_MAP: Record<HabitIconKey, LucideIcon> = {
  'bar-chart-3': BarChart3,
  'book-open': BookOpen,
  dumbbell: Dumbbell,
  moon: Moon,
  apple: Apple,
  'badge-check': BadgeCheck,
  target: Target,
  brain: Brain,
  heart: Heart,
  coffee: Coffee,
  'code-2': Code2,
  'pen-line': PenLine,
  music: Music,
  sun: Sun,
  leaf: Leaf,
  flame: Flame,
  timer: Timer,
  'check-circle-2': CheckCircle2,
  sparkles: Sparkles,
  wallet: Wallet,
  users: Users,
  phone: Phone,
  camera: Camera,
  globe: Globe,
  home: Home,
  star: Star,
};

function resolveHabitIcon(icon?: string | null): LucideIcon {
  if (icon && icon in HABIT_ICON_MAP) return HABIT_ICON_MAP[icon as HabitIconKey];
  return Target;
}

function getHabitMeta(habit: Pick<DisciplineHabitDefinition, 'key' | 'icon' | 'color'> | string): HabitVisualMeta {
  if (typeof habit === 'string') {
    const fallback = DEFAULT_HABIT_DEFINITIONS.find((item) => item.key === habit);
    return {
      icon: resolveHabitIcon(fallback?.icon),
      ...getHabitVisual(fallback?.color ?? habit),
    };
  }
  return {
    icon: resolveHabitIcon(habit.icon),
    ...getHabitVisual(habit.color || habit.key),
  };
}

const EVENT_ICON: Record<DisciplineReviewPayload['events'][number]['type'], LucideIcon> = {
  pomodoro_started: Play,
  pomodoro_paused: Pause,
  pomodoro_resumed: RefreshCcw,
  pomodoro_cancelled: X,
  pomodoro_completed: CheckCircle2,
};

type HabitMatrixView = 'grid' | 'lanes' | 'weeks' | 'rank';
type FocusMatrixView = 'timeline' | 'days' | 'rank';

const HABIT_MATRIX_VIEW_OPTIONS: Array<{ id: HabitMatrixView; label: string; shortLabel: string }> = [
  { id: 'grid', label: 'Day grid', shortLabel: 'Grid' },
  { id: 'lanes', label: 'Habit lanes', shortLabel: 'Lanes' },
  { id: 'weeks', label: 'Week blocks', shortLabel: 'Weeks' },
  { id: 'rank', label: 'Rank list', shortLabel: 'Rank' },
];

const FOCUS_MATRIX_VIEW_OPTIONS: Array<{ id: FocusMatrixView; label: string; shortLabel: string }> = [
  { id: 'timeline', label: 'Hour timeline', shortLabel: 'Hours' },
  { id: 'days', label: 'Day intensity', shortLabel: 'Days' },
  { id: 'rank', label: 'Rank list', shortLabel: 'Rank' },
];

const MATRIX_VIEW_STORAGE_PREFIX = {
  habit: 'discipline.matrixView.habit',
  focus: 'discipline.matrixView.focus',
} as const;

const MOBILE_MATRIX_MAX_WIDTH = 768;

function isMobileViewport() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(`(max-width: ${MOBILE_MATRIX_MAX_WIDTH - 1}px)`).matches;
}

function matrixViewStorageKey(kind: 'habit' | 'focus', days: ConsistencyRangeDays) {
  return `${MATRIX_VIEW_STORAGE_PREFIX[kind]}.${days}`;
}

function defaultHabitMatrixView(days: ConsistencyRangeDays, mobile = isMobileViewport()): HabitMatrixView {
  if (mobile) return 'rank';
  return days === 30 ? 'lanes' : 'grid';
}

function defaultFocusMatrixView(days: ConsistencyRangeDays, mobile = isMobileViewport()): FocusMatrixView {
  if (mobile) return 'rank';
  return days === 30 ? 'days' : 'timeline';
}

function writeStoredView(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

function readOptionalStoredView<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const value = window.localStorage.getItem(key);
    if (value && (allowed as readonly string[]).includes(value)) return value as T;
  } catch {
    // ignore storage failures
  }
  return null;
}

function resolveHabitMatrixView(days: ConsistencyRangeDays): HabitMatrixView {
  const allowed = HABIT_MATRIX_VIEW_OPTIONS.map((option) => option.id) as HabitMatrixView[];
  return (
    readOptionalStoredView(matrixViewStorageKey('habit', days), allowed) ??
    readOptionalStoredView(MATRIX_VIEW_STORAGE_PREFIX.habit, allowed) ??
    defaultHabitMatrixView(days)
  );
}

function resolveFocusMatrixView(days: ConsistencyRangeDays): FocusMatrixView {
  const allowed = FOCUS_MATRIX_VIEW_OPTIONS.map((option) => option.id) as FocusMatrixView[];
  return (
    readOptionalStoredView(matrixViewStorageKey('focus', days), allowed) ??
    readOptionalStoredView(MATRIX_VIEW_STORAGE_PREFIX.focus, allowed) ??
    defaultFocusMatrixView(days)
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(media.matches);
    onChange();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  return reduced;
}

function chunkTrendByWeeks(trend: readonly DisciplineTrendPoint[]) {
  const chunks: DisciplineTrendPoint[][] = [];
  for (let index = 0; index < trend.length; index += 7) {
    chunks.push(trend.slice(index, index + 7));
  }
  return chunks;
}

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const latestCompletedDateKey = (referenceDate = new Date()) => {
  const completed = new Date(referenceDate);
  completed.setDate(completed.getDate() - 1);
  return toDateKey(completed);
};

const shiftDateKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

const formatLongDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

const formatShortDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

const createEmptyScores = (habits: readonly DisciplineHabitDefinition[] = DEFAULT_HABIT_DEFINITIONS): ScoreDraft =>
  Object.fromEntries(habits.map((habit) => [habit.key, 0])) as ScoreDraft;

const normalizeScores = (
  scores?: Record<string, number> | null,
  habits: readonly DisciplineHabitDefinition[] = DEFAULT_HABIT_DEFINITIONS,
): ScoreDraft => {
  const next = createEmptyScores(habits);
  for (const habit of habits) {
    next[habit.key] = toBinaryHabitScore(scores?.[habit.key]);
  }
  return next;
};

const clampDateKey = (dateKey: string, maxDateKey: string) => (dateKey > maxDateKey ? maxDateKey : dateKey);

const dayScoreMax = (habits: readonly DisciplineHabitDefinition[]) => Math.max(1, habits.length * HABIT_SCORE_MAX);

const summarizeReview = (review: DisciplineReviewPayload | null) => {
  const tasks = review?.tasks ?? [];
  const pomodoros = review?.pomodoros ?? [];
  const reading = review?.reading ?? [];
  const exercise = review?.exercise ?? [];

  return {
    taskCount: tasks.length,
    completedTasks: tasks.filter(task => task.status === 'done').length,
    pomodoroCount: pomodoros.length,
    focusMinutes: pomodoros.reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0),
    readingPages: reading.reduce((sum, entry) => sum + Number(entry.pages || 0), 0),
    readingMinutes: reading.reduce((sum, entry) => sum + Number(entry.minutes || 0), 0),
    exerciseMinutes: exercise.reduce((sum, entry) => sum + Number(entry.durationMinutes || 0), 0),
  };
};

const getTimelineTone = (minutes: number) => {
  if (minutes >= 20) return 'bg-accent-green shadow-[0_0_9px_rgba(52,211,153,0.4)]';
  if (minutes >= 10) return 'bg-accent-green/70';
  if (minutes > 0) return 'bg-accent-green/35';
  return 'bg-white/[0.045]';
};

const sumBinaryHabits = (
  scores?: Record<string, number> | null,
  habits: readonly DisciplineHabitDefinition[] = DEFAULT_HABIT_DEFINITIONS,
) => {
  const normalized = normalizeScores(scores, habits);
  return habits.reduce((sum, habit) => sum + normalized[habit.key], 0);
};

const scorePercent = (
  review: DisciplineReviewPayload | null,
  habits: readonly DisciplineHabitDefinition[] = DEFAULT_HABIT_DEFINITIONS,
) => {
  if (!review?.score) return null;
  const total = sumBinaryHabits(review.score.scores, habits);
  return Math.round(Math.max(0, Math.min(1, total / dayScoreMax(habits))) * 100);
};


interface DisciplineDashboardProps {
  onNavigateHome: () => void;
  onOpenSettings: () => void;
  onOpenInsights: () => void;
  onLogout: () => void;
  user: CentralAuthUser | null;
  focusSessionMinutes: number;
}

export function DisciplineDashboard({
  onNavigateHome,
  onOpenSettings,
  onOpenInsights,
  onLogout,
  user,
  focusSessionMinutes: _focusSessionMinutes,
}: DisciplineDashboardProps) {
  const [todayDate, setTodayDate] = useState(() => toDateKey(new Date()));
  const [dataThroughDate, setDataThroughDate] = useState(() => latestCompletedDateKey(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => latestCompletedDateKey(new Date()));
  const [todayReview, setTodayReview] = useState<DisciplineReviewPayload | null>(null);
  const [selectedReview, setSelectedReview] = useState<DisciplineReviewPayload | null>(null);
  const [trend, setTrend] = useState<DisciplineTrendPoint[]>([]);
  const [consistencyDays, setConsistencyDays] = useState<ConsistencyRangeDays>(DEFAULT_CONSISTENCY_DAYS);
  const [habitMatrixView, setHabitMatrixView] = useState<HabitMatrixView>(() => defaultHabitMatrixView(DEFAULT_CONSISTENCY_DAYS));
  const [focusMatrixView, setFocusMatrixView] = useState<FocusMatrixView>(() => defaultFocusMatrixView(DEFAULT_CONSISTENCY_DAYS));
  const prefersReducedMotion = usePrefersReducedMotion();
  const motionFade = prefersReducedMotion
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.18 } };
  const motionPanel = prefersReducedMotion
    ? { initial: false as const, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 }, transition: { duration: 0.18 } };
  const spinClass = prefersReducedMotion ? '' : 'animate-spin';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>(createEmptyScores());
  const [scoreNotes, setScoreNotes] = useState('');
  const [isSavingScores, setIsSavingScores] = useState(false);
  const [isAddingReading, setIsAddingReading] = useState(false);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [readingTitle, setReadingTitle] = useState('');
  const [readingPages, setReadingPages] = useState('');
  const [readingMinutes, setReadingMinutes] = useState('');
  const [readingNotes, setReadingNotes] = useState('');
  const [exerciseType, setExerciseType] = useState('');
  const [exerciseDuration, setExerciseDuration] = useState('');
  const [exerciseIntensity, setExerciseIntensity] = useState('');
  const [exerciseNotes, setExerciseNotes] = useState('');
  const [savingReading, setSavingReading] = useState(false);
  const [savingExercise, setSavingExercise] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'success' | 'error'>('success');
  const [habits, setHabits] = useState<DisciplineHabitDefinition[]>(DEFAULT_HABIT_DEFINITIONS);
  const [habitManagerOpen, setHabitManagerOpen] = useState(false);
  const [newHabitLabel, setNewHabitLabel] = useState('');
  const [newHabitIcon, setNewHabitIcon] = useState<HabitIconKey>('target');
  const [newHabitColor, setNewHabitColor] = useState<HabitColorKey>('violet');
  const [savingHabit, setSavingHabit] = useState(false);
  const loadRequestRef = useRef(0);

  const activeHabits = useMemo(() => getActiveHabits(habits), [habits]);
  const dayMax = useMemo(() => dayScoreMax(activeHabits), [activeHabits]);

  const applyHabits = useCallback((nextHabits?: DisciplineHabitDefinition[] | null) => {
    const normalized = normalizeHabitDefinitions(nextHabits);
    setHabits(normalized);
    return getActiveHabits(normalized);
  }, []);

  const loadData = useCallback(async (reviewDate: string, trendEndDate: string, liveDate: string) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    const clampedReviewDate = clampDateKey(reviewDate, trendEndDate);
    setLoading(true);
    setError(null);

    try {
      const selectedRequest = fetchDisciplineReview(clampedReviewDate);
      const todayRequest = clampedReviewDate === liveDate ? selectedRequest : fetchDisciplineReview(liveDate);
      const [reviewPayload, livePayload, trendPayload, habitsPayload] = await Promise.all([
        selectedRequest,
        todayRequest,
        fetchDisciplineTrend(HEATMAP_DAYS, liveDate),
        fetchDisciplineHabits(true).catch(() => null),
      ]);

      if (loadRequestRef.current !== requestId) return;

      const nextHabits = applyHabits(
        habitsPayload?.habits
          ?? reviewPayload.habits
          ?? livePayload.habits
          ?? trendPayload.habits
          ?? DEFAULT_HABIT_DEFINITIONS,
      );

      setSelectedDate(clampedReviewDate);
      setSelectedReview(reviewPayload);
      setTodayReview(livePayload);
      setTrend(trendPayload.trend);
      setScoreDraft(normalizeScores(reviewPayload.score?.scores, nextHabits));
      setScoreNotes(reviewPayload.score?.notes ?? '');
    } catch (fetchError) {
      if (loadRequestRef.current !== requestId) return;
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to load discipline data');
    } finally {
      if (loadRequestRef.current === requestId) setLoading(false);
    }
  }, [applyHabits]);

  useEffect(() => {
    void loadData(selectedDate, dataThroughDate, todayDate);
  }, [dataThroughDate, loadData, selectedDate, todayDate]);

  useEffect(() => {
    setStatusMessage(null);
  }, [selectedDate]);

  useEffect(() => {
    setHabitMatrixView(resolveHabitMatrixView(consistencyDays));
    setFocusMatrixView(resolveFocusMatrixView(consistencyDays));
  }, [consistencyDays]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(`(max-width: ${MOBILE_MATRIX_MAX_WIDTH - 1}px)`);
    const syncViewportDefaults = () => {
      // Only auto-switch when user has no explicit stored preference for this range.
      const habitAllowed = HABIT_MATRIX_VIEW_OPTIONS.map((option) => option.id) as HabitMatrixView[];
      const focusAllowed = FOCUS_MATRIX_VIEW_OPTIONS.map((option) => option.id) as FocusMatrixView[];
      const habitStored = readOptionalStoredView(matrixViewStorageKey('habit', consistencyDays), habitAllowed);
      const focusStored = readOptionalStoredView(matrixViewStorageKey('focus', consistencyDays), focusAllowed);
      if (!habitStored) setHabitMatrixView(defaultHabitMatrixView(consistencyDays, media.matches));
      if (!focusStored) setFocusMatrixView(defaultFocusMatrixView(consistencyDays, media.matches));
    };
    syncViewportDefaults();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', syncViewportDefaults);
      return () => media.removeEventListener('change', syncViewportDefaults);
    }
    media.addListener(syncViewportDefaults);
    return () => media.removeListener(syncViewportDefaults);
  }, [consistencyDays]);

  const handleHabitMatrixViewChange = useCallback((view: HabitMatrixView) => {
    setHabitMatrixView(view);
    writeStoredView(matrixViewStorageKey('habit', consistencyDays), view);
  }, [consistencyDays]);

  const handleFocusMatrixViewChange = useCallback((view: FocusMatrixView) => {
    setFocusMatrixView(view);
    writeStoredView(matrixViewStorageKey('focus', consistencyDays), view);
  }, [consistencyDays]);

  const todaySummary = useMemo(() => summarizeReview(todayReview), [todayReview]);
  const selectedSummary = useMemo(() => summarizeReview(selectedReview), [selectedReview]);

  const taskProgress = todaySummary.taskCount
    ? Math.round((todaySummary.completedTasks / todaySummary.taskCount) * 100)
    : null;
  const todayScore = scorePercent(todayReview, activeHabits);
  const currentStreak = todayReview?.streak.current ?? todayReview?.streak.current_streak ?? selectedReview?.streak.current ?? 0;

  const consistencyTrend = useMemo(() => trend.slice(-consistencyDays), [trend, consistencyDays]);
  const patternModel = useMemo(
    () =>
      buildDisciplineDashboardModel(trend, {
        dataThroughDate,
        momentumDays: consistencyDays,
        heatmapDays: consistencyDays,
        habitTrendDays: consistencyDays,
        habits: activeHabits,
      }),
    [trend, dataThroughDate, consistencyDays, activeHabits],
  );
  const recoveryRisk = useMemo(
    () =>
      getRecoveryRiskSummary(trend, {
        days: consistencyDays,
        endDate: dataThroughDate,
        habits: activeHabits,
      }),
    [trend, consistencyDays, dataThroughDate, activeHabits],
  );
  const habitTrends = useMemo(
    () =>
      buildHabitTrendSummaries(trend, {
        days: consistencyDays,
        endDate: dataThroughDate,
        habits: activeHabits,
      }),
    [trend, consistencyDays, dataThroughDate, activeHabits],
  );
  const readiness = useMemo(() => getReadinessPresentation(recoveryRisk.level, recoveryRisk), [recoveryRisk]);
  const shownUpDays = patternModel.momentum.shownUpDays;
  const consistencyScore = Math.round(patternModel.momentum.consistencyPercent);
  const hasTrendHistory = patternModel.momentum.days.some(day => day.shownUp);
  const consistencyRangeLabel = consistencyDays === 30 ? '30-day' : '7-day';
  const consistencyWindowLabel = consistencyTrend.length
    ? `${formatShortDate(consistencyTrend[0].date)} - ${formatShortDate(consistencyTrend[consistencyTrend.length - 1].date)}`
    : 'Waiting for recorded days';
  const patternBrief = useMemo(() => {
    const insights = patternModel.insights;
    return {
      headline: neutralizeGuidance(insights.headline),
      observations: insights.insights.map(line => neutralizeGuidance(line)).filter(Boolean),
      signal: neutralizeGuidance(insights.tomorrowFocus),
    };
  }, [patternModel.insights]);
  const strongestHabit = patternModel.momentum.bestHabit;
  const softestHabit = patternModel.momentum.weakestHabit;
  const risingHabits = useMemo(
    () => habitTrends.filter(habit => habit.direction === 'up').sort((a, b) => b.delta - a.delta).slice(0, 2),
    [habitTrends],
  );
  const fallingHabits = useMemo(
    () => habitTrends.filter(habit => habit.direction === 'down').sort((a, b) => a.delta - b.delta).slice(0, 2),
    [habitTrends],
  );
  const focusReality = useMemo(() => {
    const focusMinutes = consistencyTrend.reduce((sum, day) => sum + Number(day.activity?.focusMinutes ?? 0), 0);
    const sessions = consistencyTrend.reduce((sum, day) => sum + Number(day.activity?.completedSessions ?? 0), 0);
    const focusedDays = consistencyTrend.filter(day => Number(day.activity?.focusMinutes ?? 0) > 0).length;
    const scoredDays = consistencyTrend.filter(day => sumBinaryHabits(day.scores, activeHabits) > 0 || Number(day.activity?.focusMinutes ?? 0) > 0).length;
    const avgDeepWork =
      consistencyTrend.length > 0
        ? consistencyTrend.reduce((sum, day) => sum + toBinaryHabitScore(day.scores?.deep_work), 0) / consistencyTrend.length
        : 0;
    return { focusMinutes, sessions, focusedDays, scoredDays, avgDeepWork };
  }, [consistencyTrend, activeHabits]);

  const selectedScoreStats = useMemo(() => {
    const values = activeHabits.map((habit) => Number(scoreDraft[habit.key] ?? 0));
    const total = values.reduce((sum, value) => sum + toBinaryHabitScore(value), 0);
    return {
      total,
      average: values.length ? total / values.length : 0,
    };
  }, [scoreDraft, activeHabits]);

  const evidenceDetailsRef = useRef<HTMLDetailsElement | null>(null);

  const openEvidencePanel = useCallback(() => {
    const panel = evidenceDetailsRef.current;
    if (!panel) return;
    panel.open = true;
    window.requestAnimationFrame(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const selectReviewDate = useCallback(
    (dateKey: string, options?: { openEvidence?: boolean }) => {
      if (!dateKey) return;
      const nextDate = clampDateKey(dateKey, dataThroughDate);
      const shouldOpenEvidence = Boolean(options?.openEvidence);
      if (nextDate !== selectedDate) {
        setSelectedReview(null);
        setScoreDraft(createEmptyScores(activeHabits));
        setScoreNotes('');
        setSelectedDate(nextDate);
      }
      if (shouldOpenEvidence) {
        openEvidencePanel();
      }
    },
    [activeHabits, dataThroughDate, openEvidencePanel, selectedDate],
  );

  const selectReviewDateFromMatrix = useCallback(
    (dateKey: string) => {
      selectReviewDate(dateKey, { openEvidence: true });
    },
    [selectReviewDate],
  );

  const refreshDashboard = async () => {
    const now = new Date();
    const nextToday = toDateKey(now);
    const nextCompleted = latestCompletedDateKey(now);
    const nextSelected = clampDateKey(selectedDate, nextCompleted);

    if (nextToday === todayDate && nextCompleted === dataThroughDate && nextSelected === selectedDate) {
      await loadData(selectedDate, dataThroughDate, todayDate);
      return;
    }

    setTodayDate(nextToday);
    setDataThroughDate(nextCompleted);
    setSelectedDate(nextSelected);
  };

  const handleSaveScores = async () => {
    setIsSavingScores(true);
    setStatusMessage(null);
    try {
      await saveDisciplineScores(selectedDate, scoreDraft, scoreNotes.trim());
      setStatusTone('success');
      setStatusMessage('Habit checks saved.');
      await loadData(selectedDate, dataThroughDate, todayDate);
    } catch (saveError) {
      setStatusTone('error');
      setStatusMessage(saveError instanceof Error ? saveError.message : 'Unable to save scores');
    } finally {
      setIsSavingScores(false);
    }
  };

  const handleCreateHabit = async () => {
    const label = newHabitLabel.trim();
    if (!label) {
      setStatusTone('error');
      setStatusMessage('Habit label is required.');
      return;
    }
    setSavingHabit(true);
    setStatusMessage(null);
    try {
      const result = await createDisciplineHabit({
        label,
        icon: newHabitIcon,
        color: newHabitColor,
      });
      const nextHabits = applyHabits(result.habits);
      setScoreDraft((previous) => normalizeScores(previous, nextHabits));
      setNewHabitLabel('');
      setNewHabitIcon('target');
      setNewHabitColor(HABIT_COLOR_KEYS[nextHabits.length % HABIT_COLOR_KEYS.length] || 'violet');
      setStatusTone('success');
      setStatusMessage(`Habit added: ${result.habit?.label || label}`);
      await loadData(selectedDate, dataThroughDate, todayDate);
    } catch (saveError) {
      setStatusTone('error');
      setStatusMessage(saveError instanceof Error ? saveError.message : 'Unable to create habit');
    } finally {
      setSavingHabit(false);
    }
  };

  const handleToggleHabitActive = async (habit: DisciplineHabitDefinition) => {
    setSavingHabit(true);
    setStatusMessage(null);
    try {
      const result = await updateDisciplineHabit(habit.key, { active: !habit.active });
      const nextHabits = applyHabits(result.habits);
      setScoreDraft((previous) => normalizeScores(previous, nextHabits));
      setStatusTone('success');
      setStatusMessage(`${habit.label} ${habit.active ? 'deactivated' : 'activated'}.`);
      await loadData(selectedDate, dataThroughDate, todayDate);
    } catch (saveError) {
      setStatusTone('error');
      setStatusMessage(saveError instanceof Error ? saveError.message : 'Unable to update habit');
    } finally {
      setSavingHabit(false);
    }
  };

  const handleDeleteHabit = async (habit: DisciplineHabitDefinition) => {
    setSavingHabit(true);
    setStatusMessage(null);
    try {
      const result = await deleteDisciplineHabit(habit.key);
      const nextHabits = applyHabits(result.habits);
      setScoreDraft((previous) => normalizeScores(previous, nextHabits));
      setStatusTone('success');
      setStatusMessage(habit.system ? `${habit.label} deactivated.` : `${habit.label} removed.`);
      await loadData(selectedDate, dataThroughDate, todayDate);
    } catch (saveError) {
      setStatusTone('error');
      setStatusMessage(saveError instanceof Error ? saveError.message : 'Unable to delete habit');
    } finally {
      setSavingHabit(false);
    }
  };

  const handleSaveReading = async () => {
    const title = readingTitle.trim();
    if (!title) {
      setStatusTone('error');
      setStatusMessage('Reading title is required.');
      return;
    }

    setSavingReading(true);
    setStatusMessage(null);
    try {
      await addDisciplineReading({
        date: selectedDate,
        title,
        pages: Math.max(0, Number(readingPages || 0)),
        minutes: Math.max(0, Number(readingMinutes || 0)),
        notes: readingNotes.trim(),
      });
      setReadingTitle('');
      setReadingPages('');
      setReadingMinutes('');
      setReadingNotes('');
      setIsAddingReading(false);
      setStatusTone('success');
      setStatusMessage('Reading logged.');
      await loadData(selectedDate, dataThroughDate, todayDate);
    } catch (saveError) {
      setStatusTone('error');
      setStatusMessage(saveError instanceof Error ? saveError.message : 'Unable to save reading');
    } finally {
      setSavingReading(false);
    }
  };

  const handleSaveExercise = async () => {
    const type = exerciseType.trim();
    if (!type) {
      setStatusTone('error');
      setStatusMessage('Exercise type is required.');
      return;
    }

    setSavingExercise(true);
    setStatusMessage(null);
    try {
      await addDisciplineExercise({
        date: selectedDate,
        type,
        durationMinutes: Math.max(0, Number(exerciseDuration || 0)),
        intensity: exerciseIntensity.trim(),
        notes: exerciseNotes.trim(),
      });
      setExerciseType('');
      setExerciseDuration('');
      setExerciseIntensity('');
      setExerciseNotes('');
      setIsAddingExercise(false);
      setStatusTone('success');
      setStatusMessage('Exercise logged.');
      await loadData(selectedDate, dataThroughDate, todayDate);
    } catch (saveError) {
      setStatusTone('error');
      setStatusMessage(saveError instanceof Error ? saveError.message : 'Unable to save exercise');
    } finally {
      setSavingExercise(false);
    }
  };

  const canMoveForward = selectedDate < dataThroughDate;
  const initialLoading = loading && !todayReview;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-bg-dark text-paper-cream">
      <CustomCursor />
      <div className="noise-overlay" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.08),transparent_55%)]" />

      <header className="sticky top-0 z-[60] border-b border-white/10 bg-bg-dark/92 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onNavigateHome}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 border-2 border-white/15 bg-white/[0.03] px-3 text-xs font-black uppercase tracking-[0.16em] text-white/65 transition hover:border-white/35 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green active:translate-y-px sm:px-4"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={3} />
              <span className="hidden sm:inline">Pomodoro</span>
            </button>
            <div className="min-w-0">
              <div className="truncate text-[10px] font-black uppercase tracking-[0.24em] text-accent-green">XPT / Daily signal</div>
              <div className="truncate font-grotesk text-lg font-black tracking-tight text-white sm:text-xl">Discipline</div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshDashboard()}
              disabled={loading}
              className="grid h-11 w-11 place-items-center border-2 border-white/10 bg-white/[0.03] text-white/55 transition hover:border-white/30 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green active:translate-y-px disabled:cursor-wait disabled:opacity-50"
              aria-label="Refresh discipline data"
              title="Refresh discipline data"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? spinClass : ''}`} strokeWidth={3} />
            </button>
            <AccountMenu
              user={user}
              onOpenSettings={onOpenSettings}
              onOpenInsights={onOpenInsights}
              onLogout={onLogout}
            />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-3 py-5 pb-[max(5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
        <div className="sr-only" aria-live="polite">
          {loading ? 'Refreshing discipline data' : 'Discipline data loaded'}
        </div>

        <AnimatePresence>
          {(statusMessage || error) && (
            <motion.div
              className={`mb-6 flex flex-col gap-3 border-2 p-4 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between ${
                error || statusTone === 'error'
                  ? 'border-accent-red/50 bg-accent-red/10 text-red-200'
                  : 'border-accent-green/40 bg-accent-green/10 text-accent-green'
              }`}
              initial={motionFade.initial}
              animate={motionFade.animate}
              exit={motionFade.exit}
              transition={motionFade.transition}
              role={error || statusTone === 'error' ? 'alert' : 'status'}
            >
              <div className="flex items-center gap-2">
                {error || statusTone === 'error' ? <X className="h-4 w-4 shrink-0" /> : <BadgeCheck className="h-4 w-4 shrink-0" />}
                <span>{error || statusMessage}</span>
              </div>
              {error && (
                <button
                  type="button"
                  onClick={() => void loadData(selectedDate, dataThroughDate, todayDate)}
                  className="min-h-10 border-2 border-current px-4 text-xs font-black uppercase tracking-[0.16em] transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current active:translate-y-px"
                >
                  Try again
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>


        <div className="sticky top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-50 mb-6 border-2 border-white/10 bg-bg-dark/95 p-2 backdrop-blur-xl supports-[backdrop-filter]:bg-bg-dark/90 sm:top-[72px] sm:p-3">
          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div
                className="inline-flex shrink-0 border-2 border-white/10 bg-black/30 p-1"
                role="group"
                aria-label="Discipline range"
              >
                {CONSISTENCY_RANGE_OPTIONS.map(option => {
                  const active = consistencyDays === option.days;
                  return (
                    <button
                      key={option.days}
                      type="button"
                      onClick={() => setConsistencyDays(option.days)}
                      className={`min-h-11 min-w-[3.25rem] px-3 text-[11px] font-black uppercase tracking-[0.14em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green active:translate-y-px sm:min-w-[4.5rem] ${
                        active
                          ? 'border border-white/20 bg-white text-black'
                          : 'border border-transparent text-white/60 hover:bg-white/[0.05] hover:text-white'
                      }`}
                      aria-pressed={active}
                    >
                      {option.shortLabel}
                    </button>
                  );
                })}
              </div>

              <div className="flex shrink-0 items-center border-2 border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => selectReviewDate(shiftDateKey(selectedDate, -1))}
                  className="grid h-11 w-11 place-items-center text-white/65 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green"
                  aria-label="Previous completed day"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={3} />
                </button>
                <button
                  type="button"
                  onClick={() => selectReviewDate(dataThroughDate)}
                  className={`min-h-11 px-3 text-[11px] font-black uppercase tracking-[0.14em] transition ${
                    selectedDate === dataThroughDate ? 'bg-accent-green text-black' : 'text-white/65 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Latest
                </button>
                <button
                  type="button"
                  onClick={() => canMoveForward && selectReviewDate(shiftDateKey(selectedDate, 1))}
                  disabled={!canMoveForward}
                  className="grid h-11 w-11 place-items-center text-white/65 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green disabled:cursor-not-allowed disabled:text-white/20"
                  aria-label="Next completed day"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={3} />
                </button>
              </div>

              <div className="min-w-0 flex-1 border border-white/10 bg-black/25 px-3 py-2 sm:min-w-[12rem] sm:flex-none">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">Selected day</div>
                <div className="truncate text-sm font-black text-white sm:hidden">{formatShortDate(selectedDate)}</div>
                <div className="hidden truncate text-sm font-black text-white sm:block">{formatLongDate(selectedDate)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={openEvidencePanel}
                className="inline-flex min-h-11 items-center justify-center gap-2 border-2 border-white/15 bg-white/[0.03] px-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/70 transition hover:border-white/35 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green"
              >
                <HistoryIcon className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                <span className="truncate">Evidence</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setHabitManagerOpen(true);
                  window.requestAnimationFrame(() => {
                    document.getElementById('habit-catalog-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  });
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 border-2 border-white/15 bg-white/[0.03] px-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/70 transition hover:border-white/35 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green"
              >
                <Settings2 className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                <span className="truncate">Habits</span>
              </button>
            </div>
          </div>
        </div>

        <section aria-labelledby="today-heading" aria-busy={initialLoading}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-accent-green">Today / {formatLongDate(todayDate)}</div>
              <h1 id="today-heading" className="mt-2 font-grotesk text-3xl font-black leading-none tracking-tight text-white sm:text-4xl">
                Pattern mirror.
              </h1>
            </div>
            <div className="hidden border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/45 sm:block">
              Quiet signals from recorded data only
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="relative overflow-hidden border-2 border-white/15 bg-white/[0.035] p-5 sm:p-6">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-green/10 blur-3xl" />
              {initialLoading ? (
                <TodaySkeleton />
              ) : (
                <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 bg-paper-cream px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-black">
                      <Activity className="h-3.5 w-3.5" strokeWidth={3} /> Today metrics
                    </div>
                    <h2 className="mt-5 max-w-xl font-serif-custom text-2xl font-bold leading-tight text-white sm:text-3xl">
                      {todaySummary.pomodoroCount > 0
                        ? `${todaySummary.focusMinutes} focused minutes are already recorded.`
                        : 'No focused learning time is recorded yet.'}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55">
                      {todaySummary.taskCount > 0
                        ? `${todaySummary.completedTasks} of ${todaySummary.taskCount} planned tasks are complete.`
                        : 'There is no task plan for today, so the dashboard will not invent a completion target.'}
                    </p>

                    <div className="mt-6">
                      <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
                        <span>{taskProgress === null ? 'Task plan not set' : 'Today progress'}</span>
                        <span>{taskProgress === null ? '-' : `${taskProgress}%`}</span>
                      </div>
                      <div
                        className="h-2 overflow-hidden bg-white/10"
                        role="progressbar"
                        aria-label="Today task progress"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={taskProgress ?? 0}
                        aria-valuetext={taskProgress === null ? 'No task plan' : `${taskProgress} percent complete`}
                      >
                        <div
                          className={`h-full bg-accent-green ${prefersReducedMotion ? '' : 'transition-[width] duration-500'}`}
                          style={{ width: `${taskProgress ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <ScoreDial value={todayScore} total={todayReview?.score ? sumBinaryHabits(todayReview.score.scores, activeHabits) : null} maxHabits={dayMax} />
                </div>
              )}
            </article>

            <article className={`relative border-2 p-5 sm:p-6 ${readiness.cardClass}`}>
              <div className={`text-[10px] font-black uppercase tracking-[0.22em] ${readiness.labelClass}`}>
                Readiness signal
              </div>
              <h2 className="mt-3 font-grotesk text-2xl font-black leading-tight text-white">{readiness.stateLabel}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{readiness.summary}</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="border border-white/10 bg-black/25 px-3 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">Deep work rate</div>
                  <div className="mt-1 font-grotesk text-xl font-black text-white">{Math.round(recoveryRisk.deepWorkAverage * 100)}%</div>
                </div>
                <div className="border border-white/10 bg-black/25 px-3 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">Recovery rate</div>
                  <div className="mt-1 font-grotesk text-xl font-black text-white">{Math.round(recoveryRisk.recoveryAverage * 100)}%</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {recoveryRisk.flags.length > 0 ? (
                  recoveryRisk.flags.map(flag => (
                    <span
                      key={flag}
                      className="border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/55"
                    >
                      {formatRiskFlag(flag)}
                    </span>
                  ))
                ) : (
                  <span className="border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                    No load flags
                  </span>
                )}
              </div>
            </article>
          </div>

          <article className="mt-4 border-2 border-white/15 bg-white/[0.03] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">Pattern brief</div>
                <h2 className="mt-2 font-grotesk text-xl font-black text-white sm:text-2xl">{patternBrief.headline}</h2>
              </div>
              <div className="border border-white/10 bg-black/25 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
                Through {formatShortDate(patternModel.dataThroughDate)}
              </div>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {patternBrief.observations.map((line, index) => (
                <li key={`${index}-${line.slice(0, 24)}`} className="border-l-2 border-white/15 bg-black/20 px-3 py-2 text-sm leading-relaxed text-white/65">
                  {line}
                </li>
              ))}
            </ul>
            {patternBrief.signal ? (
              <p className="mt-4 border border-white/10 bg-black/25 px-4 py-3 text-sm leading-relaxed text-white/55">
                <span className="mr-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">Observed signal</span>
                {patternBrief.signal}
              </p>
            ) : null}
          </article>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              icon={Target}
              label="Today progress"
              value={todaySummary.taskCount ? `${todaySummary.completedTasks}/${todaySummary.taskCount}` : 'No plan'}
              detail={todaySummary.taskCount ? `${taskProgress}% of planned tasks` : 'No invented target'}
            />
            <MetricCard icon={Flame} label="Current streak" value={`${currentStreak} day${currentStreak === 1 ? '' : 's'}`} detail={`Longest: ${todayReview?.streak.longest ?? 0} days`} />
            <MetricCard icon={Clock3} label="Focused learning" value={`${todaySummary.focusMinutes} min`} detail="Completed focus time today" />
            <MetricCard icon={CheckCircle2} label="Sessions done" value={`${todaySummary.pomodoroCount}`} detail="Completed Pomodoro sessions" />
          </div>
        </section>

        <section className="mt-10" aria-labelledby="consistency-heading">
          <SectionHeading
            icon={CalendarDays}
            title="Learning consistency"
            subtitle="Completed focus sessions and scored days across the selected window"
            id="consistency-heading"
          />

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              icon={Clock3}
              label="Focus minutes"
              value={`${focusReality.focusMinutes}`}
              detail={`${consistencyRangeLabel} completed focus time`}
            />
            <MetricCard
              icon={CheckCircle2}
              label="Sessions"
              value={`${focusReality.sessions}`}
              detail="Completed Pomodoro sessions"
            />
            <MetricCard
              icon={CalendarDays}
              label="Active focus days"
              value={`${focusReality.focusedDays}/${consistencyTrend.length || consistencyDays}`}
              detail="Days with any completed focus minutes"
            />
            <MetricCard
              icon={BarChart3}
              label="Deep work avg"
              value={`${Math.round(focusReality.avgDeepWork * 100)}%`}
              detail={`${focusReality.scoredDays} checked days in window`}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <article className="border-2 border-white/15 bg-white/[0.03] p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-black text-white">Last {consistencyDays} days / focus matrix</div>
                  <div className="mt-1 text-xs text-white/55">{consistencyWindowLabel}</div>
                </div>
                <div className="w-full sm:ml-auto sm:w-auto sm:max-w-full sm:shrink-0">
                  <MatrixViewSwitcher
                    label="Focus matrix view"
                    options={FOCUS_MATRIX_VIEW_OPTIONS}
                    value={focusMatrixView}
                    onChange={handleFocusMatrixViewChange}
                  />
                </div>
              </div>

              {focusMatrixView === 'timeline' ? (
                <div className="mt-3 flex justify-end">
                  <HeatmapLegend />
                </div>
              ) : null}

              <div className="mt-5" aria-busy={loading && consistencyTrend.length === 0}>
                <ContributionHeatmap
                  view={focusMatrixView}
                  trend={consistencyTrend}
                  selectedDate={selectedDate}
                  onSelectDate={selectReviewDateFromMatrix}
                  loading={loading && consistencyTrend.length === 0}
                />
              </div>

              {!hasTrendHistory && !loading && (
                <div className="mt-5 border border-dashed border-white/15 bg-black/20 p-4 text-sm leading-relaxed text-white/45">
                  No habit checks are recorded in this window yet. Colored cells appear after daily checks are saved.
                </div>
              )}
            </article>

            <article className="border-2 border-white/15 bg-white/[0.03] p-5 sm:p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">{consistencyRangeLabel} consistency score</div>
              <div className="mt-3 flex items-end gap-2">
                <div className="font-grotesk text-5xl font-black leading-none text-white">{consistencyScore}</div>
                <div className="pb-1 text-lg font-black text-accent-green">%</div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                {shownUpDays} of {consistencyTrend.length || consistencyDays} days have recorded focus activity or a discipline score.
              </p>

              <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
                <SignalRow
                  label="Highest completion"
                  value={strongestHabit ? `${strongestHabit.label} / ${Math.round(strongestHabit.average * 100)}%` : 'Waiting for checks'}
                  tone="text-accent-green"
                />
                <SignalRow
                  label="Lowest completion"
                  value={softestHabit ? `${softestHabit.label} / ${Math.round(softestHabit.average * 100)}%` : 'Waiting for checks'}
                  tone="text-amber-300"
                />
                <SignalRow
                  label="Habits / day"
                  value={hasTrendHistory ? `${patternModel.momentum.averageScore.toFixed(1)} / ${dayMax}` : 'Waiting for checks'}
                  tone="text-white/70"
                />
              </div>

              <div className="mt-5 border-l-2 border-white/25 bg-black/25 px-4 py-3 text-sm leading-relaxed text-white/65">
                {hasTrendHistory
                  ? `${shownUpDays} scored or active days in this ${consistencyDays}-day window. Consistency sits at ${consistencyScore}%.`
                  : 'No scored days are available in this window yet.'}
              </div>
            </article>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="habit-matrix-heading">
          <SectionHeading
            icon={BarChart3}
            title="Habit completion matrix"
            subtitle={`Did / did not checks for each habit across the last ${consistencyDays} days`}
            id="habit-matrix-heading"
          />
          <article className="mt-4 border-2 border-white/15 bg-white/[0.03] p-4 sm:p-6">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 pr-0 text-sm text-white/65 sm:pr-2">
                {habitMatrixView === 'grid' && 'Check mark = done. Dot = not done. Habit color is secondary.'}
                {habitMatrixView === 'lanes' && 'Each lane is one habit. Check marks show consecutive done days.'}
                {habitMatrixView === 'weeks' && 'Full-width week columns. Each day fills the row with habit checks.'}
                {habitMatrixView === 'rank' && 'Habits ranked by completion rate in this window.'}
              </div>
              <div className="w-full sm:ml-auto sm:w-auto sm:max-w-full sm:shrink-0">
                <MatrixViewSwitcher
                  label="Habit matrix view"
                  options={HABIT_MATRIX_VIEW_OPTIONS}
                  value={habitMatrixView}
                  onChange={handleHabitMatrixViewChange}
                />
              </div>
            </div>
            <div className="mb-4 flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
              {activeHabits.map((habit) => {
                const meta = getHabitMeta(habit);
                const Icon = meta.icon;
                return (
                  <span key={habit.key} className="inline-flex shrink-0 items-center gap-2 border border-white/10 bg-black/25 px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/70">
                    <span className={`grid h-4 w-4 place-items-center ${meta.tint}`}>
                      <Icon className={`h-3 w-3 ${meta.accent}`} strokeWidth={2.5} />
                    </span>
                    {habit.label}
                  </span>
                );
              })}
            </div>
            <div aria-busy={loading && consistencyTrend.length === 0}>
            <HabitCompletionMatrix
              view={habitMatrixView}
              habits={activeHabits}
              habitTrends={habitTrends}
              trend={consistencyTrend}
              selectedDate={selectedDate}
              onSelectDate={selectReviewDateFromMatrix}
              loading={loading && consistencyTrend.length === 0}
            />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {habitTrends.map((habit) => {
                const rate = Math.round(habit.average * 100);
                const definition = activeHabits.find((item) => item.key === habit.key);
                const meta = getHabitMeta(definition ?? habit.key);
                const Icon = meta.icon;
                return (
                  <div key={habit.key} className="border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`grid h-7 w-7 place-items-center ${meta.tint}`}>
                          <Icon className={`h-3.5 w-3.5 ${meta.accent}`} strokeWidth={2.5} />
                        </span>
                        <span className="text-sm font-semibold text-white/80">{habit.label}</span>
                      </div>
                      <span className={`text-sm font-black ${meta.accent}`}>{rate}%</span>
                    </div>
                    <div className={`mt-3 h-1.5 overflow-hidden ${meta.track}`}>
                      <div className={`h-full ${meta.fill}`} style={{ width: `${rate}%` }} />
                    </div>
                    <div className="mt-2 text-[11px] text-white/40">
                      {habit.activeDays}/{consistencyTrend.length || consistencyDays} days done
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <section className="mt-10" aria-labelledby="habit-momentum-heading">
          <SectionHeading
            icon={TrendingUp}
            title="Habit momentum"
            subtitle={`Completion direction over the last ${consistencyDays} days`}
            id="habit-momentum-heading"
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {habitTrends.length > 0 ? (
              habitTrends.map((habit) => <HabitMomentumCard key={habit.key} habit={habit} definition={activeHabits.find((item) => item.key === habit.key)} />)
            ) : (
              <div className="border border-dashed border-white/15 bg-black/20 p-4 text-sm text-white/45 md:col-span-2 xl:col-span-3">
                Habit direction will appear after completed-day checks exist in this window.
              </div>
            )}
          </div>
          {(risingHabits.length > 0 || fallingHabits.length > 0) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="border border-white/10 bg-white/[0.025] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-accent-green">Rising</div>
                <div className="mt-2 space-y-1 text-sm text-white/70">
                  {risingHabits.length > 0
                    ? risingHabits.map(habit => (
                        <div key={habit.key}>
                          {habit.label} · +{Math.round(habit.delta * 100)} pts
                        </div>
                      ))
                    : 'No rising habit in this window.'}
                </div>
              </div>
              <div className="border border-white/10 bg-white/[0.025] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">Softening</div>
                <div className="mt-2 space-y-1 text-sm text-white/70">
                  {fallingHabits.length > 0
                    ? fallingHabits.map(habit => (
                        <div key={habit.key}>
                          {habit.label} · {Math.round(habit.delta * 100)} pts
                        </div>
                      ))
                    : 'No softening habit in this window.'}
                </div>
              </div>
            </div>
          )}
        </section>

        <details ref={evidenceDetailsRef} id="discipline-evidence" className="group mt-10 border-2 border-white/15 bg-white/[0.02]">
          <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-4 p-4 transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent-green sm:p-6 [&::-webkit-details-marker]:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center border border-white/15 bg-white/[0.04] text-white/65">
                <HistoryIcon className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h2 className="font-grotesk text-lg font-black text-white">Evidence & logs</h2>
                <p className="truncate text-sm text-white/45">Collapsed source data: scores, tasks, focus, reading, and exercise.</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 sm:block">{selectedDate}</span>
              <ChevronDown className="h-5 w-5 text-white/55 transition-transform group-open:rotate-180" strokeWidth={3} />
            </div>
          </summary>

          <div className="border-t border-white/10 p-4 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-accent-green">Selected completed day</div>
                <h3 className="mt-2 text-2xl font-black text-white">{formatLongDate(selectedDate)}</h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center border-2 border-white/10 bg-white/[0.03] p-1">
                  <button
                    type="button"
                    onClick={() => selectReviewDate(shiftDateKey(selectedDate, -1))}
                    className="grid h-9 w-9 place-items-center text-white/55 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green"
                    aria-label="Previous completed day"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    onClick={() => selectReviewDate(dataThroughDate)}
                    className={`min-h-9 px-4 text-xs font-black uppercase tracking-[0.14em] transition ${
                      selectedDate === dataThroughDate ? 'bg-accent-green text-black' : 'text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Latest
                  </button>
                  <button
                    type="button"
                    onClick={() => canMoveForward && selectReviewDate(shiftDateKey(selectedDate, 1))}
                    disabled={!canMoveForward}
                    className="grid h-9 w-9 place-items-center text-white/55 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green disabled:cursor-not-allowed disabled:text-white/20"
                    aria-label="Next completed day"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={3} />
                  </button>
                </div>

                <label className="flex min-h-11 items-center border-2 border-white/10 bg-white/[0.03] px-3 transition focus-within:border-accent-green/60 hover:border-white/25">
                  <CalendarDays className="mr-2 h-4 w-4 text-white/45" strokeWidth={3} />
                  <input
                    type="date"
                    value={selectedDate}
                    max={dataThroughDate}
                    onChange={event => selectReviewDate(event.target.value)}
                    className="bg-transparent text-xs font-bold uppercase tracking-wider text-white/80 outline-none"
                    aria-label="Choose completed review date"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard icon={BarChart3} label="Habits done" value={`${selectedScoreStats.total}/${dayMax}`} detail={`${Math.round(selectedScoreStats.average * 100)}% of daily checks`} />
              <MetricCard icon={Clock3} label="Focus volume" value={`${selectedSummary.focusMinutes} min`} detail={`${selectedSummary.pomodoroCount} completed sessions`} />
              <MetricCard icon={BookOpen} label="Reading" value={`${selectedSummary.readingPages} pages`} detail={`${selectedSummary.readingMinutes} minutes`} />
              <MetricCard icon={Dumbbell} label="Exercise" value={`${selectedSummary.exerciseMinutes} min`} detail={`${selectedReview?.exercise.length ?? 0} entries`} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <section className="border border-white/10 bg-black/20 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-white">Habit checks</h3>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Done / not done</span>
                  </div>
                  <p className="mt-3 border-l-2 border-white/15 pl-3 text-sm leading-relaxed text-white/55">
                    {selectedReview?.score?.notes?.trim() || 'No reflection was recorded for this day.'}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {activeHabits.map((habit) => {
                      const meta = getHabitMeta(habit);
                      const Icon = meta.icon;
                      const value = toBinaryHabitScore(selectedReview?.score?.scores?.[habit.key] ?? scoreDraft[habit.key] ?? 0);
                      const done = value === 1;
                      return (
                        <div key={habit.key} className={`border p-3 ${done ? 'border-white/20 bg-white/[0.04]' : 'border-white/10 bg-white/[0.015]'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className={`grid h-8 w-8 place-items-center ${meta.tint}`}>
                                <Icon className={`h-4 w-4 ${meta.accent}`} strokeWidth={2.5} />
                              </span>
                              <span className="text-sm font-semibold text-white/75">{habit.label}</span>
                            </div>
                            <span className={`text-[11px] font-black uppercase tracking-[0.14em] ${done ? meta.accent : 'text-white/35'}`}>
                              {done ? 'Done' : 'Not done'}
                            </span>
                          </div>
                          <div className={`mt-3 h-2 ${done ? meta.fill : 'bg-white/10'}`} />
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="border border-white/10 bg-black/20 p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-white">Tasks</h3>
                    <span className="text-xs text-white/45">{selectedSummary.completedTasks}/{selectedSummary.taskCount} complete</span>
                  </div>
                  <div className="space-y-2">
                    {(selectedReview?.tasks ?? []).map(task => (
                      <div key={task.id} className="flex items-center justify-between gap-3 border border-white/10 bg-white/[0.025] p-3">
                        <span className="min-w-0 truncate text-sm font-semibold text-white/75">{task.title}</span>
                        <span className={`shrink-0 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${task.status === 'done' ? 'bg-accent-green/15 text-accent-green' : task.status === 'doing' ? 'bg-amber-400/15 text-amber-300' : 'bg-white/10 text-white/50'}`}>
                          {task.status}
                        </span>
                      </div>
                    ))}
                    {(selectedReview?.tasks.length ?? 0) === 0 && !loading && <EmptyState icon={Target} message="No tasks were connected to this completed day." />}
                  </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-2">
                  <section className="border border-white/10 bg-black/20 p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black text-white">Focus sessions</h3>
                      <span className="text-xs text-white/45">{selectedSummary.pomodoroCount}</span>
                    </div>
                    <div className="space-y-2">
                      {(selectedReview?.pomodoros ?? []).slice(0, 8).map(session => (
                        <div key={session.id} className="flex items-center justify-between gap-3 border border-white/10 bg-white/[0.025] p-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white/75">{session.taskTitle || 'Deep work session'}</div>
                            <div className="mt-1 text-xs text-white/40">{formatDateTime(session.completedAt)}</div>
                          </div>
                          <span className="shrink-0 text-sm font-black text-white">{session.durationMinutes} min</span>
                        </div>
                      ))}
                      {(selectedReview?.pomodoros.length ?? 0) === 0 && !loading && <EmptyState icon={Clock3} message="No focus sessions were completed on this day." />}
                    </div>
                  </section>

                  <section className="border border-white/10 bg-black/20 p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black text-white">Session activity</h3>
                      <span className="text-xs text-white/45">{selectedReview?.events.length ?? 0} events</span>
                    </div>
                    <div className="space-y-2">
                      {(selectedReview?.events ?? []).slice(0, 8).map(event => {
                        const EventIcon = EVENT_ICON[event.type];
                        return (
                          <div key={event.id} className="flex items-center gap-3 border border-white/10 bg-white/[0.025] p-3">
                            <EventIcon className="h-4 w-4 shrink-0 text-white/45" strokeWidth={2.5} />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-white/70">{event.taskTitle || event.type.replace('pomodoro_', '')}</div>
                              <div className="mt-1 text-xs text-white/40">{formatDateTime(event.createdAt)}</div>
                            </div>
                          </div>
                        );
                      })}
                      {(selectedReview?.events.length ?? 0) === 0 && !loading && <EmptyState icon={Activity} message="No session events were captured on this day." />}
                    </div>
                  </section>
                </div>
              </div>

              <div className="space-y-6">
                <section className="border border-white/10 bg-black/20 p-4 sm:p-5">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-white">Update habit checks</h3>
                      <p className="mt-1 text-xs text-white/45">Mark each habit as done or not done for this day.</p>
                    </div>
                    <span className="font-mono text-[10px] text-white/35">{selectedDate}</span>
                  </div>

                  <div className="space-y-4">
                    {activeHabits.map((habit) => (
                      <ScoreRow
                        key={habit.key}
                        habit={habit}
                        value={scoreDraft[habit.key] ?? 0}
                        onChange={(value) => setScoreDraft((previous) => ({ ...previous, [habit.key]: value }))}
                      />
                    ))}
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Reflection</span>
                      <textarea
                        value={scoreNotes}
                        onChange={event => setScoreNotes(event.target.value)}
                        rows={4}
                        className="w-full border-2 border-white/10 bg-black/35 px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-accent-green/50"
                        placeholder="What shaped this completed day?"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleSaveScores()}
                      disabled={isSavingScores || loading}
                      className="inline-flex min-h-11 items-center gap-2 border-2 border-black bg-accent-green px-4 text-sm font-black text-black transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-cream active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ boxShadow: '4px 4px 0 rgba(0,0,0,0.85)' }}
                    >
                      {isSavingScores ? <RotateCcw className={`h-4 w-4 ${spinClass}`} /> : <BadgeCheck className="h-4 w-4" />}
                      Save checks
                    </button>
                  </div>
                </section>

                <LogPanel
                  title="Reading log"
                  icon={BookOpen}
                  accent="text-amber-300"
                  isAdding={isAddingReading}
                  onAdd={() => setIsAddingReading(true)}
                >
                  <AnimatePresence initial={false}>
                    {isAddingReading && (
                      <motion.div
                        initial={motionPanel.initial}
                        animate={motionPanel.animate}
                        exit={motionPanel.exit}
                        transition={motionPanel.transition}
                        className="mb-4 overflow-hidden border border-amber-400/20 bg-amber-400/5 p-4"
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <TextInput value={readingTitle} onChange={setReadingTitle} placeholder="Book title or article" className="sm:col-span-2" />
                          <NumberInput value={readingPages} onChange={setReadingPages} placeholder="Pages" />
                          <NumberInput value={readingMinutes} onChange={setReadingMinutes} placeholder="Minutes" />
                          <TextInput value={readingNotes} onChange={setReadingNotes} placeholder="Notes" className="sm:col-span-2" />
                        </div>
                        <FormActions
                          saving={savingReading}
                          onCancel={() => setIsAddingReading(false)}
                          onSave={() => void handleSaveReading()}
                          saveLabel="Save reading"
                          accentClass="bg-amber-400"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    {(selectedReview?.reading ?? []).slice(0, 6).map(entry => (
                      <div key={entry.id} className="border border-white/10 bg-white/[0.025] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white/75">{entry.title || 'Untitled'}</div>
                            <div className="mt-1 text-xs text-white/40">{entry.pages} pages / {entry.minutes} min</div>
                          </div>
                          <span className="shrink-0 text-xs text-white/35">{formatShortDate(entry.date)}</span>
                        </div>
                        {entry.notes && <p className="mt-2 text-sm text-white/55">{entry.notes}</p>}
                      </div>
                    ))}
                    {(selectedReview?.reading.length ?? 0) === 0 && !loading && !isAddingReading && (
                      <EmptyState icon={BookOpen} message="No reading was logged on this day." actionText="Log reading" onAction={() => setIsAddingReading(true)} />
                    )}
                  </div>
                </LogPanel>

                <LogPanel
                  title="Exercise log"
                  icon={Dumbbell}
                  accent="text-accent-green"
                  isAdding={isAddingExercise}
                  onAdd={() => setIsAddingExercise(true)}
                >
                  <AnimatePresence initial={false}>
                    {isAddingExercise && (
                      <motion.div
                        initial={motionPanel.initial}
                        animate={motionPanel.animate}
                        exit={motionPanel.exit}
                        transition={motionPanel.transition}
                        className="mb-4 overflow-hidden border border-accent-green/20 bg-accent-green/5 p-4"
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <TextInput value={exerciseType} onChange={setExerciseType} placeholder="Exercise type" className="sm:col-span-2" />
                          <NumberInput value={exerciseDuration} onChange={setExerciseDuration} placeholder="Minutes" />
                          <TextInput value={exerciseIntensity} onChange={setExerciseIntensity} placeholder="Intensity" />
                          <TextInput value={exerciseNotes} onChange={setExerciseNotes} placeholder="Notes" className="sm:col-span-2" />
                        </div>
                        <FormActions
                          saving={savingExercise}
                          onCancel={() => setIsAddingExercise(false)}
                          onSave={() => void handleSaveExercise()}
                          saveLabel="Save exercise"
                          accentClass="bg-accent-green"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    {(selectedReview?.exercise ?? []).slice(0, 6).map(entry => (
                      <div key={entry.id} className="border border-white/10 bg-white/[0.025] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white/75">{entry.type || 'Exercise'}</div>
                            <div className="mt-1 text-xs text-white/40">{entry.durationMinutes} min{entry.intensity ? ` / ${entry.intensity}` : ''}</div>
                          </div>
                          <span className="shrink-0 text-xs text-white/35">{formatShortDate(entry.date)}</span>
                        </div>
                        {entry.notes && <p className="mt-2 text-sm text-white/55">{entry.notes}</p>}
                      </div>
                    ))}
                    {(selectedReview?.exercise.length ?? 0) === 0 && !loading && !isAddingExercise && (
                      <EmptyState icon={Dumbbell} message="No exercise was logged on this day." actionText="Log exercise" onAction={() => setIsAddingExercise(true)} />
                    )}
                  </div>
                </LogPanel>
              </div>
            </div>
          </div>
        </details>

        <section className="mt-10" aria-labelledby="habit-catalog-heading" id="habit-catalog-section">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              icon={Settings2}
              title="Habit catalog"
              subtitle="Icons, colors, and personal tracking targets for this account"
              id="habit-catalog-heading"
            />
            <button
              type="button"
              onClick={() => setHabitManagerOpen((open) => !open)}
              className="inline-flex min-h-11 items-center gap-2 border-2 border-white/15 bg-white/[0.03] px-4 text-xs font-black uppercase tracking-[0.14em] text-white/70 transition hover:border-white/35 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green"
            >
              {habitManagerOpen ? 'Hide manager' : 'Manage habits'}
            </button>
          </div>

          {habitManagerOpen && (
            <article className="mt-4 border-2 border-white/15 bg-white/[0.03] p-4 sm:p-6">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3">
                  {habits.map((habit) => {
                    const meta = getHabitMeta(habit);
                    const Icon = meta.icon;
                    return (
                      <div key={habit.key} className={`flex flex-wrap items-center justify-between gap-3 border p-3 ${habit.active ? 'border-white/15 bg-black/20' : 'border-white/10 bg-black/10 opacity-70'}`}>
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`grid h-10 w-10 place-items-center ${meta.tint}`}>
                            <Icon className={`h-4 w-4 ${meta.accent}`} strokeWidth={2.5} />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white/85">{habit.label}</div>
                            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                              {habit.key} · {habit.icon} · {habit.color}{habit.system ? ' · system' : ' · custom'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={savingHabit}
                            onClick={() => void handleToggleHabitActive(habit)}
                            className="min-h-10 border border-white/15 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/65 transition hover:bg-white/10 disabled:opacity-50"
                          >
                            {habit.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            disabled={savingHabit}
                            onClick={() => void handleDeleteHabit(habit)}
                            className="grid h-10 w-10 place-items-center border border-white/15 text-white/55 transition hover:bg-accent-red/10 hover:text-red-300 disabled:opacity-50"
                            aria-label={`Remove ${habit.label}`}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-black text-white">Add habit</div>
                  <p className="mt-1 text-xs text-white/45">Create a personal tracking target with its own icon and color.</p>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Label</span>
                    <input
                      value={newHabitLabel}
                      onChange={(event) => setNewHabitLabel(event.target.value)}
                      className="w-full border-2 border-white/10 bg-black/35 px-3 py-3 text-sm text-white outline-none transition focus:border-accent-green/50"
                      placeholder="e.g. No social media"
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Icon</span>
                    <select
                      value={newHabitIcon}
                      onChange={(event) => setNewHabitIcon(event.target.value as HabitIconKey)}
                      className="w-full border-2 border-white/10 bg-black/35 px-3 py-3 text-sm text-white outline-none transition focus:border-accent-green/50"
                    >
                      {HABIT_ICON_KEYS.map((icon) => (
                        <option key={icon} value={icon}>{icon}</option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-3 block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Color</span>
                    <select
                      value={newHabitColor}
                      onChange={(event) => setNewHabitColor(event.target.value as HabitColorKey)}
                      className="w-full border-2 border-white/10 bg-black/35 px-3 py-3 text-sm text-white outline-none transition focus:border-accent-green/50"
                    >
                      {HABIT_COLOR_KEYS.map((color) => (
                        <option key={color} value={color}>{color}</option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-4 flex items-center gap-3">
                    <span className={`grid h-10 w-10 place-items-center ${getHabitVisual(newHabitColor).tint}`}>
                      {(() => {
                        const PreviewIcon = resolveHabitIcon(newHabitIcon);
                        return <PreviewIcon className={`h-4 w-4 ${getHabitVisual(newHabitColor).accent}`} strokeWidth={2.5} />;
                      })()}
                    </span>
                    <button
                      type="button"
                      disabled={savingHabit}
                      onClick={() => void handleCreateHabit()}
                      className="inline-flex min-h-11 items-center gap-2 border-2 border-black bg-accent-green px-4 text-sm font-black text-black transition hover:-translate-y-0.5 disabled:opacity-50"
                      style={{ boxShadow: '4px 4px 0 rgba(0,0,0,0.85)' }}
                    >
                      <Plus className="h-4 w-4" strokeWidth={3} />
                      Add habit
                    </button>
                  </div>
                </div>
              </div>
            </article>
          )}
        </section>

      </main>
    </div>
  );
}

export function AccountMenu({
  user,
  onOpenDiscipline,
  onOpenSettings,
  onOpenInsights,
  onLogout,
  compactOnMobile = false,
}: {
  user: CentralAuthUser | null;
  onOpenDiscipline?: () => void;
  onOpenSettings: () => void;
  onOpenInsights: () => void;
  onLogout: () => void;
  compactOnMobile?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = user?.name || user?.email?.split('@')[0] || 'Account';

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const menuItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems();
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(currentIndex + 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const runAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={event => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          setIsOpen(true);
          window.setTimeout(() => menuItems()[0]?.focus(), 0);
        }}
        className={`flex min-h-11 items-center gap-2 border-2 text-left transition ${
          compactOnMobile
            ? 'w-11 max-w-11 justify-center px-2 min-[480px]:w-auto min-[480px]:max-w-[12.5rem] min-[480px]:justify-start min-[480px]:px-3 md:max-w-[16rem]'
            : 'max-w-[12.5rem] px-2.5 sm:max-w-[16rem] sm:px-3'
        } ${
          isOpen
            ? 'border-accent-green/60 bg-accent-green/10 text-white'
            : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/30 hover:bg-white/[0.07] hover:text-white'
        } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green active:translate-y-px`}
        aria-label={`Open account menu for ${name}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="discipline-account-menu"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-white/20 bg-black/40">
          {user?.avatarUrl && user.avatarUrl !== failedAvatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setFailedAvatarUrl(user.avatarUrl ?? null)} />
          ) : (
            <UserCircle className="h-4 w-4" strokeWidth={2.5} />
          )}
        </span>
        <span className={`min-w-0 flex-1 ${compactOnMobile ? 'hidden min-[480px]:block' : ''}`}>
          <span className="block truncate text-xs font-black text-white">{name}</span>
          <span className="hidden truncate text-[9px] font-bold uppercase tracking-[0.12em] text-white/35 sm:block">Account</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${compactOnMobile ? 'hidden min-[480px]:block' : ''} ${isOpen ? 'rotate-180' : ''}`} strokeWidth={3} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="discipline-account-menu"
            ref={menuRef}
            role="menu"
            aria-label="Profile and navigation"
            onKeyDown={handleMenuKeyDown}
            className="absolute right-0 top-[calc(100%+0.65rem)] z-[80] w-[min(18rem,calc(100vw-2rem))] border-2 border-white/20 bg-[#0b0b0b] p-2 shadow-[8px_8px_0_rgba(0,0,0,0.85)]"
            initial={prefersReducedMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
          >
            <div className="border-b border-white/10 px-3 py-3">
              <div className="truncate text-sm font-black text-white">{name}</div>
              <div className="mt-1 truncate text-xs text-white/40">{user?.email || 'Signed in'}</div>
            </div>

            <div className="py-2">
              {onOpenDiscipline && (
                <AccountMenuItem icon={Activity} label="Discipline dashboard" onClick={() => runAction(onOpenDiscipline)} />
              )}
              <AccountMenuItem icon={Settings2} label="Settings" onClick={() => runAction(onOpenSettings)} />
              <AccountMenuItem icon={BarChart3} label="Insights" onClick={() => runAction(onOpenInsights)} />
            </div>

            <div className="border-t border-white/10 pt-2">
              <AccountMenuItem icon={LogOut} label="Sign out" onClick={() => runAction(onLogout)} danger />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AccountMenuItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-3 px-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset active:translate-y-px ${
        danger
          ? 'text-red-300 hover:bg-accent-red/10 hover:text-red-200 focus-visible:outline-accent-red'
          : 'text-white/65 hover:bg-white/[0.07] hover:text-white focus-visible:outline-accent-green'
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={2.5} />
      {label}
    </button>
  );
}

function getReadinessPresentation(
  level: RecoveryRiskLevel,
  risk: { deepWorkAverage: number; recoveryAverage: number; flags: string[] },
) {
  if (level === 'high') {
    return {
      stateLabel: 'Overloaded',
      summary: 'Deep work is running ahead of recovery signals in this window.',
      cardClass: 'border-accent-red/45 bg-accent-red/[0.07]',
      labelClass: 'text-accent-red',
    };
  }
  if (level === 'moderate') {
    return {
      stateLabel: 'Strained',
      summary: 'Output is present, but recovery capacity looks thinner than usual.',
      cardClass: 'border-amber-300/40 bg-amber-300/[0.06]',
      labelClass: 'text-amber-300',
    };
  }
  return {
    stateLabel: 'Balanced',
    summary:
      risk.flags.length > 0
        ? 'Workload and recovery are not fully aligned, but no overload pattern is active yet.'
        : 'Deep work and recovery sit in a relatively even range right now.',
    cardClass: 'border-accent-green/40 bg-accent-green/[0.06]',
    labelClass: 'text-accent-green',
  };
}

function neutralizeGuidance(text: string) {
  if (!text) return '';
  let next = text.trim();
  const replacements: Array<[RegExp, string]> = [
    [/^Protect recovery before increasing workload\.?$/i, 'Recovery signals are lagging behind deep-work load.'],
    [/^Repeat the basics and keep tomorrow easy to start\.?$/i, 'Recent rhythm favors simple continuity over intensity spikes.'],
    [/^Aim for a simple full-day show-up before chasing intensity\.?$/i, 'The recent window shows uneven day-to-day presence.'],
    [/^Let the next completed-day review establish the baseline\.?$/i, 'Baseline patterns will appear after the next completed-day scores.'],
    [/^Give (.+) a small non-zero win tomorrow\.?$/i, '$1 currently sits at a zero average in this window.'],
    [/^Tighten (.+) while keeping the current rhythm\.?$/i, '$1 is the softest habit while overall rhythm is still present.'],
    [/^Deep work is outrunning recovery\. Reinforce (.+) before adding workload\.?$/i, 'Deep work is outrunning recovery. Soft spots: $1.'],
    [/^Output is solid, but (.+) need more protection\.?$/i, 'Output is solid, while $1 remain softer.'],
    [/^Recovery is soft in (.+), but workload is not pressuring it yet\.?$/i, 'Recovery is soft in $1, without clear workload pressure yet.'],
  ];
  for (const [pattern, value] of replacements) {
    if (pattern.test(next)) {
      next = next.replace(pattern, value);
      break;
    }
  }
  next = next
    .replace(/\bProtect\b/gi, 'Note')
    .replace(/\bAim for\b/gi, 'Shows')
    .replace(/\bTighten\b/gi, 'Soft spot in')
    .replace(/\bGive\b/gi, 'Shows')
    .replace(/\btomorrow\b/gi, 'next window')
    .replace(/\bbefore increasing workload\b/gi, 'relative to deep-work load')
    .replace(/\bbefore adding workload\b/gi, 'relative to deep-work load')
    .replace(/\bneed more protection\b/gi, 'are softer')
    .replace(/\bReinforce\b/gi, 'Soft spots:');
  return next.replace(/\s+/g, ' ').trim();
}

function formatRiskFlag(flag: string) {
  switch (flag) {
    case 'low_sleep':
      return 'Soft sleep';
    case 'low_exercise':
      return 'Soft exercise';
    case 'low_nutrition':
      return 'Soft nutrition';
    case 'high_deep_work':
      return 'High deep work';
    default:
      return flag.replace(/_/g, ' ');
  }
}

function HabitMomentumCard({
  habit,
  definition,
}: {
  habit: HabitTrendSummary;
  definition?: DisciplineHabitDefinition;
}) {
  const meta = getHabitMeta(definition ?? habit.key);
  const directionLabel = habit.direction === 'up' ? 'Rising' : habit.direction === 'down' ? 'Softening' : 'Stable';
  const directionTone =
    habit.direction === 'up' ? 'text-accent-green' : habit.direction === 'down' ? 'text-amber-300' : 'text-white/55';
  const rate = Math.round(habit.average * 100);
  const deltaPts = Math.round(habit.delta * 100);
  const deltaLabel = deltaPts === 0 ? '0 pts' : deltaPts > 0 ? `+${deltaPts} pts` : `${deltaPts} pts`;

  const Icon = meta.icon;
  return (
    <article className="border border-white/10 bg-white/[0.025] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`grid h-7 w-7 place-items-center ${meta.tint}`}>
              <Icon className={`h-3.5 w-3.5 ${meta.accent}`} strokeWidth={2.5} />
            </span>
            <div className="text-sm font-black text-white">{habit.label}</div>
          </div>
          <div className={`mt-1 text-[10px] font-black uppercase tracking-[0.16em] ${directionTone}`}>{directionLabel}</div>
        </div>
        <div className="text-right">
          <div className={`font-grotesk text-xl font-black ${meta.accent}`}>{rate}%</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">{deltaLabel} vs earlier</div>
        </div>
      </div>
      <div className="mt-4 flex h-8 items-end gap-1" aria-hidden="true">
        {habit.sparkline.map((value, index) => (
          <span
            key={`${habit.key}-${index}`}
            className={`min-w-0 flex-1 ${value > 0 ? meta.fill : 'bg-white/10'}`}
            style={{ height: value > 0 ? '100%' : '30%' }}
          />
        ))}
      </div>
      <div className="mt-3 text-xs text-white/45">
        {habit.activeDays} done day{habit.activeDays === 1 ? '' : 's'} · recent {Math.round(habit.recentAverage * 100)}% / baseline {Math.round(habit.baselineAverage * 100)}%
      </div>
    </article>
  );
}

function HabitCompletionMatrix({
  view,
  habits,
  habitTrends,
  trend,
  selectedDate,
  onSelectDate,
  loading,
}: {
  view: HabitMatrixView;
  habits: readonly DisciplineHabitDefinition[];
  habitTrends: readonly HabitTrendSummary[];
  trend: DisciplineTrendPoint[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  loading: boolean;
}) {
  const maxHabits = Math.max(1, habits.length);
  const trendByKey = useMemo(() => new Map(habitTrends.map((item) => [item.key, item])), [habitTrends]);

  if (loading) {
    return (
      <div className="space-y-2" aria-label="Loading habit matrix">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="h-8 animate-pulse bg-white/10" />
        ))}
      </div>
    );
  }

  if (trend.length === 0) {
    return (
      <div className="border border-dashed border-white/15 bg-black/20 p-4 text-sm text-white/45">
        No days in this window yet.
      </div>
    );
  }

  if (view === 'rank') {
    const ranked = habits
      .map((habit) => {
        const summary = trendByKey.get(habit.key);
        const activeDays = summary?.activeDays ?? trend.reduce((sum, day) => sum + toBinaryHabitScore(day.scores?.[habit.key]), 0);
        const average = summary?.average ?? (trend.length ? activeDays / trend.length : 0);
        return { habit, activeDays, average };
      })
      .sort((a, b) => b.average - a.average || b.activeDays - a.activeDays || a.habit.sortOrder - b.habit.sortOrder);

    return (
      <div className="space-y-2" role="list" aria-label="Habit rank list">
        {ranked.map((item, index) => {
          const meta = getHabitMeta(item.habit);
          const Icon = meta.icon;
          const rate = Math.round(item.average * 100);
          return (
            <div key={item.habit.key} role="listitem" className="flex items-center gap-3 border border-white/10 bg-black/20 p-3">
              <span className="w-8 font-mono text-xs font-black text-white/35">#{index + 1}</span>
              <span className={`grid h-9 w-9 place-items-center ${meta.tint}`}>
                <Icon className={`h-4 w-4 ${meta.accent}`} strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-white/80">{item.habit.label}</span>
                  <span className={`text-sm font-black ${meta.accent}`}>{rate}%</span>
                </div>
                <div className={`mt-2 h-1.5 overflow-hidden ${meta.track}`}>
                  <div className={`h-full ${meta.fill}`} style={{ width: `${rate}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-white/40">{item.activeDays}/{trend.length} days done</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (view === 'lanes') {
    return (
      <div className="space-y-3" aria-label="Habit lanes">
        {habits.map((habit) => {
          const meta = getHabitMeta(habit);
          const Icon = meta.icon;
          const summary = trendByKey.get(habit.key);
          return (
            <div key={habit.key} className="border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`grid h-8 w-8 place-items-center ${meta.tint}`}>
                    <Icon className={`h-3.5 w-3.5 ${meta.accent}`} strokeWidth={2.5} />
                  </span>
                  <span className="truncate text-sm font-semibold text-white/80">{habit.label}</span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">
                  {summary ? `${summary.activeDays}/${trend.length}` : `${trend.length} days`}
                </span>
              </div>
              <div className="flex gap-1 overflow-x-auto">
                {trend.map((day) => {
                  const done = toBinaryHabitScore(day.scores?.[habit.key]) === 1;
                  const selected = day.date === selectedDate;
                  return (
                    <button
                      key={`${habit.key}-${day.date}`}
                      type="button"
                      onClick={() => onSelectDate(day.date)}
                      className={`grid h-10 min-w-10 flex-1 place-items-center border text-[11px] font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-cream sm:h-8 sm:min-w-8 ${
                        done ? `${meta.fill} text-black` : 'border-white/20 bg-transparent text-white/45'
                      } ${selected ? 'ring-2 ring-paper-cream/70' : ''}`}
                      title={`${habit.label} · ${formatShortDate(day.date)} · ${done ? 'done' : 'not done'}`}
                      aria-label={`${habit.label} on ${formatLongDate(day.date)}: ${done ? 'done' : 'not done'}`}
                      aria-pressed={selected}
                    >
                      <span aria-hidden="true">{done ? '✓' : '·'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (view === 'weeks') {
    const weeks = chunkTrendByWeeks(trend);
    const weekCount = Math.max(weeks.length, 1);
    return (
      <div className="space-y-3" aria-label="Habit week blocks">
        <div
          className={`grid gap-3 ${
            weekCount <= 1
              ? 'grid-cols-1'
              : weekCount === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : weekCount === 3
                  ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
          }`}
        >
          {weeks.map((week, weekIndex) => {
            const start = week[0]?.date;
            const end = week[week.length - 1]?.date;
            const weekDone = week.reduce((sum, day) => {
              const scores = normalizeScores(day.scores, habits);
              return sum + habits.reduce((habitSum, habit) => habitSum + scores[habit.key], 0);
            }, 0);
            const weekPossible = week.length * maxHabits;
            const weekRate = weekPossible > 0 ? Math.round((weekDone / weekPossible) * 100) : 0;

            return (
              <div key={`week-${weekIndex}-${start}`} className="min-w-0 border border-white/10 bg-black/20 p-3">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/60">Week {weekIndex + 1}</div>
                    <div className="mt-1 truncate font-mono text-[10px] text-white/55">
                      {start ? formatShortDate(start) : '—'}
                      {end && end !== start ? ` - ${formatShortDate(end)}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-black text-white">{weekRate}%</div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">{weekDone}/{weekPossible}</div>
                  </div>
                </div>

                <div className="mb-2 h-1.5 overflow-hidden bg-white/10" aria-hidden="true">
                  <div className="h-full bg-accent-green" style={{ width: `${weekRate}%` }} />
                </div>

                <div className="space-y-1.5">
                  {week.map((day) => {
                    const scores = normalizeScores(day.scores, habits);
                    const doneCount = habits.reduce((sum, habit) => sum + scores[habit.key], 0);
                    const selected = day.date === selectedDate;
                    const dayRate = maxHabits > 0 ? Math.round((doneCount / maxHabits) * 100) : 0;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => onSelectDate(day.date)}
                        className={`grid w-full grid-cols-[2.75rem_minmax(0,1fr)_2rem] items-center gap-1.5 border px-1.5 py-2 text-left transition hover:border-white/40 hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-cream sm:grid-cols-[3.25rem_minmax(0,1fr)_2.25rem] sm:gap-2 sm:px-2 ${
                          selected ? 'border-paper-cream bg-white/[0.05] ring-1 ring-paper-cream/40' : 'border-white/10'
                        }`}
                        aria-label={`${formatLongDate(day.date)}, ${doneCount} of ${maxHabits} habits done`}
                        aria-pressed={selected}
                      >
                        <span className="font-mono text-[10px] font-bold text-white/65">{formatShortDate(day.date)}</span>
                        <span className="min-w-0">
                          <span
                            className="grid gap-1"
                            style={{ gridTemplateColumns: `repeat(${Math.max(maxHabits, 1)}, minmax(0, 1fr))` }}
                          >
                            {habits.map((habit) => {
                              const done = scores[habit.key] === 1;
                              const meta = getHabitMeta(habit);
                              return (
                                <span
                                  key={`${day.date}-${habit.key}`}
                                  className={`inline-grid h-8 w-full min-h-8 place-items-center border text-[11px] font-black sm:h-7 ${
                                    done ? `${meta.fill} text-black` : 'border-white/20 bg-transparent text-white/45'
                                  }`}
                                  title={`${habit.label}: ${done ? 'done' : 'not done'}`}
                                  aria-label={`${habit.label}: ${done ? 'done' : 'not done'}`}
                                >
                                  <span aria-hidden="true">{done ? '✓' : '·'}</span>
                                </span>
                              );
                            })}
                          </span>
                          <span className="mt-1 block h-1 overflow-hidden bg-white/10" aria-hidden="true">
                            <span className="block h-full bg-white/45" style={{ width: `${dayRate}%` }} />
                          </span>
                        </span>
                        <span className="text-right text-[10px] font-black text-white/60">{doneCount}/{maxHabits}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Default: day grid (day rows x habit columns)
  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-1 touch-pan-x">
      <div style={{ minWidth: `${Math.max(18, 4.5 + maxHabits * 3.75)}rem` }}>
        <div
          className="mb-2 grid gap-1 text-[9px] font-black uppercase tracking-[0.1em] text-white/60"
          style={{ gridTemplateColumns: `4.25rem repeat(${maxHabits}, minmax(2.75rem, 1fr))` }}
        >
          <span className="sticky left-0 z-[1] bg-bg-dark/95 pr-1">Day</span>
          {habits.map((habit) => {
            const meta = getHabitMeta(habit);
            const Icon = meta.icon;
            return (
              <span key={habit.key} className="flex items-center justify-center gap-1 truncate" title={habit.label}>
                <Icon className={`h-3 w-3 ${meta.accent}`} strokeWidth={2.5} />
                <span className="truncate">{habit.label}</span>
              </span>
            );
          })}
        </div>
        <div className="space-y-1">
          {trend.map((day) => {
            const selected = day.date === selectedDate;
            const scores = normalizeScores(day.scores, habits);
            const doneCount = habits.reduce((sum, habit) => sum + scores[habit.key], 0);
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelectDate(day.date)}
                className={`grid w-full items-center gap-1 border px-1.5 py-1.5 text-left transition hover:border-white/40 hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-cream ${
                  selected ? 'border-paper-cream bg-white/[0.05] ring-1 ring-paper-cream/40' : 'border-transparent'
                }`}
                style={{ gridTemplateColumns: `4.25rem repeat(${maxHabits}, minmax(2.75rem, 1fr))` }}
                aria-label={`${formatLongDate(day.date)}, ${doneCount} of ${maxHabits} habits done`}
                aria-pressed={selected}
              >
                <span className="sticky left-0 z-[1] bg-bg-dark/95 pr-1 font-mono text-[10px] font-bold text-white/65">{formatShortDate(day.date)}</span>
                {habits.map((habit) => {
                  const done = scores[habit.key] === 1;
                  const meta = getHabitMeta(habit);
                  return (
                    <span
                      key={`${day.date}-${habit.key}`}
                      className={`inline-grid h-9 place-items-center border text-[11px] font-black sm:h-7 ${
                        done ? `${meta.fill} text-black` : 'border-white/20 bg-transparent text-white/45'
                      }`}
                      title={`${habit.label}: ${done ? 'done' : 'not done'}`}
                      aria-label={`${habit.label}: ${done ? 'done' : 'not done'}`}
                    >
                      <span aria-hidden="true">{done ? '✓' : '·'}</span>
                    </span>
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScoreDial({ value, total, maxHabits }: { value: number | null; total: number | null; maxHabits: number }) {
  const progress = value ?? 0;
  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex shrink-0 flex-col items-center sm:pl-4">
      <div className="relative h-32 w-32">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="#34d399"
            strokeWidth="8"
            strokeLinecap="square"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-grotesk text-3xl font-black leading-none text-white">{value === null ? '-' : value}</div>
            <div className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/40">{value === null ? 'Pending' : 'Done %'}</div>
          </div>
        </div>
      </div>
      <div className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Today discipline score</div>
      <div className="mt-1 text-center text-xs text-white/35">{total === null ? 'Not recorded yet' : `${total}/${maxHabits} habits done`}</div>
    </div>
  );
}

function ContributionHeatmap({
  view = 'timeline',
  trend,
  selectedDate,
  onSelectDate,
  loading,
}: {
  view?: FocusMatrixView;
  trend: DisciplineTrendPoint[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  loading: boolean;
}) {
  if (loading) {
    const skeletonRows = Math.max(trend.length, 7);
    return (
      <div className="space-y-1" aria-label="Loading contribution history">
        {Array.from({ length: skeletonRows }, (_, index) => (
          <div key={index} className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
            <span className="h-3 w-12 animate-pulse bg-white/10" />
            <span className="h-3 animate-pulse bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  if (trend.length === 0) {
    return (
      <div className="border border-dashed border-white/15 bg-black/20 p-4 text-sm text-white/45">
        No days in this window yet.
      </div>
    );
  }

  if (view === 'rank') {
    const ranked = [...trend]
      .map((day) => ({
        day,
        minutes: Number(day.activity?.focusMinutes ?? 0),
        sessions: Number(day.activity?.completedSessions ?? 0),
      }))
      .sort((a, b) => b.minutes - a.minutes || b.sessions - a.sessions || b.day.date.localeCompare(a.day.date));
    const maxMinutes = Math.max(1, ...ranked.map((item) => item.minutes));

    return (
      <div className="space-y-2" role="list" aria-label="Focus rank list">
        {ranked.map((item, index) => {
          const selected = item.day.date === selectedDate;
          const width = Math.round((item.minutes / maxMinutes) * 100);
          return (
            <button
              key={item.day.date}
              type="button"
              role="listitem"
              onClick={() => onSelectDate(item.day.date)}
              className={`flex w-full items-center gap-3 border px-3 py-3 text-left transition hover:border-white/40 hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-cream ${
                selected ? 'border-paper-cream bg-white/[0.05] ring-1 ring-paper-cream/40' : 'border-white/10 bg-black/20'
              }`}
              aria-pressed={selected}
            >
              <span className="w-8 font-mono text-xs font-black text-white/35">#{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white/80">{formatShortDate(item.day.date)}</span>
                  <span className="text-sm font-black text-accent-green">{item.minutes} min</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden bg-white/10">
                  <div className="h-full bg-accent-green" style={{ width: `${width}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-white/40">{item.sessions} session{item.sessions === 1 ? '' : 's'}</div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (view === 'days') {
    const maxMinutes = Math.max(1, ...trend.map((day) => Number(day.activity?.focusMinutes ?? 0)));
    return (
      <div className="space-y-2" aria-label="Focus day intensity">
        {trend.map((day) => {
          const minutes = Number(day.activity?.focusMinutes ?? 0);
          const selected = day.date === selectedDate;
          const width = Math.round((minutes / maxMinutes) * 100);
          const tone = minutes >= 100 ? 'bg-accent-green' : minutes >= 50 ? 'bg-accent-green/70' : minutes > 0 ? 'bg-accent-green/40' : 'bg-white/10';
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className={`grid w-full grid-cols-[3.75rem_minmax(0,1fr)_3.25rem] items-center gap-2 border px-2 py-2.5 text-left transition hover:border-white/40 hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-cream sm:grid-cols-[4.5rem_1fr_4rem] ${
                selected ? 'border-paper-cream bg-white/[0.05] ring-1 ring-paper-cream/40' : 'border-transparent'
              }`}
              aria-label={`${formatLongDate(day.date)}, ${minutes} focused minutes`}
              aria-pressed={selected}
            >
              <span className="font-mono text-[10px] font-bold text-white/55">{formatShortDate(day.date)}</span>
              <span className="h-4 overflow-hidden bg-white/[0.06]">
                <span className={`block h-full ${tone}`} style={{ width: `${minutes > 0 ? Math.max(width, 8) : 0}%` }} />
              </span>
              <span className="text-right text-[11px] font-black text-white/55">{minutes}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-2 touch-pan-x">
      <div className="min-w-[min(38rem,100%)] sm:min-w-[38rem]">
        <div className="mb-2 grid grid-cols-[3.75rem_1fr] gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-white/55 sm:grid-cols-[4.5rem_1fr]" aria-hidden="true">
          <span className="sticky left-0 z-[1] bg-bg-dark/95">Day</span>
          <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-px">
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className="text-center">{hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}</span>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          {trend.map((day) => {
            const activity = day.activity;
            const hours = activity?.hourlyMinutes ?? Array.from({ length: 24 }, () => 0);
            const selected = day.date === selectedDate;
            const summary = activity?.focusMinutes
              ? `${activity.focusMinutes} focused min${activity.firstStartedAt ? `, started ${formatTime(activity.firstStartedAt)}` : ''}`
              : day.total > 0
                ? `habits done ${day.total}`
                : 'no recorded focus activity';
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelectDate(day.date)}
                className={`grid w-full grid-cols-[3.75rem_1fr] items-center gap-2 border px-1.5 py-1.5 text-left transition hover:border-white/50 hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-cream sm:grid-cols-[4.5rem_1fr] ${
                  selected ? 'border-paper-cream bg-white/[0.06] ring-1 ring-paper-cream/50' : 'border-transparent'
                }`}
                title={`${formatLongDate(day.date)}: ${summary}`}
                aria-label={`${formatLongDate(day.date)}, ${summary}`}
                aria-pressed={selected}
              >
                <span className="sticky left-0 z-[1] bg-bg-dark/95 font-mono text-[9px] font-bold text-white/65">{formatShortDate(day.date)}</span>
                <span className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-px" aria-hidden="true">
                  {hours.map((minutes, hour) => (
                    <span key={hour} className={`h-3 min-w-0 border border-black/20 ${getTimelineTone(Number(minutes) || 0)}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}



function MatrixViewSwitcher<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string; shortLabel: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        className="inline-flex min-w-full flex-nowrap border-2 border-white/10 bg-black/30 p-1 sm:min-w-0"
        role="group"
        aria-label={label}
      >
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`min-h-11 min-w-0 flex-1 px-2.5 text-[10px] font-black uppercase tracking-[0.12em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green active:translate-y-px sm:min-h-9 sm:min-w-[3.75rem] sm:flex-none ${
                active
                  ? 'border border-white/20 bg-white text-black'
                  : 'border border-transparent text-white/60 hover:bg-white/[0.05] hover:text-white'
              }`}
              aria-pressed={active}
              title={option.label}
            >
              {option.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/60" aria-label="Focus timeline intensity from no focus time to a full focus block">
      <span>None</span>
      <div className="flex gap-1" aria-hidden="true">
        {[0, 5, 12, 20].map(minutes => (
          <span key={minutes} className={`h-3 w-3 border border-white/[0.06] ${getTimelineTone(minutes)}`} />
        ))}
      </div>
      <span>25 min / hour</span>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="grid animate-pulse gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <div className="h-6 w-36 bg-white/10" />
        <div className="mt-5 h-8 w-4/5 bg-white/10" />
        <div className="mt-3 h-4 w-3/5 bg-white/[0.07]" />
        <div className="mt-8 h-2 w-full bg-white/10" />
      </div>
      <div className="h-32 w-32 rounded-full border-8 border-white/10" />
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  id,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center border border-white/15 bg-white/[0.035] text-white/65">
        <Icon className="h-4 w-4" strokeWidth={2.5} />
      </div>
      <div>
        <h2 id={id} className="font-grotesk text-lg font-black text-white">{title}</h2>
        <p className="text-sm text-white/45">{subtitle}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="min-w-0 border border-white/10 bg-white/[0.025] p-3 sm:p-4">
      <div className="flex min-h-7 items-start gap-2 text-white/45">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
        <span className="break-words text-[9px] font-black uppercase leading-tight tracking-[0.14em] sm:text-[10px]">{label}</span>
      </div>
      <div className="mt-3 break-words font-grotesk text-xl font-black leading-tight text-white sm:text-2xl">{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-white/40 sm:text-xs">{detail}</div>
    </article>
  );
}

function SignalRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-semibold text-white/40">{label}</span>
      <span className={`text-right text-xs font-black ${tone}`}>{value}</span>
    </div>
  );
}

function ScoreRow({
  habit,
  value,
  onChange,
}: {
  habit: DisciplineHabitDefinition;
  value: number;
  onChange: (value: number) => void;
}) {
  const meta = getHabitMeta(habit);
  const Icon = meta.icon;
  const done = toBinaryHabitScore(value) === 1;

  return (
    <button
      type="button"
      onClick={() => onChange(done ? 0 : 1)}
      className={`flex w-full items-center gap-3 border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green ${
        done ? 'border-white/25 bg-white/[0.05]' : 'border-white/10 bg-black/20 hover:bg-white/[0.03]'
      }`}
      aria-pressed={done}
      aria-label={`${habit.label} ${done ? 'done' : 'not done'}`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center ${meta.tint}`}>
        <Icon className={`h-4 w-4 ${meta.accent}`} strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-semibold text-white/80">{habit.label}</span>
          <span className={`text-[11px] font-black uppercase tracking-[0.14em] ${done ? meta.accent : 'text-white/35'}`}>
            {done ? 'Done' : 'Not done'}
          </span>
        </span>
        <span className={`mt-2 block h-1.5 ${done ? meta.fill : 'bg-white/10'}`} />
      </span>
    </button>
  );
}

function LogPanel({
  title,
  icon: Icon,
  accent,
  isAdding,
  onAdd,
  children,
}: {
  title: string;
  icon: LucideIcon;
  accent: string;
  isAdding: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-white/10 bg-black/20 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${accent}`} strokeWidth={2.5} />
          <h3 className="text-sm font-black text-white">{title}</h3>
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={onAdd}
            className={`inline-flex min-h-10 items-center gap-1.5 px-2 text-xs font-black transition hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green active:translate-y-px ${accent}`}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} />
            Add
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className={`min-h-11 border-2 border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/35 ${className}`}
    />
  );
}

function NumberInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <input
      type="number"
      min="0"
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-h-11 border-2 border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/35"
    />
  );
}

function FormActions({
  saving,
  onCancel,
  onSave,
  saveLabel,
  accentClass,
}: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
  accentClass: string;
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="min-h-10 px-3 text-xs font-black text-white/45 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white active:translate-y-px">
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className={`inline-flex min-h-10 items-center gap-2 px-4 text-xs font-black text-black transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-cream active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${accentClass}`}
      >
        {saving && <RotateCcw className="h-3.5 w-3.5 animate-spin" />}
        {saveLabel}
      </button>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
  onAction,
  actionText,
}: {
  icon: LucideIcon;
  message: string;
  onAction?: () => void;
  actionText?: string;
}) {
  const content = (
    <>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-white/20">
        <Icon className="h-4 w-4" />
      </span>
      <span className="mt-3 text-sm font-semibold text-white/40">{message}</span>
      {actionText && <span className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-accent-green">{actionText}</span>}
    </>
  );

  if (onAction) {
    return (
      <button
        type="button"
        onClick={onAction}
        className="flex w-full flex-col items-center justify-center border border-dashed border-white/10 bg-black/20 px-5 py-8 text-center transition hover:border-white/25 hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent-green active:translate-y-px"
      >
        {content}
      </button>
    );
  }

  return <div className="flex flex-col items-center justify-center border border-dashed border-white/10 bg-black/20 px-5 py-8 text-center">{content}</div>;
}



import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Apple,
  BadgeCheck,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  TrendingUp,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CustomCursor } from './CustomCursor';
import {
  DISCIPLINE_SCORE_BLOCKS,
  type DisciplineReviewPayload,
  type DisciplineScoreKey,
  type DisciplineTrendPoint,
  addDisciplineExercise,
  addDisciplineReading,
  fetchDisciplineReview,
  fetchDisciplineTrend,
  saveDisciplineScores,
} from '../lib/disciplineApi';
import {
  buildHabitTrendSummaries,
  buildHermesInsightPanel,
  buildSevenDayMomentumSummary,
  buildThirtyDayHeatmapCells,
  getLatestCompletedDateKey,
} from '../lib/disciplineDashboardModel';

const SCORE_MAX = 10;
const DAY_SCORE_MAX = DISCIPLINE_SCORE_BLOCKS.length * SCORE_MAX;
const MOMENTUM_DAYS = 7;
const HEATMAP_DAYS = 30;

type ScoreDraft = Record<DisciplineScoreKey, number>;

type MomentumSummaryLike = {
  consistencyRate?: number;
  shownUpDays?: number;
  availableDays?: number;
  averageScore?: number;
  bestHabit?: HabitStatLike | string | null;
  weakestHabit?: HabitStatLike | string | null;
  recoveryRisk?: boolean | string | { isAtRisk?: boolean; guidance?: string; level?: string } | null;
  days?: MomentumDayLike[];
};

type MomentumDayLike = {
  date?: string;
  total?: number;
  touchedHabitKeys?: string[];
  touchedHabits?: string[];
  habitKeys?: string[];
  scores?: Record<string, number> | null;
};

type HeatmapCellLike = {
  date?: string;
  total?: number;
  intensity?: number;
  topHabit?: string | null;
  topHabitLabel?: string | null;
  label?: string;
};

type HabitTrendLike = {
  key?: string;
  label?: string;
  average?: number;
  delta?: number;
  direction?: string;
  values?: Array<number | null>;
  series?: Array<number | null>;
  points?: Array<number | null>;
  sparkline?: Array<number | null>;
};

type HabitStatLike = {
  key?: string;
  label?: string;
  average?: number;
};

const SCORE_META: Record<
  DisciplineScoreKey,
  {
    icon: LucideIcon;
    accent: string;
    track: string;
    fill: string;
    tint: string;
    stroke: string;
  }
> = {
  deep_work: {
    icon: BarChart3,
    accent: 'text-accent-red',
    track: 'bg-accent-red/15',
    fill: 'bg-accent-red',
    tint: 'bg-accent-red/10',
    stroke: '#f87171',
  },
  reading: {
    icon: BookOpen,
    accent: 'text-amber-300',
    track: 'bg-amber-400/15',
    fill: 'bg-amber-400',
    tint: 'bg-amber-400/10',
    stroke: '#fbbf24',
  },
  exercise: {
    icon: Dumbbell,
    accent: 'text-accent-green',
    track: 'bg-accent-green/15',
    fill: 'bg-accent-green',
    tint: 'bg-accent-green/10',
    stroke: '#34d399',
  },
  sleep: {
    icon: Moon,
    accent: 'text-sky-300',
    track: 'bg-sky-400/15',
    fill: 'bg-sky-400',
    tint: 'bg-sky-400/10',
    stroke: '#38bdf8',
  },
  nutrition: {
    icon: Apple,
    accent: 'text-lime-300',
    track: 'bg-lime-400/15',
    fill: 'bg-lime-400',
    tint: 'bg-lime-400/10',
    stroke: '#a3e635',
  },
  discipline: {
    icon: BadgeCheck,
    accent: 'text-white',
    track: 'bg-white/10',
    fill: 'bg-white',
    tint: 'bg-white/10',
    stroke: '#f8fafc',
  },
};

const EVENT_ICON: Record<DisciplineReviewPayload['events'][number]['type'], LucideIcon> = {
  pomodoro_started: Play,
  pomodoro_paused: Pause,
  pomodoro_resumed: RefreshCcw,
  pomodoro_cancelled: X,
  pomodoro_completed: Clock3,
};

const EVENT_STYLES: Record<DisciplineReviewPayload['events'][number]['type'], string> = {
  pomodoro_started: 'border-accent-green/20 bg-accent-green/5 text-accent-green',
  pomodoro_paused: 'border-amber-400/20 bg-amber-400/5 text-amber-400',
  pomodoro_resumed: 'border-sky-400/20 bg-sky-400/5 text-sky-400',
  pomodoro_cancelled: 'border-white/10 bg-white/5 text-white/60',
  pomodoro_completed: 'border-accent-red/20 bg-accent-red/5 text-accent-red',
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftDateKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

const formatLongDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

const formatShortDay = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
  });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const latestCompletedDateKey = (referenceDate?: Date) => getLatestCompletedDateKey({ referenceDate });

const createEmptyScores = (): ScoreDraft =>
  Object.fromEntries(DISCIPLINE_SCORE_BLOCKS.map(block => [block.key, 0])) as ScoreDraft;

const normalizeScores = (scores?: Record<string, number> | null): ScoreDraft => {
  const next = createEmptyScores();
  for (const block of DISCIPLINE_SCORE_BLOCKS) {
    const value = Number(scores?.[block.key] ?? 0);
    next[block.key] = Number.isFinite(value) ? Math.min(SCORE_MAX, Math.max(0, value)) : 0;
  }
  return next;
};

const clampDateKey = (dateKey: string, maxDateKey: string) => (dateKey > maxDateKey ? maxDateKey : dateKey);

const safeModel = <T,>(factory: () => T, fallback: T) => {
  try {
    return factory();
  } catch {
    return fallback;
  }
};

const coerceNumber = (value: unknown) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const coerceSeries = (trend: HabitTrendLike | undefined) => {
  const values = trend?.values ?? trend?.series ?? trend?.points ?? trend?.sparkline;
  if (!Array.isArray(values)) return null;
  return values.map(value => {
    const next = coerceNumber(value);
    return next === null ? 0 : Math.min(SCORE_MAX, Math.max(0, next));
  });
};

const keyFromLabel = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return DISCIPLINE_SCORE_BLOCKS.find(block => block.key === normalized)?.key ?? null;
};

const resolveHabitLabel = (value: HabitStatLike | string | null | undefined) => {
  if (!value) return 'None';
  if (typeof value === 'string') {
    const key = keyFromLabel(value);
    return DISCIPLINE_SCORE_BLOCKS.find(block => block.key === key)?.label ?? value;
  }
  if (value.label) return value.label;
  if (value.key) {
    return DISCIPLINE_SCORE_BLOCKS.find(block => block.key === value.key)?.label ?? value.key;
  }
  return 'None';
};

const resolveHabitAverage = (value: HabitStatLike | string | null | undefined) => {
  if (!value || typeof value === 'string') return null;
  const average = coerceNumber(value.average);
  return average === null ? null : average;
};

const getTouchedHabitKeys = (scores?: Record<string, number> | null) =>
  DISCIPLINE_SCORE_BLOCKS.filter(block => Number(scores?.[block.key] ?? 0) > 0).map(block => block.key);

const getTopHabitKey = (scores?: Record<string, number> | null) => {
  let bestKey: DisciplineScoreKey | null = null;
  let bestValue = -1;
  for (const block of DISCIPLINE_SCORE_BLOCKS) {
    const value = Number(scores?.[block.key] ?? 0);
    if (value > bestValue) {
      bestValue = value;
      bestKey = block.key;
    }
  }
  return bestValue > 0 ? bestKey : null;
};

const getHeatmapTone = (intensity: number) => {
  if (intensity >= 0.85) return 'bg-accent-green';
  if (intensity >= 0.65) return 'bg-lime-400';
  if (intensity >= 0.45) return 'bg-amber-400';
  if (intensity > 0) return 'bg-white/30';
  return 'bg-white/8';
};

const normalizeDirection = (direction: string | undefined, delta: number) => {
  if (direction === 'up' || direction === 'down' || direction === 'flat') return direction;
  if (delta > 0.35) return 'up';
  if (delta < -0.35) return 'down';
  return 'flat';
};

const getDirectionLabel = (direction: 'up' | 'down' | 'flat') => {
  if (direction === 'up') return 'Rising';
  if (direction === 'down') return 'Falling';
  return 'Flat';
};

const getRecoveryRiskLabel = (value: boolean | string | { isAtRisk?: boolean; guidance?: string; level?: string } | null | undefined) => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    if (value.level === 'high') return 'High';
    if (value.level === 'moderate') return 'Moderate';
    if (value.level === 'low') return 'Stable';
    if (typeof value.isAtRisk === 'boolean') return value.isAtRisk ? 'Watch recovery' : 'Stable';
  }
  return value ? 'Watch recovery' : 'Stable';
};

const getRecoveryRiskDetail = (value: boolean | string | { isAtRisk?: boolean; guidance?: string; level?: string } | null | undefined) => {
  if (value && typeof value === 'object' && typeof value.guidance === 'string' && value.guidance) {
    return value.guidance;
  }
  if (typeof value === 'string') return value;
  return value ? 'Protect sleep, movement, and food before adding load.' : 'Sleep, exercise, nutrition vs workload';
};

interface DisciplineDashboardProps {
  onNavigateHome: () => void;
}

export function DisciplineDashboard({ onNavigateHome }: DisciplineDashboardProps) {
  const [dataThroughDate, setDataThroughDate] = useState(() => latestCompletedDateKey(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => latestCompletedDateKey(new Date()));
  const [review, setReview] = useState<DisciplineReviewPayload | null>(null);
  const [reviewDateLoaded, setReviewDateLoaded] = useState<string | null>(null);
  const [trend, setTrend] = useState<DisciplineTrendPoint[]>([]);
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
  const [statusTone, setStatusTone] = useState<'idle' | 'success' | 'error'>('idle');
  const loadRequestRef = useRef(0);

  const loadData = useCallback(async (reviewDate: string, trendEndDate: string) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    const clampedReviewDate = clampDateKey(reviewDate, trendEndDate);
    setLoading(true);
    setError(null);
    setReview(null);
    setReviewDateLoaded(null);
    setScoreDraft(createEmptyScores());
    setScoreNotes('');

    try {
      const [reviewPayload, trendPayload] = await Promise.all([
        fetchDisciplineReview(clampedReviewDate),
        fetchDisciplineTrend(HEATMAP_DAYS, trendEndDate),
      ]);

      if (loadRequestRef.current !== requestId) return;

      setSelectedDate(clampedReviewDate);
      setReview(reviewPayload);
      setReviewDateLoaded(clampedReviewDate);
      setTrend(trendPayload.trend);
      setScoreDraft(normalizeScores(reviewPayload.score?.scores));
      setScoreNotes(reviewPayload.score?.notes ?? '');
    } catch (fetchError) {
      if (loadRequestRef.current !== requestId) return;
      const message = fetchError instanceof Error ? fetchError.message : 'Unable to load discipline data';
      setError(message);
      setReview(null);
      setReviewDateLoaded(null);
      setTrend([]);
      setScoreDraft(createEmptyScores());
      setScoreNotes('');
    } finally {
      if (loadRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadData(selectedDate, dataThroughDate);
  }, [dataThroughDate, loadData, selectedDate]);

  useEffect(() => {
    setStatusMessage(null);
    setStatusTone('idle');
  }, [dataThroughDate, selectedDate]);

  const selectedReviewLoaded = reviewDateLoaded === selectedDate;
  const selectedReview = selectedReviewLoaded ? review : null;
  const selectedReviewLoading = loading && !selectedReviewLoaded;
  const displayedScoreDraft = useMemo(
    () => (selectedReviewLoaded ? scoreDraft : createEmptyScores()),
    [scoreDraft, selectedReviewLoaded],
  );
  const hasTrendHistory = useMemo(
    () =>
      trend.some(point => {
        if (Number(point.total ?? 0) > 0) return true;
        return DISCIPLINE_SCORE_BLOCKS.some(block => Number(point.scores?.[block.key] ?? 0) > 0);
      }),
    [trend],
  );

  const scoreStats = useMemo(() => {
    const scores = selectedReview?.score?.scores ?? displayedScoreDraft;
    const values = DISCIPLINE_SCORE_BLOCKS.map(block => Number(scores[block.key] ?? 0));
    const total = selectedReview?.score?.total ?? values.reduce((sum, value) => sum + value, 0);
    const average = values.length ? Number((total / values.length).toFixed(2)) : 0;
    const completed = values.filter(value => value > 0).length;
    return { total, average, completed };
  }, [displayedScoreDraft, selectedReview]);

  const summary = useMemo(() => {
    const pomodoros = selectedReview?.pomodoros ?? [];
    const reading = selectedReview?.reading ?? [];
    const exercise = selectedReview?.exercise ?? [];
    const events = selectedReview?.events ?? [];
    const tasks = selectedReview?.tasks ?? [];
    const totalReadingPages = reading.reduce((sum, entry) => sum + Number(entry.pages || 0), 0);
    const totalReadingMinutes = reading.reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
    const totalExerciseMinutes = exercise.reduce((sum, entry) => sum + Number(entry.durationMinutes || 0), 0);
    const totalPomodoroMinutes = pomodoros.reduce((sum, entry) => sum + Number(entry.durationMinutes || 0), 0);
    const completedTasks = tasks.filter(task => task.status === 'done').length;
    const eventCounts = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.type] = (acc[event.type] ?? 0) + 1;
      return acc;
    }, {});

    return {
      readingCount: reading.length,
      exerciseCount: exercise.length,
      pomodoroCount: pomodoros.length,
      eventCount: events.length,
      totalReadingPages,
      totalReadingMinutes,
      totalExerciseMinutes,
      totalPomodoroMinutes,
      completedTasks,
      taskCount: tasks.length,
      eventCounts,
    };
  }, [selectedReview]);

  const fallbackMomentum = useMemo(() => {
    const points = trend.slice(-MOMENTUM_DAYS);
    const days = points.map(point => ({
      date: point.date,
      total: point.total,
      touchedHabitKeys: getTouchedHabitKeys(point.scores),
      scores: point.scores,
    }));

    const availableDays = days.length;
    const shownUpDays = days.filter(day => Number(day.total ?? 0) > 0).length;
    const averages = DISCIPLINE_SCORE_BLOCKS.map(block => {
      const total = points.reduce((sum, point) => sum + Number(point.scores?.[block.key] ?? 0), 0);
      const average = availableDays ? total / availableDays : 0;
      return {
        key: block.key,
        label: block.label,
        average,
      };
    });
    const bestHabit = [...averages].sort((a, b) => b.average - a.average)[0] ?? null;
    const weakestHabit = [...averages].sort((a, b) => a.average - b.average)[0] ?? null;
    const deepWorkAverage = averages.find(item => item.key === 'deep_work')?.average ?? 0;
    const recoveryAverage =
      ((averages.find(item => item.key === 'sleep')?.average ?? 0) +
        (averages.find(item => item.key === 'exercise')?.average ?? 0) +
        (averages.find(item => item.key === 'nutrition')?.average ?? 0)) /
      3;

    return {
      consistencyRate: availableDays ? shownUpDays / availableDays : 0,
      shownUpDays,
      availableDays,
      averageScore: availableDays ? points.reduce((sum, point) => sum + point.total, 0) / availableDays : 0,
      bestHabit,
      weakestHabit,
      recoveryRisk: deepWorkAverage >= 5 && recoveryAverage < 4,
      days,
    };
  }, [trend]);

  const modelMomentum = useMemo(
    () =>
      safeModel(
        () => buildSevenDayMomentumSummary(trend, { days: MOMENTUM_DAYS, endDate: dataThroughDate }) as MomentumSummaryLike,
        fallbackMomentum,
      ),
    [dataThroughDate, fallbackMomentum, trend],
  );

  const momentumDays = useMemo(() => {
    const fallbackByDate = new Map(fallbackMomentum.days.map(day => [day.date, day]));
    const modelDays = Array.isArray(modelMomentum.days) ? modelMomentum.days : [];

    if (!modelDays.length) return fallbackMomentum.days;

    return modelDays
      .map(day => {
        const date = day.date;
        if (!date) return null;
        const fallback = fallbackByDate.get(date);
        return {
          date,
          total: coerceNumber(day.total) ?? fallback?.total ?? 0,
          touchedHabitKeys:
            day.touchedHabitKeys ??
            day.touchedHabits ??
            day.habitKeys ??
            fallback?.touchedHabitKeys ??
            getTouchedHabitKeys(day.scores ?? fallback?.scores),
        };
      })
      .filter((day): day is { date: string; total: number; touchedHabitKeys: string[] } => Boolean(day));
  }, [fallbackMomentum.days, modelMomentum.days]);

  const consistencyRate = coerceNumber(modelMomentum.consistencyRate) ?? fallbackMomentum.consistencyRate;
  const shownUpDays = coerceNumber(modelMomentum.shownUpDays) ?? fallbackMomentum.shownUpDays;
  const availableDays = coerceNumber(modelMomentum.availableDays) ?? fallbackMomentum.availableDays;
  const averageMomentumScore = coerceNumber(modelMomentum.averageScore) ?? fallbackMomentum.averageScore;
  const bestHabit = hasTrendHistory ? modelMomentum.bestHabit ?? fallbackMomentum.bestHabit : null;
  const weakestHabit = hasTrendHistory ? modelMomentum.weakestHabit ?? fallbackMomentum.weakestHabit : null;
  const recoveryRisk = hasTrendHistory ? modelMomentum.recoveryRisk ?? fallbackMomentum.recoveryRisk : 'Awaiting history';

  const fallbackHeatmap = useMemo(
    () =>
      trend.slice(-HEATMAP_DAYS).map(point => {
        const topHabitKey = getTopHabitKey(point.scores);
        return {
          date: point.date,
          total: point.total,
          intensity: Math.max(0, Math.min(1, point.total / DAY_SCORE_MAX)),
          topHabit: topHabitKey
            ? DISCIPLINE_SCORE_BLOCKS.find(block => block.key === topHabitKey)?.label ?? topHabitKey
            : null,
          label: `${point.date}: ${point.total}/${DAY_SCORE_MAX}`,
        };
      }),
    [trend],
  );

  const heatmapCells = useMemo(() => {
    const modelCells = safeModel(
      () => buildThirtyDayHeatmapCells(trend, { days: HEATMAP_DAYS, endDate: dataThroughDate }) as HeatmapCellLike[],
      [],
    );
    const fallbackByDate = new Map(fallbackHeatmap.map(cell => [cell.date, cell]));

    if (!modelCells.length) return fallbackHeatmap;

    return modelCells
      .map(cell => {
        const date = cell.date;
        if (!date) return null;
        const fallback = fallbackByDate.get(date);
        const total = coerceNumber(cell.total) ?? fallback?.total ?? 0;
        const intensity = coerceNumber(cell.intensity) ?? fallback?.intensity ?? Math.max(0, Math.min(1, total / DAY_SCORE_MAX));
        return {
          date,
          total,
          intensity,
          topHabit: cell.topHabit ?? cell.topHabitLabel ?? fallback?.topHabit ?? null,
          label: cell.label ?? fallback?.label ?? `${date}: ${total}/${DAY_SCORE_MAX}`,
        };
      })
      .filter((cell): cell is { date: string; total: number; intensity: number; topHabit: string | null; label: string } => Boolean(cell));
  }, [dataThroughDate, fallbackHeatmap, trend]);

  const fallbackHabitTrends = useMemo(
    () =>
      DISCIPLINE_SCORE_BLOCKS.map(block => {
        const values = trend.slice(-HEATMAP_DAYS).map(point => Math.max(0, Math.min(SCORE_MAX, Number(point.scores?.[block.key] ?? 0))));
        const first = values.find(value => value > 0) ?? values[0] ?? 0;
        const last = values[values.length - 1] ?? 0;
        return {
          key: block.key,
          label: block.label,
          average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
          delta: last - first,
          direction: normalizeDirection(undefined, last - first),
          values,
        };
      }),
    [trend],
  );

  const habitTrends = useMemo(() => {
    const modelItems = safeModel(
      () => buildHabitTrendSummaries(trend, { days: HEATMAP_DAYS, endDate: dataThroughDate }) as HabitTrendLike[],
      [],
    );
    const byKey = new Map(
      modelItems.map(item => {
        const key = item.key ?? (item.label ? keyFromLabel(item.label) : null);
        return [key, item] as const;
      }),
    );

    return fallbackHabitTrends.map(item => {
      const model = byKey.get(item.key);
      const values = coerceSeries(model) ?? item.values;
      const average = coerceNumber(model?.average) ?? item.average;
      const delta = coerceNumber(model?.delta) ?? item.delta;
      const direction = normalizeDirection(model?.direction, delta);
      return {
        key: item.key,
        label: model?.label ?? item.label,
        average,
        delta,
        direction,
        values,
      };
    });
  }, [dataThroughDate, fallbackHabitTrends, trend]);

  const fallbackInsights = useMemo(() => {
    if (!hasTrendHistory) {
      return [
        'No completed discipline scores are available in this 30-day window yet.',
        'Hermes will turn the next midnight review into consistency, habit, and recovery signals.',
        'Tasks and logs remain available, but the pattern layer needs scored days first.',
      ];
    }

    const messages = [
      `You showed up ${shownUpDays} of the last ${availableDays} days.`,
      `${resolveHabitLabel(bestHabit)} is your strongest habit in the last 7 days.`,
      `${resolveHabitLabel(weakestHabit)} is the weakest habit to stabilize next.`,
    ];

    const recoveryDetail = getRecoveryRiskDetail(recoveryRisk);
    if (recoveryDetail !== 'Sleep, exercise, nutrition vs workload') {
      messages.push(recoveryDetail);
    }

    if (summary.taskCount > 0) {
      messages.push(`Selected day task completion: ${summary.completedTasks}/${summary.taskCount}.`);
    }

    return messages;
  }, [availableDays, bestHabit, hasTrendHistory, recoveryRisk, shownUpDays, summary.completedTasks, summary.taskCount, weakestHabit]);

  const hermesPanel = useMemo(() => {
    if (!hasTrendHistory) {
      return {
        dataThroughDate,
        headline: 'Waiting for completed discipline data',
        insights: fallbackInsights,
        tomorrowFocus: 'Let the next completed-day review establish the baseline.',
      };
    }

    return safeModel(
        () => buildHermesInsightPanel(trend, { days: MOMENTUM_DAYS, endDate: dataThroughDate }),
        {
          dataThroughDate,
          headline: 'Week in view',
          insights: fallbackInsights,
          tomorrowFocus: 'Repeat the basics and keep tomorrow easy to start.',
        },
      );
  }, [dataThroughDate, fallbackInsights, hasTrendHistory, trend]);

  const insightMessages = useMemo<string[]>(() => {
    const panelInsights = Array.isArray(hermesPanel.insights) ? hermesPanel.insights : [];
    const next = panelInsights.length ? [...panelInsights, `Tomorrow's best focus: ${hermesPanel.tomorrowFocus}`] : fallbackInsights;
    return next;
  }, [fallbackInsights, hermesPanel.insights, hermesPanel.tomorrowFocus]);

  const selectReviewDate = useCallback((dateKey: string) => {
    const nextDate = clampDateKey(dateKey, dataThroughDate);
    if (nextDate !== selectedDate) {
      setReview(null);
      setReviewDateLoaded(null);
      setScoreDraft(createEmptyScores());
      setScoreNotes('');
    }
    setSelectedDate(nextDate);
  }, [dataThroughDate, selectedDate]);

  const refreshDashboard = async () => {
    const latest = latestCompletedDateKey(new Date());
    const nextSelectedDate = clampDateKey(selectedDate, latest);
    if (latest === dataThroughDate && nextSelectedDate === selectedDate) {
      await loadData(nextSelectedDate, latest);
      return;
    }
    setReview(null);
    setReviewDateLoaded(null);
    setScoreDraft(createEmptyScores());
    setScoreNotes('');
    setDataThroughDate(latest);
    setSelectedDate(nextSelectedDate);
  };

  const handleSaveScores = async () => {
    setIsSavingScores(true);
    setStatusMessage(null);
    try {
      await saveDisciplineScores(selectedDate, scoreDraft, scoreNotes.trim());
      setStatusTone('success');
      setStatusMessage('Scores saved');
      await loadData(selectedDate, dataThroughDate);
    } catch (saveError) {
      setStatusTone('error');
      setStatusMessage(saveError instanceof Error ? saveError.message : 'Unable to save scores');
    } finally {
      setIsSavingScores(false);
    }
  };

  const handleSaveReading = async () => {
    const title = readingTitle.trim();
    if (!title) {
      setStatusTone('error');
      setStatusMessage('Reading title required');
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
      setStatusMessage('Reading logged');
      await loadData(selectedDate, dataThroughDate);
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
      setStatusMessage('Exercise type required');
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
      setStatusMessage('Exercise logged');
      await loadData(selectedDate, dataThroughDate);
    } catch (saveError) {
      setStatusTone('error');
      setStatusMessage(saveError instanceof Error ? saveError.message : 'Unable to save exercise');
    } finally {
      setSavingExercise(false);
    }
  };

  const selectedDateTitle = selectedDate === dataThroughDate ? 'Latest Completed Day Review' : 'Selected Completed Day Review';
  const canMoveForward = selectedDate < dataThroughDate;

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg-dark text-paper-cream">
      <CustomCursor />
      <div className="noise-overlay" />
      <div className="absolute inset-x-0 top-0 h-48 bg-white/[0.02]" />

      <header className="sticky top-0 z-20 border-b border-white/5 bg-bg-dark/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onNavigateHome}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold tracking-wider text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={3} />
                Pomodoro
              </button>
              <span className="inline-flex items-center gap-2 rounded-lg border border-accent-green/20 bg-accent-green/10 px-4 py-2 text-xs font-semibold tracking-wider text-accent-green">
                <BarChart3 className="h-4 w-4" strokeWidth={3} />
                Discipline Dashboard
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
              <div>
                <h1 className="font-grotesk text-3xl font-black tracking-tight text-white sm:text-4xl">Discipline Dashboard</h1>
                <p className="mt-1 text-sm text-white/55">Retrospective life map</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Data through {dataThroughDate}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => selectReviewDate(shiftDateKey(selectedDate, -1))}
                className="grid h-8 w-8 place-items-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={3} />
              </button>
              <button
                onClick={() => selectReviewDate(dataThroughDate)}
                className={`rounded-md px-4 py-1.5 text-xs font-bold tracking-wider transition ${
                  selectedDate === dataThroughDate ? 'bg-accent-green/20 text-accent-green' : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`}
              >
                Latest
              </button>
              <button
                onClick={() => canMoveForward && selectReviewDate(shiftDateKey(selectedDate, 1))}
                disabled={!canMoveForward}
                className="grid h-8 w-8 place-items-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>

            <label className="flex h-10 items-center rounded-lg border border-white/10 bg-white/5 px-3 transition hover:border-white/20">
              <CalendarDays className="mr-2 h-4 w-4 text-white/45" strokeWidth={3} />
              <input
                type="date"
                value={selectedDate}
                max={dataThroughDate}
                onChange={event => selectReviewDate(event.target.value)}
                className="bg-transparent text-xs font-semibold uppercase tracking-wider text-white/80 outline-none"
              />
            </label>

            <button
              onClick={() => void refreshDashboard()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-xs font-semibold tracking-wider text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={3} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-20">
        <AnimatePresence>
          {(statusMessage || error) && (
            <motion.div
              className={`mb-6 rounded-xl border p-4 text-sm font-medium backdrop-blur-md ${
                error
                  ? 'border-accent-red/40 bg-accent-red/10 text-accent-red'
                  : statusTone === 'success'
                    ? 'border-accent-green/40 bg-accent-green/10 text-accent-green'
                    : 'border-white/15 bg-white/[0.04] text-white/70'
              }`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex items-center gap-2">
                {error ? <X className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
                {error || statusMessage}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="mb-8">
          <SectionHeading
            icon={TrendingUp}
            title="Last 7 Days Momentum"
            subtitle={hasTrendHistory ? `${shownUpDays}/${availableDays} days with non-zero discipline score` : 'Awaiting completed discipline scores'}
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard icon={Flame} label="Consistency" value={`${Math.round(consistencyRate * 100)}%`} detail={`${shownUpDays} of ${availableDays} days`} />
            <MetricCard icon={BarChart3} label="Average Score" value={`${averageMomentumScore.toFixed(1)}/${DAY_SCORE_MAX}`} detail="Mean total score over 7 days" />
            <MetricCard
              icon={SCORE_META[(typeof bestHabit === 'object' && bestHabit?.key ? bestHabit.key : keyFromLabel(resolveHabitLabel(bestHabit)) ?? 'discipline') as DisciplineScoreKey].icon}
              label="Best Habit"
              value={resolveHabitLabel(bestHabit)}
              detail={hasTrendHistory && resolveHabitAverage(bestHabit) !== null ? `${resolveHabitAverage(bestHabit)?.toFixed(1)}/10 average` : 'Awaiting completed scores'}
            />
            <MetricCard
              icon={SCORE_META[(typeof weakestHabit === 'object' && weakestHabit?.key ? weakestHabit.key : keyFromLabel(resolveHabitLabel(weakestHabit)) ?? 'discipline') as DisciplineScoreKey].icon}
              label="Weakest Habit"
              value={resolveHabitLabel(weakestHabit)}
              detail={hasTrendHistory && resolveHabitAverage(weakestHabit) !== null ? `${resolveHabitAverage(weakestHabit)?.toFixed(1)}/10 average` : 'Awaiting completed scores'}
            />
            <MetricCard icon={Moon} label="Recovery Risk" value={getRecoveryRiskLabel(recoveryRisk)} detail={getRecoveryRiskDetail(recoveryRisk)} />
            <MetricCard
              icon={BadgeCheck}
              label="Task Completion"
              value={summary.taskCount ? `${summary.completedTasks}/${summary.taskCount}` : 'No tasks'}
              detail={summary.taskCount ? `${Math.round((summary.completedTasks / summary.taskCount) * 100)}% done on selected day` : 'No tasks on selected day'}
            />
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-white">Weekly intensity</h3>
                <p className="text-xs text-white/45">Click a day to review it.</p>
              </div>
              {loading && <span className="text-xs font-semibold tracking-wider text-white/40">Loading</span>}
            </div>
            {!hasTrendHistory && !loading ? (
              <EmptyState icon={CalendarDays} message="No scored days in this weekly window yet. Hermes will populate this after the next completed-day review." />
            ) : (
              <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
                <div className="grid min-w-[640px] grid-cols-7 gap-2 md:min-w-0">
                  {momentumDays.map(day => {
                    const total = Math.max(0, Math.min(DAY_SCORE_MAX, Number(day.total ?? 0)));
                    const height = Math.max(18, Math.round((total / DAY_SCORE_MAX) * 112));
                    const isSelected = selectedDate === day.date;
                    const isLatest = dataThroughDate === day.date;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => selectReviewDate(day.date)}
                        className={`flex min-h-[156px] flex-col justify-between rounded-lg border p-2.5 text-left transition sm:p-3 ${
                          isSelected
                            ? 'border-accent-green/50 bg-accent-green/10'
                            : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
                        }`}
                      >
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">{formatShortDay(day.date)}</div>
                          <div className="mt-1 text-sm font-semibold text-white">{new Date(`${day.date}T12:00:00`).getDate()}</div>
                          {isLatest && <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-green">Latest</div>}
                        </div>
                        <div>
                          <div className="flex h-28 items-end sm:h-32">
                            <div className="w-full rounded-md bg-white/5 p-1">
                              <div className="w-full rounded-sm bg-accent-green/90 transition-all" style={{ height }} />
                            </div>
                          </div>
                          <div className="mt-3 text-sm font-semibold text-white">{total}</div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {DISCIPLINE_SCORE_BLOCKS.map(block => {
                              const touched = day.touchedHabitKeys.includes(block.key);
                              return (
                                <span
                                  key={`${day.date}-${block.key}`}
                                  className={`h-2 w-2 rounded-full ${touched ? SCORE_META[block.key].fill : 'bg-white/10'}`}
                                  aria-hidden="true"
                                />
                              );
                            })}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mb-8">
          <SectionHeading icon={CalendarDays} title="30-Day Life Map" subtitle="Monthly rhythm, gaps, and streaks through the latest completed day" />
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-white/55">Each cell is a completed day scored by total discipline.</div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                <span>Low</span>
                <div className="flex items-center gap-1">
                  {[0.1, 0.35, 0.6, 0.9].map(level => (
                    <span key={level} className={`h-3 w-3 rounded-sm ${getHeatmapTone(level)}`} />
                  ))}
                </div>
                <span>High</span>
              </div>
            </div>

            {!hasTrendHistory && !loading ? (
              <div className="mt-4">
                <EmptyState icon={CalendarDays} message="No scored days in the 30-day window yet. The map will light up once Hermes records completed days." />
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {heatmapCells.map(cell => {
                  const isSelected = selectedDate === cell.date;
                  const isLatest = dataThroughDate === cell.date;
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      onClick={() => selectReviewDate(cell.date)}
                      title={`${cell.label}${cell.topHabit ? ` | Top habit: ${cell.topHabit}` : ''}`}
                      className={`group flex h-10 w-10 items-center justify-center rounded-md border text-[11px] font-semibold transition ${
                        isSelected ? 'border-white bg-white text-black' : isLatest ? 'border-accent-green/50' : 'border-white/10'
                      } ${getHeatmapTone(cell.intensity)}`}
                    >
                      <span className={isSelected ? 'text-black' : 'text-white/80'}>{new Date(`${cell.date}T12:00:00`).getDate()}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {hasTrendHistory && (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {heatmapCells.slice(-3).map(cell => (
                  <div key={`heatmap-note-${cell.date}`} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white/70">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">{cell.date}</div>
                    <div className="mt-1 font-semibold text-white">{cell.total}/{DAY_SCORE_MAX}</div>
                    <div className="mt-1 text-xs text-white/50">{cell.topHabit ? `Top habit: ${cell.topHabit}` : 'No dominant habit logged'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mb-8">
          <SectionHeading icon={Activity} title="Habit Trends" subtitle="30-day movement across the six discipline blocks" />
          {!hasTrendHistory && !loading ? (
            <div className="mt-4">
              <EmptyState icon={Activity} message="Habit trend lines need at least one scored completed day." />
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {habitTrends.map(item => {
                const meta = SCORE_META[item.key];
                const Icon = meta.icon;
                const direction = item.direction as 'up' | 'down' | 'flat';
                return (
                  <div key={item.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${meta.tint}`}>
                          <Icon className={`h-4 w-4 ${meta.accent}`} strokeWidth={2.5} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{item.label}</div>
                          <div className="text-xs text-white/45">{getDirectionLabel(direction)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">{item.average.toFixed(1)}/10</div>
                        <div className={`text-xs ${direction === 'up' ? 'text-accent-green' : direction === 'down' ? 'text-accent-red' : 'text-white/45'}`}>
                          {item.delta >= 0 ? '+' : ''}
                          {item.delta.toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Sparkline values={item.values} stroke={meta.stroke} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-8">
          <SectionHeading
            icon={Clock3}
            title={selectedDateTitle}
            subtitle={`${formatLongDate(selectedDate)}${selectedDate === dataThroughDate ? ' | defaulted to the latest completed day' : ''}`}
          />

          <div className="mt-4 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={BarChart3} label="Total Score" value={`${scoreStats.total}/${DAY_SCORE_MAX}`} detail={`${scoreStats.average.toFixed(1)}/10 per block`} />
                <MetricCard icon={Clock3} label="Focus Volume" value={`${summary.totalPomodoroMinutes} min`} detail={`${summary.pomodoroCount} completed sessions`} />
                <MetricCard icon={BookOpen} label="Reading" value={`${summary.totalReadingPages} pages`} detail={`${summary.totalReadingMinutes} minutes logged`} />
                <MetricCard icon={Dumbbell} label="Exercise" value={`${summary.totalExerciseMinutes} min`} detail={`${summary.exerciseCount} entries on selected day`} />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="text-sm font-semibold tracking-wide text-white">Notes and habit breakdown</h3>
                  <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-sm leading-relaxed text-white/70">
                    {selectedReviewLoading
                      ? 'Loading selected completed day...'
                      : selectedReview?.score?.notes?.trim()
                        ? selectedReview.score.notes
                        : 'No notes recorded for this completed day.'}
                  </div>
                  <div className="mt-4 space-y-3">
                    {DISCIPLINE_SCORE_BLOCKS.map(block => {
                      const value = Number((selectedReview?.score?.scores ?? displayedScoreDraft)[block.key] ?? 0);
                      const meta = SCORE_META[block.key];
                      const Icon = meta.icon;
                      return (
                        <div key={block.key} className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${meta.accent}`} strokeWidth={2.5} />
                              <span className="text-sm font-medium text-white/80">{block.label}</span>
                            </div>
                            <span className="text-sm font-semibold text-white">{value}/10</span>
                          </div>
                          <div className={`mt-3 h-2 overflow-hidden rounded-full ${meta.track}`}>
                            <div className={`h-full rounded-full ${meta.fill}`} style={{ width: `${(value / SCORE_MAX) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold tracking-wide text-white">Hermes insight panel</h3>
                      <p className="mt-1 text-xs text-white/45">{hermesPanel.headline}</p>
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Deterministic</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {insightMessages.map((message: string, index: number) => (
                      <div key={`${index}-${message}`} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm leading-relaxed text-white/75">
                        {message}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold tracking-wide text-white">Tasks</h3>
                  <span className="text-xs text-white/45">{summary.completedTasks}/{summary.taskCount} completed</span>
                </div>
                <div className="space-y-3">
                  {(selectedReview?.tasks ?? []).slice(0, 8).map(task => (
                    <div key={task.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{task.title}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/40">{task.status}</div>
                      </div>
                      <span
                        className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                          task.status === 'done' ? 'bg-accent-green/15 text-accent-green' : task.status === 'doing' ? 'bg-amber-400/15 text-amber-300' : 'bg-white/10 text-white/55'
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                  ))}
                  {(selectedReview?.tasks?.length ?? 0) === 0 && !selectedReviewLoading && <EmptyState icon={BadgeCheck} message="No tasks connected to this completed day." />}
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold tracking-wide text-white">Pomodoro sessions</h3>
                    <span className="text-xs text-white/45">{summary.pomodoroCount} sessions</span>
                  </div>
                  <div className="space-y-3">
                    {(selectedReview?.pomodoros ?? []).slice(0, 6).map(session => (
                      <div key={session.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{session.taskTitle || 'Deep work session'}</div>
                          <div className="mt-1 text-xs text-white/40">{formatDateTime(session.completedAt)}</div>
                        </div>
                        <div className="text-sm font-semibold text-white">{session.durationMinutes} min</div>
                      </div>
                    ))}
                    {(selectedReview?.pomodoros?.length ?? 0) === 0 && !selectedReviewLoading && <EmptyState icon={Clock3} message="No completed pomodoro sessions on this day." />}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold tracking-wide text-white">Events timeline</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(summary.eventCounts).slice(0, 3).map(([type, count]) => {
                        const EventIcon = EVENT_ICON[type as keyof typeof EVENT_ICON] ?? Play;
                        return (
                          <div
                            key={type}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold tracking-wider ${
                              EVENT_STYLES[type as keyof typeof EVENT_STYLES] ?? 'border-white/10 bg-white/[0.03] text-white/70'
                            }`}
                          >
                            <EventIcon className="h-3 w-3" strokeWidth={2.5} />
                            {count}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {(selectedReview?.events ?? []).slice(0, 8).map(event => {
                      const EventIcon = EVENT_ICON[event.type] ?? Play;
                      return (
                        <div key={event.id} className={`rounded-lg border px-3 py-3 ${EVENT_STYLES[event.type]}`}>
                          <div className="flex items-center gap-3">
                            <EventIcon className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{event.type.replace('pomodoro_', '')}</div>
                              <div className="truncate text-sm font-semibold text-white/90">{event.taskTitle || 'Unassigned session'}</div>
                              <div className="text-xs opacity-60">{formatDateTime(event.createdAt)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {(selectedReview?.events?.length ?? 0) === 0 && !selectedReviewLoading && <EmptyState icon={Activity} message="No timeline events captured for this day." />}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold tracking-wide text-white">Update selected day</h3>
                    <p className="mt-1 text-xs text-white/45">Score edits stay available without taking over the dashboard.</p>
                  </div>
                  <span className="text-xs text-white/45">{selectedDate}</span>
                </div>
                <div className="space-y-4">
                  {DISCIPLINE_SCORE_BLOCKS.map(block => (
                    <ScoreRow
                      key={block.key}
                      block={block}
                      value={scoreDraft[block.key]}
                      onChange={value => setScoreDraft(prev => ({ ...prev, [block.key]: value }))}
                    />
                  ))}
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Notes</span>
                    <textarea
                      value={scoreNotes}
                      onChange={event => setScoreNotes(event.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-white/25"
                      placeholder="What shaped this completed day?"
                    />
                  </label>
                  <button
                    onClick={() => void handleSaveScores()}
                    disabled={isSavingScores || selectedReviewLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent-green px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingScores ? <RotateCcw className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                    Save scores
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-wide text-white">Reading log</h3>
                  {!isAddingReading && (
                    <button
                      onClick={() => setIsAddingReading(true)}
                      disabled={selectedReviewLoading}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 transition hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {isAddingReading && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={readingTitle}
                          onChange={event => setReadingTitle(event.target.value)}
                          className="sm:col-span-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-400/50"
                          placeholder="Book title or article"
                        />
                        <input
                          type="number"
                          min="0"
                          value={readingPages}
                          onChange={event => setReadingPages(event.target.value)}
                          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-400/50"
                          placeholder="Pages"
                        />
                        <input
                          type="number"
                          min="0"
                          value={readingMinutes}
                          onChange={event => setReadingMinutes(event.target.value)}
                          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-400/50"
                          placeholder="Minutes"
                        />
                        <input
                          value={readingNotes}
                          onChange={event => setReadingNotes(event.target.value)}
                          className="sm:col-span-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-400/50"
                          placeholder="Notes"
                        />
                      </div>
                      <div className="mt-4 flex justify-end gap-3">
                        <button onClick={() => setIsAddingReading(false)} className="px-3 py-2 text-xs font-semibold text-white/50 transition hover:text-white">
                          Cancel
                        </button>
                        <button
                          onClick={() => void handleSaveReading()}
                          disabled={savingReading || selectedReviewLoading}
                          className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingReading ? <RotateCcw className="h-4 w-4 animate-spin" /> : 'Save reading'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-3">
                  {(selectedReview?.reading ?? []).slice(0, 5).map(entry => (
                    <div key={entry.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{entry.title || 'Untitled'}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/45">
                            <span>{entry.pages} pages</span>
                            <span>{entry.minutes} min</span>
                            <span>{formatDateTime(entry.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      {entry.notes && <div className="mt-3 text-sm text-white/65">{entry.notes}</div>}
                    </div>
                  ))}
                  {(selectedReview?.reading?.length ?? 0) === 0 && !selectedReviewLoading && !isAddingReading && (
                    <EmptyState icon={BookOpen} message="No reading logged for this completed day." onAction={() => setIsAddingReading(true)} actionText="Log reading" />
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-wide text-white">Exercise log</h3>
                  {!isAddingExercise && (
                    <button
                      onClick={() => setIsAddingExercise(true)}
                      disabled={selectedReviewLoading}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-green transition hover:text-green-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {isAddingExercise && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 rounded-lg border border-accent-green/20 bg-accent-green/5 p-4"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={exerciseType}
                          onChange={event => setExerciseType(event.target.value)}
                          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-accent-green/50"
                          placeholder="Workout type"
                        />
                        <input
                          type="number"
                          min="0"
                          value={exerciseDuration}
                          onChange={event => setExerciseDuration(event.target.value)}
                          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-accent-green/50"
                          placeholder="Minutes"
                        />
                        <input
                          value={exerciseIntensity}
                          onChange={event => setExerciseIntensity(event.target.value)}
                          className="sm:col-span-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-accent-green/50"
                          placeholder="Intensity"
                        />
                        <input
                          value={exerciseNotes}
                          onChange={event => setExerciseNotes(event.target.value)}
                          className="sm:col-span-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-accent-green/50"
                          placeholder="Notes"
                        />
                      </div>
                      <div className="mt-4 flex justify-end gap-3">
                        <button onClick={() => setIsAddingExercise(false)} className="px-3 py-2 text-xs font-semibold text-white/50 transition hover:text-white">
                          Cancel
                        </button>
                        <button
                          onClick={() => void handleSaveExercise()}
                          disabled={savingExercise || selectedReviewLoading}
                          className="inline-flex items-center gap-2 rounded-lg bg-accent-green px-4 py-2 text-xs font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingExercise ? <RotateCcw className="h-4 w-4 animate-spin" /> : 'Save exercise'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-3">
                  {(selectedReview?.exercise ?? []).slice(0, 5).map(entry => (
                    <div key={entry.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{entry.type || 'Exercise'}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/45">
                            <span>{entry.durationMinutes} min</span>
                            {entry.intensity && <span>{entry.intensity}</span>}
                            <span>{formatDateTime(entry.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      {entry.notes && <div className="mt-3 text-sm text-white/65">{entry.notes}</div>}
                    </div>
                  ))}
                  {(selectedReview?.exercise?.length ?? 0) === 0 && !selectedReviewLoading && !isAddingExercise && (
                    <EmptyState icon={Dumbbell} message="No exercise logged for this completed day." onAction={() => setIsAddingExercise(true)} actionText="Log exercise" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-white/70">
          <Icon className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
          <p className="text-sm text-white/45">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function ScoreRow({
  block,
  value,
  onChange,
}: {
  block: (typeof DISCIPLINE_SCORE_BLOCKS)[number];
  value: number;
  onChange: (value: number) => void;
}) {
  const meta = SCORE_META[block.key];
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-4">
      <div className={`rounded-lg p-2.5 ${meta.tint}`}>
        <Icon className={`h-4 w-4 ${meta.accent}`} strokeWidth={2.5} />
      </div>
      <div className="flex-1">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-sm font-medium text-white/80">{block.label}</span>
          <span className="text-sm font-semibold text-white">{value}/10</span>
        </div>
        <div className={`relative h-2 overflow-hidden rounded-full ${meta.track}`}>
          <div className={`absolute inset-y-0 left-0 rounded-full ${meta.fill}`} style={{ width: `${(value / SCORE_MAX) * 100}%` }} />
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={value}
            onChange={event => onChange(Number(event.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-3 text-white/50">
        <div className="rounded-lg bg-white/5 p-2">
          <Icon className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">{label}</span>
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-xs text-white/45">{detail}</div>
    </div>
  );
}

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  if (!values.length) {
    return <div className="h-20 rounded-lg border border-dashed border-white/10 bg-black/20" />;
  }

  const width = 220;
  const height = 72;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full">
      <path d={`M 0 ${height - 4} L ${points.replace(/ /g, ' L ')}`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <polyline fill="none" points={points} stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 px-6 py-10 text-center ${
        onAction ? 'cursor-pointer transition hover:border-white/20 hover:text-white' : ''
      }`}
      onClick={onAction}
    >
      <div className="mb-3 rounded-full bg-white/5 p-3 text-white/20">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-white/40">{message}</p>
      {onAction && actionText && <span className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/55">{actionText}</span>}
    </div>
  );
}

import {
  DEFAULT_HABIT_DEFINITIONS,
  HABIT_SCORE_MAX,
  getActiveHabits,
  normalizeHabitDefinitions,
  toBinaryHabitScore,
  type DisciplineHabitDefinition,
  type DisciplineTrendPoint,
} from './disciplineApi';

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_HABIT_SCORE = HABIT_SCORE_MAX;
const DEFAULT_MOMENTUM_DAYS = 7;
const DEFAULT_HEATMAP_DAYS = 30;
// Binary completion rates live in 0..1 space.
const TREND_DIRECTION_THRESHOLD = 0.12;
const LOW_RECOVERY_THRESHOLD = 0.45;
const HIGH_DEEP_WORK_THRESHOLD = 0.7;
const MODERATE_DEEP_WORK_THRESHOLD = 0.55;

const RECOVERY_HABIT_KEYS = ['sleep', 'exercise', 'nutrition'] as const;

export type DisciplineHabitScoreMap = Record<string, number>;
export type HabitTrendDirection = 'up' | 'flat' | 'down';
export type RecoveryRiskLevel = 'low' | 'moderate' | 'high';
export type RecoveryRiskFlag =
  | 'low_sleep'
  | 'low_exercise'
  | 'low_nutrition'
  | 'high_deep_work';

export interface LatestCompletedDateOptions {
  explicitDate?: string | null;
  referenceDate?: Date | string | number;
}

export interface TrendWindowOptions {
  days?: number;
  endDate?: string | null;
  referenceDate?: Date | string | number;
  habits?: DisciplineHabitDefinition[] | null;
}

export interface DisciplineMomentumDay {
  date: string;
  total: number;
  intensity: number;
  intensityLevel: 0 | 1 | 2 | 3 | 4;
  shownUp: boolean;
  scores: DisciplineHabitScoreMap;
  touchedHabits: string[];
  topHabitKey: string | null;
  topHabitLabel: string | null;
}

export interface HabitTrendSummary {
  key: string;
  label: string;
  average: number;
  total: number;
  activeDays: number;
  baselineAverage: number;
  recentAverage: number;
  delta: number;
  direction: HabitTrendDirection;
  sparkline: number[];
}

export interface RecoveryRiskSummary {
  level: RecoveryRiskLevel;
  isAtRisk: boolean;
  flags: RecoveryRiskFlag[];
  recoveryAverage: number;
  deepWorkAverage: number;
  guidance: string;
}

export interface SevenDayMomentumSummary {
  startDate: string;
  endDate: string;
  availableDays: number;
  shownUpDays: number;
  consistencyRate: number;
  consistencyPercent: number;
  averageScore: number;
  days: DisciplineMomentumDay[];
  bestHabit: HabitTrendSummary | null;
  weakestHabit: HabitTrendSummary | null;
  recoveryRisk: RecoveryRiskSummary;
}

export interface DisciplineHeatmapCell {
  date: string;
  total: number;
  intensity: number;
  intensityLevel: 0 | 1 | 2 | 3 | 4;
  shownUp: boolean;
  scores: DisciplineHabitScoreMap;
  topHabitKey: string | null;
  topHabitLabel: string | null;
}

export interface HermesInsightPanel {
  dataThroughDate: string;
  headline: string;
  insights: string[];
  tomorrowFocus: string;
}

export interface DisciplineDashboardModelOptions {
  dataThroughDate?: string | null;
  referenceDate?: Date | string | number;
  momentumDays?: number;
  heatmapDays?: number;
  habitTrendDays?: number;
  habits?: DisciplineHabitDefinition[] | null;
}

export interface DisciplineDashboardModel {
  dataThroughDate: string;
  momentum: SevenDayMomentumSummary;
  heatmap: DisciplineHeatmapCell[];
  habitTrends: HabitTrendSummary[];
  insights: HermesInsightPanel;
}

interface NormalizedTrendDay {
  date: string;
  total: number;
  scores: DisciplineHabitScoreMap;
  shownUp: boolean;
  touchedHabits: string[];
  topHabitKey: string | null;
  topHabitLabel: string | null;
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseDateInput(value: Date | string | number): Date {
  if (value instanceof Date) {
    const clone = new Date(value.getTime());
    if (Number.isNaN(clone.getTime())) {
      throw new Error('Invalid Date instance.');
    }
    return clone;
  }

  if (typeof value === 'string') {
    const match = DATE_KEY_PATTERN.exec(value.trim());
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const parsed = new Date(year, month, day, 12, 0, 0, 0);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date input: ${String(value)}`);
  }
  return parsed;
}

function formatLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function resolveHabits(habits?: DisciplineHabitDefinition[] | null) {
  const all = normalizeHabitDefinitions(habits);
  const active = getActiveHabits(all);
  const list = active.length > 0 ? active : all;
  return {
    all,
    active: list,
    labels: Object.fromEntries(list.map((habit) => [habit.key, habit.label])) as Record<string, string>,
    order: Object.fromEntries(list.map((habit, index) => [habit.key, habit.sortOrder ?? index])) as Record<string, number>,
  };
}

function createEmptyScores(habits: readonly DisciplineHabitDefinition[] = DEFAULT_HABIT_DEFINITIONS): DisciplineHabitScoreMap {
  return Object.fromEntries(habits.map((habit) => [habit.key, 0]));
}

function normalizeScores(
  scores: Record<string, number> | null | undefined,
  habits: readonly DisciplineHabitDefinition[] = DEFAULT_HABIT_DEFINITIONS,
) {
  const normalized = createEmptyScores(habits);
  for (const habit of habits) {
    normalized[habit.key] = toBinaryHabitScore(scores?.[habit.key]);
  }
  return normalized;
}

function resolveTopHabit(scores: DisciplineHabitScoreMap, habits: readonly DisciplineHabitDefinition[]) {
  let topHabitKey: string | null = null;
  let topHabitValue = 0;
  for (const habit of habits) {
    const value = scores[habit.key] ?? 0;
    if (value > topHabitValue) {
      topHabitKey = habit.key;
      topHabitValue = value;
    }
  }
  return {
    topHabitKey,
    topHabitLabel: topHabitKey ? (habits.find((habit) => habit.key === topHabitKey)?.label ?? topHabitKey) : null,
  };
}

function normalizeTrendDay(
  point: DisciplineTrendPoint,
  habits: readonly DisciplineHabitDefinition[] = DEFAULT_HABIT_DEFINITIONS,
): NormalizedTrendDay {
  const scores = normalizeScores(point.scores, habits);
  const touchedHabits = habits
    .filter((habit) => scores[habit.key] > 0)
    .map((habit) => habit.key);
  const scoreTotal = habits.reduce((sum, habit) => sum + scores[habit.key], 0);
  const total = scoreTotal;
  const shownUp = total > 0 || touchedHabits.length > 0;
  const topHabit = resolveTopHabit(scores, habits);

  return {
    date: toLocalDateKey(point.date),
    total,
    scores,
    shownUp,
    touchedHabits,
    topHabitKey: topHabit.topHabitKey,
    topHabitLabel: topHabit.topHabitLabel,
  };
}

function createEmptyTrendDay(
  date: string,
  habits: readonly DisciplineHabitDefinition[] = DEFAULT_HABIT_DEFINITIONS,
): NormalizedTrendDay {
  return {
    date,
    total: 0,
    scores: createEmptyScores(habits),
    shownUp: false,
    touchedHabits: [],
    topHabitKey: null,
    topHabitLabel: null,
  };
}

function buildTrendLookup(
  trendPoints: readonly DisciplineTrendPoint[],
  habits: readonly DisciplineHabitDefinition[] = DEFAULT_HABIT_DEFINITIONS,
) {
  const lookup = new Map<string, NormalizedTrendDay>();

  for (const point of trendPoints) {
    const normalized = normalizeTrendDay(point, habits);
    lookup.set(normalized.date, normalized);
  }

  return lookup;
}

function resolveWindowDays(days: number | undefined, fallback: number) {
  const resolved = Math.floor(toFiniteNumber(days, fallback));
  return resolved > 0 ? resolved : fallback;
}

function resolveWindowEndDate(
  trendPoints: readonly DisciplineTrendPoint[],
  endDate: string | null | undefined,
  referenceDate: Date | string | number | undefined,
) {
  if (endDate) {
    return toLocalDateKey(endDate);
  }

  let latestTrendDate: string | null = null;
  for (const point of trendPoints) {
    const dateKey = toLocalDateKey(point.date);
    if (!latestTrendDate || dateKey > latestTrendDate) {
      latestTrendDate = dateKey;
    }
  }

  return latestTrendDate ?? getLatestCompletedDateKey({ referenceDate });
}

function buildTrendWindow(
  trendPoints: readonly DisciplineTrendPoint[],
  options: TrendWindowOptions,
  fallbackDays: number,
) {
  const habits = resolveHabits(options.habits).active;
  const days = resolveWindowDays(options.days, fallbackDays);
  const endDate = resolveWindowEndDate(trendPoints, options.endDate, options.referenceDate);
  const startDate = shiftDateKey(endDate, -(days - 1));
  const lookup = buildTrendLookup(trendPoints, habits);
  const window: NormalizedTrendDay[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = shiftDateKey(startDate, offset);
    window.push(lookup.get(date) ?? createEmptyTrendDay(date, habits));
  }

  return {
    days,
    startDate,
    endDate,
    window,
    habits,
    maxTotal: Math.max(1, habits.length * MAX_HABIT_SCORE),
  };
}

function toIntensityLevel(intensity: number): 0 | 1 | 2 | 3 | 4 {
  if (intensity <= 0) return 0;
  if (intensity < 0.25) return 1;
  if (intensity < 0.5) return 2;
  if (intensity < 0.75) return 3;
  return 4;
}

function mapWindowDay(day: NormalizedTrendDay, maxTotal: number): DisciplineMomentumDay {
  const intensity = clamp(day.total / Math.max(1, maxTotal), 0, 1);

  return {
    date: day.date,
    total: day.total,
    intensity,
    intensityLevel: toIntensityLevel(intensity),
    shownUp: day.shownUp,
    scores: day.scores,
    touchedHabits: day.touchedHabits,
    topHabitKey: day.topHabitKey,
    topHabitLabel: day.topHabitLabel,
  };
}

function buildHabitSummariesFromWindow(
  window: readonly NormalizedTrendDay[],
  habits: readonly DisciplineHabitDefinition[],
) {
  const splitIndex = Math.floor(window.length / 2);

  return habits.map((habit) => {
    const sparkline = window.map((day) => day.scores[habit.key] ?? 0);
    const total = sparkline.reduce((sum, value) => sum + value, 0);
    const average = window.length > 0 ? roundTo(total / window.length, 2) : 0;
    const activeDays = sparkline.filter((value) => value > 0).length;
    const baselineSeries = sparkline.slice(0, splitIndex || sparkline.length);
    const recentSeries = sparkline.slice(splitIndex || 0);
    const baselineAverage = baselineSeries.length > 0
      ? roundTo(baselineSeries.reduce((sum, value) => sum + value, 0) / baselineSeries.length, 2)
      : 0;
    const recentAverage = recentSeries.length > 0
      ? roundTo(recentSeries.reduce((sum, value) => sum + value, 0) / recentSeries.length, 2)
      : 0;
    const delta = roundTo(recentAverage - baselineAverage, 2);
    const direction: HabitTrendDirection =
      delta > TREND_DIRECTION_THRESHOLD ? 'up' :
        delta < -TREND_DIRECTION_THRESHOLD ? 'down' :
          'flat';

    return {
      key: habit.key,
      label: habit.label,
      average,
      total,
      activeDays,
      baselineAverage,
      recentAverage,
      delta,
      direction,
      sparkline,
    } satisfies HabitTrendSummary;
  });
}

function chooseBestHabit(
  habits: readonly HabitTrendSummary[],
  order: Record<string, number> = {},
) {
  if (!habits.some((habit) => habit.total > 0)) {
    return null;
  }

  return habits.reduce((best, candidate) => {
    if (!best) return candidate;
    if (candidate.average > best.average) return candidate;
    if (candidate.average < best.average) return best;
    if (candidate.activeDays > best.activeDays) return candidate;
    if (candidate.activeDays < best.activeDays) return best;
    return (order[candidate.key] ?? 999) < (order[best.key] ?? 999) ? candidate : best;
  }, null as HabitTrendSummary | null);
}

function chooseWeakestHabit(
  habits: readonly HabitTrendSummary[],
  order: Record<string, number> = {},
) {
  if (!habits.some((habit) => habit.total > 0)) {
    return null;
  }

  return habits.reduce((weakest, candidate) => {
    if (!weakest) return candidate;
    if (candidate.average < weakest.average) return candidate;
    if (candidate.average > weakest.average) return weakest;
    if (candidate.activeDays < weakest.activeDays) return candidate;
    if (candidate.activeDays > weakest.activeDays) return weakest;
    return (order[candidate.key] ?? 999) > (order[weakest.key] ?? 999) ? candidate : weakest;
  }, null as HabitTrendSummary | null);
}

function buildRecoveryGuidance(level: RecoveryRiskLevel, lowRecoveryLabels: string[]) {
  if (level === 'high') {
    return `Deep work is outrunning recovery. Reinforce ${lowRecoveryLabels.join(', ')} before adding workload.`;
  }

  if (level === 'moderate') {
    return `Output is solid, but ${lowRecoveryLabels.join(', ')} need more protection.`;
  }

  if (lowRecoveryLabels.length > 0) {
    return `Recovery is soft in ${lowRecoveryLabels.join(', ')}, but workload is not pressuring it yet.`;
  }

  return 'Recovery and workload look balanced right now.';
}

export function toLocalDateKey(value: Date | string | number): string {
  return formatLocalDateKey(parseDateInput(value));
}

export function shiftDateKey(dateKey: string, days: number): string {
  const date = parseDateInput(dateKey);
  date.setDate(date.getDate() + days);
  return formatLocalDateKey(date);
}

export function getLatestCompletedDateKey(options: LatestCompletedDateOptions = {}): string {
  if (options.explicitDate) {
    return toLocalDateKey(options.explicitDate);
  }

  const reference = options.referenceDate === undefined
    ? new Date()
    : parseDateInput(options.referenceDate);
  reference.setDate(reference.getDate() - 1);
  return formatLocalDateKey(reference);
}

export function buildSevenDayMomentumSummary(
  trendPoints: readonly DisciplineTrendPoint[],
  options: TrendWindowOptions = {},
): SevenDayMomentumSummary {
  const windowResult = buildTrendWindow(trendPoints, options, DEFAULT_MOMENTUM_DAYS);
  const days = windowResult.window.map((day) => mapWindowDay(day, windowResult.maxTotal));
  const shownUpDays = days.filter((day) => day.shownUp).length;
  const consistencyRate = days.length > 0 ? roundTo(shownUpDays / days.length, 4) : 0;
  const averageScore = days.length > 0
    ? roundTo(days.reduce((sum, day) => sum + day.total, 0) / days.length, 2)
    : 0;
  const habitSummaries = buildHabitSummariesFromWindow(windowResult.window, windowResult.habits);
  const habitOrder = Object.fromEntries(
    windowResult.habits.map((habit, index) => [habit.key, habit.sortOrder ?? index]),
  );

  return {
    startDate: windowResult.startDate,
    endDate: windowResult.endDate,
    availableDays: days.length,
    shownUpDays,
    consistencyRate,
    consistencyPercent: roundTo(consistencyRate * 100, 1),
    averageScore,
    days,
    bestHabit: chooseBestHabit(habitSummaries, habitOrder),
    weakestHabit: chooseWeakestHabit(habitSummaries, habitOrder),
    recoveryRisk: getRecoveryRiskSummary(trendPoints, {
      ...options,
      days: windowResult.days,
      endDate: windowResult.endDate,
    }),
  };
}

export function buildThirtyDayHeatmapCells(
  trendPoints: readonly DisciplineTrendPoint[],
  options: TrendWindowOptions = {},
): DisciplineHeatmapCell[] {
  const windowResult = buildTrendWindow(trendPoints, options, DEFAULT_HEATMAP_DAYS);

  return windowResult.window.map((day) => {
    const intensity = clamp(day.total / windowResult.maxTotal, 0, 1);
    return {
      date: day.date,
      total: day.total,
      intensity,
      intensityLevel: toIntensityLevel(intensity),
      shownUp: day.shownUp,
      scores: day.scores,
      topHabitKey: day.topHabitKey,
      topHabitLabel: day.topHabitLabel,
    };
  });
}

export function buildHabitTrendSummaries(
  trendPoints: readonly DisciplineTrendPoint[],
  options: TrendWindowOptions = {},
): HabitTrendSummary[] {
  const windowResult = buildTrendWindow(trendPoints, options, DEFAULT_HEATMAP_DAYS);
  return buildHabitSummariesFromWindow(windowResult.window, windowResult.habits);
}

export function getBestHabitSummary(
  trendPoints: readonly DisciplineTrendPoint[],
  options: TrendWindowOptions = {},
): HabitTrendSummary | null {
  const resolved = resolveHabits(options.habits);
  return chooseBestHabit(buildHabitTrendSummaries(trendPoints, options), resolved.order);
}

export function getWeakestHabitSummary(
  trendPoints: readonly DisciplineTrendPoint[],
  options: TrendWindowOptions = {},
): HabitTrendSummary | null {
  const resolved = resolveHabits(options.habits);
  return chooseWeakestHabit(buildHabitTrendSummaries(trendPoints, options), resolved.order);
}

export function getRecoveryRiskSummary(
  trendPoints: readonly DisciplineTrendPoint[],
  options: TrendWindowOptions = {},
): RecoveryRiskSummary {
  const windowResult = buildTrendWindow(trendPoints, options, DEFAULT_MOMENTUM_DAYS);
  const habits = buildHabitSummariesFromWindow(windowResult.window, windowResult.habits);
  const habitMap = new Map(habits.map((habit) => [habit.key, habit]));
  const deepWorkAverage = habitMap.get('deep_work')?.average ?? 0;
  const lowRecoveryFlags: RecoveryRiskFlag[] = [];
  const lowRecoveryLabels: string[] = [];

  for (const key of RECOVERY_HABIT_KEYS) {
    const average = habitMap.get(key)?.average ?? 0;
    if (average < LOW_RECOVERY_THRESHOLD) {
      lowRecoveryFlags.push(`low_${key}` as RecoveryRiskFlag);
      const label = windowResult.habits.find((habit) => habit.key === key)?.label || key;
      lowRecoveryLabels.push(label.toLowerCase());
    }
  }

  const recoveryAverage = roundTo(
    RECOVERY_HABIT_KEYS.reduce((sum, key) => sum + (habitMap.get(key)?.average ?? 0), 0) / RECOVERY_HABIT_KEYS.length,
    2,
  );
  const highDeepWork = deepWorkAverage >= HIGH_DEEP_WORK_THRESHOLD;
  const moderateDeepWork = deepWorkAverage >= MODERATE_DEEP_WORK_THRESHOLD;
  const flags: RecoveryRiskFlag[] = highDeepWork
    ? [...lowRecoveryFlags, 'high_deep_work']
    : [...lowRecoveryFlags];
  const lowRecoveryCount = lowRecoveryFlags.length;

  let level: RecoveryRiskLevel = 'low';
  if (highDeepWork && lowRecoveryCount >= 2) {
    level = 'high';
  } else if ((highDeepWork && lowRecoveryCount >= 1) || (moderateDeepWork && recoveryAverage < 0.4)) {
    level = 'moderate';
  }

  return {
    level,
    isAtRisk: level !== 'low',
    flags,
    recoveryAverage,
    deepWorkAverage,
    guidance: buildRecoveryGuidance(level, lowRecoveryLabels),
  };
}

export function buildHermesInsightPanel(
  trendPoints: readonly DisciplineTrendPoint[],
  options: TrendWindowOptions = {},
): HermesInsightPanel {
  const momentum = buildSevenDayMomentumSummary(trendPoints, {
    ...options,
    days: resolveWindowDays(options.days, DEFAULT_MOMENTUM_DAYS),
  });
  const hasActivity = momentum.days.some((day) => day.shownUp);

  if (!hasActivity) {
    return {
      dataThroughDate: momentum.endDate,
      headline: 'Waiting for completed discipline data',
      insights: [
        'No completed discipline scores are available in this window yet.',
        'Once Hermes writes the nightly review, this panel will summarize consistency, strongest habit, weakest habit, and recovery risk.',
        'The dashboard is ready, but it needs scored days before calling a pattern.',
      ],
      tomorrowFocus: 'Let the next completed-day review establish the baseline.',
    };
  }

  const bestHabit = momentum.bestHabit;
  const weakestHabit = momentum.weakestHabit;
  const recoveryRisk = momentum.recoveryRisk;
  const consistencyLine = `You showed up ${momentum.shownUpDays} of the last ${momentum.availableDays} days.`;

  let headline = 'Week in view';
  if (recoveryRisk.level === 'high') {
    headline = 'Recovery needs protection';
  } else if (momentum.consistencyRate >= 0.85) {
    headline = 'Consistency is holding';
  } else if (momentum.consistencyRate <= 0.4) {
    headline = 'The week was fragmented';
  }

  const habitLine = bestHabit && weakestHabit
    ? bestHabit.key === weakestHabit.key
      ? `${bestHabit.label} carried the week.`
      : `${bestHabit.label} is strongest this week; ${weakestHabit.label.toLowerCase()} is the weakest link.`
    : 'There is not enough activity yet to call a leading habit.';

  let recoveryLine = recoveryRisk.guidance;
  if (recoveryRisk.level === 'low' && bestHabit?.key === 'deep_work') {
    recoveryLine = 'Deep work is strong without obvious recovery strain.';
  }

  let tomorrowFocus = "Repeat the basics and keep tomorrow easy to start.";
  if (recoveryRisk.level === 'high') {
    tomorrowFocus = 'Protect recovery before increasing workload.';
  } else if (weakestHabit && weakestHabit.average === 0) {
    tomorrowFocus = `Give ${weakestHabit.label.toLowerCase()} a small non-zero win tomorrow.`;
  } else if (momentum.consistencyRate < 0.6) {
    tomorrowFocus = 'Aim for a simple full-day show-up before chasing intensity.';
  } else if (weakestHabit) {
    tomorrowFocus = `Tighten ${weakestHabit.label.toLowerCase()} while keeping the current rhythm.`;
  }

  return {
    dataThroughDate: momentum.endDate,
    headline,
    insights: [
      consistencyLine,
      habitLine,
      recoveryLine,
      `Average habits done per day sits at ${momentum.averageScore.toFixed(1)}.`,
    ],
    tomorrowFocus,
  };
}

export function buildDisciplineDashboardModel(
  trendPoints: readonly DisciplineTrendPoint[],
  options: DisciplineDashboardModelOptions = {},
): DisciplineDashboardModel {
  const dataThroughDate = resolveWindowEndDate(
    trendPoints,
    options.dataThroughDate,
    options.referenceDate,
  );
  const momentumDays = resolveWindowDays(options.momentumDays, DEFAULT_MOMENTUM_DAYS);
  const heatmapDays = resolveWindowDays(options.heatmapDays, DEFAULT_HEATMAP_DAYS);
  const habitTrendDays = resolveWindowDays(options.habitTrendDays, DEFAULT_HEATMAP_DAYS);
  const habitOptions = { habits: options.habits };

  return {
    dataThroughDate,
    momentum: buildSevenDayMomentumSummary(trendPoints, {
      endDate: dataThroughDate,
      days: momentumDays,
      referenceDate: options.referenceDate,
      ...habitOptions,
    }),
    heatmap: buildThirtyDayHeatmapCells(trendPoints, {
      endDate: dataThroughDate,
      days: heatmapDays,
      referenceDate: options.referenceDate,
      ...habitOptions,
    }),
    habitTrends: buildHabitTrendSummaries(trendPoints, {
      endDate: dataThroughDate,
      days: habitTrendDays,
      referenceDate: options.referenceDate,
      ...habitOptions,
    }),
    insights: buildHermesInsightPanel(trendPoints, {
      endDate: dataThroughDate,
      days: momentumDays,
      referenceDate: options.referenceDate,
      ...habitOptions,
    }),
  };
}

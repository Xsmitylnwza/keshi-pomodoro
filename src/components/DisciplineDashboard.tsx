import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
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
  type DisciplineExerciseEntry,
  type DisciplineReviewPayload,
  type DisciplineScoreKey,
  type DisciplineTrendPoint,
  addDisciplineExercise,
  addDisciplineReading,
  fetchDisciplineReview,
  fetchDisciplineTrend,
  saveDisciplineScores,
} from '../lib/disciplineApi';

const SCORE_MAX = 10;
const TREND_OPTIONS = [7, 30] as const;

type ScoreDraft = Record<DisciplineScoreKey, number>;

const SCORE_META: Record<DisciplineScoreKey, {
  icon: LucideIcon;
  accent: string;
  track: string;
  fill: string;
}> = {
  deep_work: {
    icon: BarChart3,
    accent: 'border-accent-red text-accent-red',
    track: 'bg-accent-red/15',
    fill: 'bg-accent-red',
  },
  reading: {
    icon: BookOpen,
    accent: 'border-amber-400 text-amber-300',
    track: 'bg-amber-400/15',
    fill: 'bg-amber-400',
  },
  exercise: {
    icon: Dumbbell,
    accent: 'border-accent-green text-accent-green',
    track: 'bg-accent-green/15',
    fill: 'bg-accent-green',
  },
  sleep: {
    icon: Moon,
    accent: 'border-sky-400 text-sky-300',
    track: 'bg-sky-400/15',
    fill: 'bg-sky-400',
  },
  nutrition: {
    icon: Apple,
    accent: 'border-lime-400 text-lime-300',
    track: 'bg-lime-400/15',
    fill: 'bg-lime-400',
  },
  discipline: {
    icon: BadgeCheck,
    accent: 'border-white/80 text-white',
    track: 'bg-white/10',
    fill: 'bg-white',
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
  pomodoro_started: 'border-accent-green/30 bg-accent-green/10 text-accent-green',
  pomodoro_paused: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  pomodoro_resumed: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  pomodoro_cancelled: 'border-white/20 bg-white/5 text-white/70',
  pomodoro_completed: 'border-accent-red/30 bg-accent-red/10 text-accent-red',
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const toDateKey = (date: Date) => date.toISOString().slice(0, 10);
const shiftDateKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};
const formatDateLabel = (dateKey: string) => {
  if (dateKey === todayKey()) return 'Today';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const formatLongDate = (dateKey: string) => new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const formatDateTime = (value: string) => new Date(value).toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const createEmptyScores = (): ScoreDraft => Object.fromEntries(
  DISCIPLINE_SCORE_BLOCKS.map(block => [block.key, 0]),
) as ScoreDraft;
const normalizeScores = (scores?: Record<string, number> | null): ScoreDraft => {
  const next = createEmptyScores();
  for (const block of DISCIPLINE_SCORE_BLOCKS) {
    const value = Number(scores?.[block.key] ?? 0);
    next[block.key] = Number.isFinite(value) ? Math.min(SCORE_MAX, Math.max(0, value)) : 0;
  }
  return next;
};

interface DisciplineDashboardProps {
  onNavigateHome: () => void;
}

export function DisciplineDashboard({ onNavigateHome }: DisciplineDashboardProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [review, setReview] = useState<DisciplineReviewPayload | null>(null);
  const [trend, setTrend] = useState<DisciplineTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>(createEmptyScores());
  const [scoreNotes, setScoreNotes] = useState('');
  const [isSavingScores, setIsSavingScores] = useState(false);
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

  const loadData = useCallback(async (date = selectedDate, days = rangeDays) => {
    setLoading(true);
    setError(null);

    try {
      const [reviewPayload, trendPayload] = await Promise.all([
        fetchDisciplineReview(date),
        fetchDisciplineTrend(days, date),
      ]);

      setReview(reviewPayload);
      setTrend(trendPayload.trend);
      setScoreDraft(normalizeScores(reviewPayload.score?.scores));
      setScoreNotes(reviewPayload.score?.notes ?? '');
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unable to load discipline data';
      setError(message);
      setReview(null);
      setTrend([]);
      setScoreDraft(createEmptyScores());
      setScoreNotes('');
    } finally {
      setLoading(false);
    }
  }, [rangeDays, selectedDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setStatusMessage(null);
    setStatusTone('idle');
  }, [selectedDate, rangeDays]);

  const scoreStats = useMemo(() => {
    const scores = review?.score?.scores ?? scoreDraft;
    const values = DISCIPLINE_SCORE_BLOCKS.map(block => Number(scores[block.key] ?? 0));
    const total = review?.score?.total ?? values.reduce((sum, value) => sum + value, 0);
    const average = review?.score?.average ?? (values.length ? Number((total / values.length).toFixed(2)) : 0);
    const max = DISCIPLINE_SCORE_BLOCKS.length * SCORE_MAX;
    const completed = values.filter(value => value > 0).length;
    return { total, average, max, completed };
  }, [review, scoreDraft]);

  const summary = useMemo(() => {
    const pomodoros = review?.pomodoros ?? [];
    const reading = review?.reading ?? [];
    const exercise = review?.exercise ?? [];
    const events = review?.events ?? [];
    const totalReadingPages = reading.reduce((sum, entry) => sum + Number(entry.pages || 0), 0);
    const totalExerciseMinutes = exercise.reduce((sum, entry) => sum + Number(entry.durationMinutes || 0), 0);
    const totalPomodoroMinutes = pomodoros.reduce((sum, entry) => sum + Number(entry.durationMinutes || 0), 0);
    const eventCounts = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.type] = (acc[event.type] ?? 0) + 1;
      return acc;
    }, {});
    const topTask = pomodoros.reduce<Record<string, number>>((acc, session) => {
      const title = session.taskTitle || 'Unassigned';
      acc[title] = (acc[title] ?? 0) + 1;
      return acc;
    }, {});
    const topTaskLabel = Object.entries(topTask).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'None';

    return {
      readingCount: reading.length,
      exerciseCount: exercise.length,
      pomodoroCount: pomodoros.length,
      eventCount: events.length,
      totalReadingPages,
      totalExerciseMinutes,
      totalPomodoroMinutes,
      eventCounts,
      topTaskLabel,
    };
  }, [review]);

  const trendMax = useMemo(() => {
    const highestAverage = trend.reduce((max, point) => Math.max(max, point.average), 0);
    return Math.max(highestAverage, 10);
  }, [trend]);

  const handleSaveScores = async () => {
    setIsSavingScores(true);
    setStatusMessage(null);
    try {
      await saveDisciplineScores(selectedDate, scoreDraft, scoreNotes.trim());
      setStatusTone('success');
      setStatusMessage('Scores saved');
      await loadData(selectedDate, rangeDays);
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
      setStatusTone('success');
      setStatusMessage('Reading logged');
      await loadData(selectedDate, rangeDays);
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
      setStatusTone('success');
      setStatusMessage('Exercise logged');
      await loadData(selectedDate, rangeDays);
    } catch (saveError) {
      setStatusTone('error');
      setStatusMessage(saveError instanceof Error ? saveError.message : 'Unable to save exercise');
    } finally {
      setSavingExercise(false);
    }
  };

  const selectedDateLabel = selectedDate === todayKey() ? 'Today' : formatLongDate(selectedDate);

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg-dark text-paper-cream">
      <CustomCursor />
      <div className="noise-overlay" />

      <header className="sticky top-0 z-20 border-b-2 border-white/10 bg-bg-dark/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onNavigateHome}
                className="inline-flex items-center gap-2 border-2 border-white/15 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-white/75 transition-colors hover:border-white/50 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={3} />
                Pomodoro
              </button>
              <span className="inline-flex items-center gap-2 border-2 border-accent-green/30 bg-accent-green/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-accent-green">
                <BarChart3 className="h-4 w-4" strokeWidth={3} />
                Discipline
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-grotesk text-3xl font-black uppercase tracking-tight sm:text-4xl">Dashboard</h1>
              <span className="text-xs font-mono uppercase tracking-[0.25em] text-white/35">
                {selectedDateLabel}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center border-2 border-white/12 bg-white/[0.04]">
              <button
                onClick={() => setSelectedDate(prev => shiftDateKey(prev, -1))}
                className="grid h-10 w-10 place-items-center border-r border-white/10 text-white/55 transition-colors hover:text-white"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={3} />
              </button>
              <button
                onClick={() => setSelectedDate(todayKey())}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] transition-colors ${selectedDate === todayKey() ? 'text-accent-green' : 'text-white/65 hover:text-white'}`}
              >
                Today
              </button>
              <button
                onClick={() => setSelectedDate(prev => shiftDateKey(prev, 1))}
                className="grid h-10 w-10 place-items-center border-l border-white/10 text-white/55 transition-colors hover:text-white"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>

            <label className="flex h-10 items-center border-2 border-white/12 bg-white/[0.04] px-3">
              <CalendarDays className="mr-2 h-4 w-4 text-white/45" strokeWidth={3} />
              <input
                type="date"
                value={selectedDate}
                onChange={event => setSelectedDate(event.target.value)}
                className="bg-transparent text-xs font-mono uppercase tracking-[0.18em] text-white/80 outline-none"
              />
            </label>

            <div className="flex items-center border-2 border-white/12 bg-white/[0.04]">
              {TREND_OPTIONS.map(days => (
                <button
                  key={days}
                  onClick={() => setRangeDays(days)}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] transition-colors ${rangeDays === days ? 'bg-white text-black' : 'text-white/55 hover:text-white'}`}
                >
                  {days}d
                </button>
              ))}
            </div>

            <button
              onClick={() => void loadData()}
              className="inline-flex h-10 items-center gap-2 border-2 border-white/15 bg-white/[0.04] px-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/65 transition-colors hover:border-white/45 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={3} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-5 pb-10">
        <AnimatePresence>
          {(statusMessage || error) && (
            <motion.div
              className={`mb-5 border-2 px-4 py-3 text-sm font-medium ${error ? 'border-accent-red/40 bg-accent-red/10 text-accent-red' : statusTone === 'success' ? 'border-accent-green/40 bg-accent-green/10 text-accent-green' : 'border-white/15 bg-white/[0.04] text-white/70'}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {error || statusMessage}
            </motion.div>
          )}
        </AnimatePresence>

        <section className="border-y-2 border-white/10 py-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={TrendingUp} label="Average" value={`${scoreStats.average.toFixed(1)}/10`} tone="text-accent-green" />
            <StatCard icon={Flame} label="Streak" value={`${review?.streak.current ?? 0}`} tone="text-accent-red" />
            <StatCard icon={Clock3} label="Pomodoros" value={`${summary.pomodoroCount}`} tone="text-white" />
            <StatCard icon={BarChart3} label="Total" value={`${scoreStats.total}/${scoreStats.max}`} tone="text-amber-300" />
          </div>
        </section>

        <section className="border-b-2 border-white/10 py-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.28em] text-white/45">Scores</h2>
            </div>
            <button
              onClick={() => void handleSaveScores()}
              disabled={isSavingScores}
              className="inline-flex items-center gap-2 border-2 border-accent-green/40 bg-accent-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-black transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ boxShadow: '4px 4px 0 rgba(0,0,0,1)' }}
            >
              {isSavingScores ? <RotateCcw className="h-4 w-4 animate-spin" strokeWidth={3} /> : <Plus className="h-4 w-4" strokeWidth={3} />}
              Save Scores
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {DISCIPLINE_SCORE_BLOCKS.map(block => {
              const meta = SCORE_META[block.key];
              const Icon = meta.icon;
              const value = scoreDraft[block.key];
              return (
                <div key={block.key} className={`border-2 ${meta.accent} bg-black/[0.18] p-4 shadow-[5px_5px_0_rgba(0,0,0,0.8)]`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={3} />
                        <span className="text-[10px] font-black uppercase tracking-[0.24em]">{block.label}</span>
                      </div>
                      <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/35">0 to {SCORE_MAX}</div>
                    </div>
                    <div className="text-3xl font-black leading-none text-white">{value}</div>
                  </div>

                  <div className={`mt-4 h-2 w-full overflow-hidden border border-white/10 ${meta.track}`}>
                    <div
                      className={`h-full ${meta.fill}`}
                      style={{ width: `${(value / SCORE_MAX) * 100}%` }}
                    />
                  </div>

                  <input
                    type="range"
                    min="0"
                    max={SCORE_MAX}
                    step="1"
                    value={value}
                    onChange={event => setScoreDraft(prev => ({ ...prev, [block.key]: Number(event.target.value) }))}
                    className="mt-4 w-full accent-current"
                    style={{ accentColor: 'currentColor' }}
                  />
                </div>
              );
            })}
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-white/45">Score notes</span>
            <textarea
              value={scoreNotes}
              onChange={event => setScoreNotes(event.target.value)}
              rows={3}
              className="w-full border-2 border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white/80 outline-none placeholder:text-white/25 focus:border-white/35"
              placeholder="Notes..."
            />
          </label>
        </section>

        <section className="border-b-2 border-white/10 py-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.28em] text-white/45">Trend</h2>
            </div>
            <div className="text-xs font-mono uppercase tracking-[0.24em] text-white/35">
              {trend.length} days
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max items-end gap-3">
              {trend.map(point => {
                const height = trendMax > 0 ? Math.max(12, Math.round((point.average / trendMax) * 160)) : 12;
                return (
                  <div key={point.date} className="flex w-16 flex-col items-center gap-2">
                    <div className="flex h-44 w-full items-end border-2 border-white/10 bg-white/[0.03] p-1">
                      <div
                        className={`w-full ${point.date === selectedDate ? 'bg-accent-green' : 'bg-white/45'}`}
                        style={{ height }}
                        title={`${point.date} · ${point.average.toFixed(1)}`}
                      />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                      {formatDateLabel(point.date)}
                    </div>
                    <div className="text-[10px] font-mono text-white/35">
                      {point.average.toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-6 border-b-2 border-white/10 py-6 xl:grid-cols-2">
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.28em] text-white/45">Reading</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={readingTitle}
                onChange={event => setReadingTitle(event.target.value)}
                className="border-2 border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
                placeholder="Title"
              />
              <input
                type="number"
                min="0"
                value={readingPages}
                onChange={event => setReadingPages(event.target.value)}
                className="border-2 border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
                placeholder="Pages"
              />
              <input
                type="number"
                min="0"
                value={readingMinutes}
                onChange={event => setReadingMinutes(event.target.value)}
                className="border-2 border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
                placeholder="Minutes"
              />
              <input
                value={readingNotes}
                onChange={event => setReadingNotes(event.target.value)}
                className="border-2 border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
                placeholder="Notes"
              />
            </div>

            <button
              onClick={() => void handleSaveReading()}
              disabled={savingReading}
              className="inline-flex items-center gap-2 border-2 border-amber-400/40 bg-amber-400 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-black transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ boxShadow: '4px 4px 0 rgba(0,0,0,1)' }}
            >
              {savingReading ? <RotateCcw className="h-4 w-4 animate-spin" strokeWidth={3} /> : <Plus className="h-4 w-4" strokeWidth={3} />}
              Add Reading
            </button>

            <div className="space-y-2">
              {(review?.reading ?? []).slice(0, 5).map(entry => (
                <div key={entry.id} className="border-2 border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black uppercase tracking-[0.18em]">{entry.title || 'Untitled'}</div>
                      <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.18em] text-white/35">
                        {entry.pages} pages · {entry.minutes} min · {formatDateTime(entry.createdAt)}
                      </div>
                    </div>
                  </div>
                  {entry.notes && <div className="mt-2 text-sm text-white/65">{entry.notes}</div>}
                </div>
              ))}
              {(review?.reading?.length ?? 0) === 0 && !loading && (
                <div className="border-2 border-dashed border-white/10 px-4 py-6 text-sm text-white/35">
                  No reading logged.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.28em] text-white/45">Exercise</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={exerciseType}
                onChange={event => setExerciseType(event.target.value)}
                className="border-2 border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
                placeholder="Type"
              />
              <input
                type="number"
                min="0"
                value={exerciseDuration}
                onChange={event => setExerciseDuration(event.target.value)}
                className="border-2 border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
                placeholder="Minutes"
              />
              <input
                value={exerciseIntensity}
                onChange={event => setExerciseIntensity(event.target.value)}
                className="border-2 border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
                placeholder="Intensity"
              />
              <input
                value={exerciseNotes}
                onChange={event => setExerciseNotes(event.target.value)}
                className="border-2 border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35"
                placeholder="Notes"
              />
            </div>

            <button
              onClick={() => void handleSaveExercise()}
              disabled={savingExercise}
              className="inline-flex items-center gap-2 border-2 border-accent-green/40 bg-accent-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-black transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ boxShadow: '4px 4px 0 rgba(0,0,0,1)' }}
            >
              {savingExercise ? <RotateCcw className="h-4 w-4 animate-spin" strokeWidth={3} /> : <Plus className="h-4 w-4" strokeWidth={3} />}
              Add Exercise
            </button>

            <div className="space-y-2">
              {(review?.exercise ?? []).slice(0, 5).map(entry => (
                <ExerciseRow key={entry.id} entry={entry} />
              ))}
              {(review?.exercise?.length ?? 0) === 0 && !loading && (
                <div className="border-2 border-dashed border-white/10 px-4 py-6 text-sm text-white/35">
                  No exercise logged.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 py-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.28em] text-white/45">Pomodoros</h2>
            </div>

            <div className="space-y-2">
              {(review?.pomodoros ?? []).slice(0, 6).map(session => (
                <div key={session.id} className="border-2 border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black uppercase tracking-[0.18em]">
                        {session.taskTitle || 'Unassigned'}
                      </div>
                      <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.18em] text-white/35">
                        {formatDateTime(session.completedAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black">{session.durationMinutes}</div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">min</div>
                    </div>
                  </div>
                </div>
              ))}
              {(review?.pomodoros?.length ?? 0) === 0 && !loading && (
                <div className="border-2 border-dashed border-white/10 px-4 py-6 text-sm text-white/35">
                  No pomodoros for this day.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.28em] text-white/45">Events</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.eventCounts).map(([type, count]) => {
                const EventIcon = EVENT_ICON[type as keyof typeof EVENT_ICON] ?? Play;
                return (
                  <div key={type} className={`inline-flex items-center gap-2 border-2 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] ${EVENT_STYLES[type as keyof typeof EVENT_STYLES] ?? 'border-white/10 bg-white/[0.03] text-white/70'}`}>
                    <EventIcon className="h-3.5 w-3.5" strokeWidth={3} />
                    {type.replace('pomodoro_', '')}
                    <span className="text-white/45">{count}</span>
                  </div>
                );
              })}
              {summary.eventCount === 0 && (
                <div className="border-2 border-dashed border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                  No events
                </div>
              )}
            </div>

            <div className="space-y-2">
              {(review?.events ?? []).slice(0, 8).map(event => {
                const EventIcon = EVENT_ICON[event.type];
                return (
                  <div key={event.id} className={`flex items-start justify-between gap-3 border-2 px-3 py-3 ${EVENT_STYLES[event.type]}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <EventIcon className="h-4 w-4 shrink-0" strokeWidth={3} />
                        <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                          {event.type.replace('pomodoro_', '')}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-sm font-black uppercase tracking-[0.16em]">
                        {event.taskTitle || 'Unassigned'}
                      </div>
                      <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.18em] opacity-60">
                        {formatDateTime(event.createdAt)}
                      </div>
                    </div>
                    <div className="text-right text-[10px] font-mono uppercase tracking-[0.18em] opacity-80">
                      <div>{event.elapsedSeconds}s</div>
                      <div>{event.remainingSeconds}s left</div>
                    </div>
                  </div>
                );
              })}
              {(review?.events?.length ?? 0) === 0 && !loading && (
                <div className="border-2 border-dashed border-white/10 px-4 py-6 text-sm text-white/35">
                  No events captured.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="border-t-2 border-white/10 py-5 text-[10px] font-mono uppercase tracking-[0.24em] text-white/30">
          <div className="flex flex-wrap items-center gap-3">
            <span>Generated {review?.generatedAt ? formatDateTime(review.generatedAt) : '—'}</span>
            <span>Review date {selectedDateLabel}</span>
            <span>{loading ? 'Loading' : 'Ready'}</span>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="border-2 border-white/10 bg-white/[0.03] px-4 py-4 shadow-[4px_4px_0_rgba(0,0,0,0.75)]">
      <div className="flex items-center gap-2 text-white/40">
        <Icon className={`h-4 w-4 ${tone}`} strokeWidth={3} />
        <span className="text-[10px] font-black uppercase tracking-[0.24em]">{label}</span>
      </div>
      <div className={`mt-3 text-3xl font-black leading-none ${tone}`}>{value}</div>
    </div>
  );
}

function ExerciseRow({ entry }: { entry: DisciplineExerciseEntry }) {
  return (
    <div className="border-2 border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black uppercase tracking-[0.18em]">{entry.type || 'Exercise'}</div>
          <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.18em] text-white/35">
            {entry.intensity || '—'} · {formatDateTime(entry.createdAt)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black">{entry.durationMinutes}</div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">min</div>
        </div>
      </div>
      {entry.notes && <div className="mt-2 text-sm text-white/65">{entry.notes}</div>}
    </div>
  );
}

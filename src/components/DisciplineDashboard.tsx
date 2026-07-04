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
  pomodoro_started: 'border-accent-green/20 bg-accent-green/5 text-accent-green',
  pomodoro_paused: 'border-amber-400/20 bg-amber-400/5 text-amber-400',
  pomodoro_resumed: 'border-sky-400/20 bg-sky-400/5 text-sky-400',
  pomodoro_cancelled: 'border-white/10 bg-white/5 text-white/60',
  pomodoro_completed: 'border-accent-red/20 bg-accent-red/5 text-accent-red',
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
  
  // UI States for Expandable Forms
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
      setIsAddingReading(false);
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
      setIsAddingExercise(false);
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
      
      {/* Background gradients for premium feel */}
      <div className="absolute top-0 left-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-green/10 blur-[120px]" />
      <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] translate-x-1/2 translate-y-1/2 rounded-full bg-amber-400/5 blur-[120px]" />

      <header className="sticky top-0 z-20 border-b border-white/5 bg-bg-dark/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onNavigateHome}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold tracking-wider text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={3} />
                Pomodoro
              </button>
              <span className="inline-flex items-center gap-2 rounded-lg border border-accent-green/20 bg-accent-green/10 px-4 py-2 text-xs font-semibold tracking-wider text-accent-green">
                <BarChart3 className="h-4 w-4" strokeWidth={3} />
                Discipline
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-grotesk text-3xl font-black tracking-tight sm:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                Dashboard
              </h1>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                {selectedDateLabel}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-1 backdrop-blur-sm">
              <button
                onClick={() => setSelectedDate(prev => shiftDateKey(prev, -1))}
                className="grid h-8 w-8 place-items-center rounded-md text-white/55 transition-all hover:bg-white/10 hover:text-white"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={3} />
              </button>
              <button
                onClick={() => setSelectedDate(todayKey())}
                className={`rounded-md px-4 py-1.5 text-xs font-bold tracking-wider transition-all ${selectedDate === todayKey() ? 'bg-accent-green/20 text-accent-green' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}
              >
                Today
              </button>
              <button
                onClick={() => setSelectedDate(prev => shiftDateKey(prev, 1))}
                className="grid h-8 w-8 place-items-center rounded-md text-white/55 transition-all hover:bg-white/10 hover:text-white"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>

            <label className="flex h-10 items-center rounded-lg border border-white/10 bg-white/5 px-3 transition-colors hover:border-white/20 backdrop-blur-sm">
              <CalendarDays className="mr-2 h-4 w-4 text-white/45" strokeWidth={3} />
              <input
                type="date"
                value={selectedDate}
                onChange={event => setSelectedDate(event.target.value)}
                className="bg-transparent text-xs font-semibold uppercase tracking-wider text-white/80 outline-none"
              />
            </label>

            <button
              onClick={() => void loadData()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-xs font-semibold tracking-wider text-white/70 transition-all hover:bg-white/10 hover:text-white backdrop-blur-sm"
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
              className={`mb-6 rounded-xl border p-4 text-sm font-medium shadow-lg backdrop-blur-md ${error ? 'border-accent-red/40 bg-accent-red/10 text-accent-red' : statusTone === 'success' ? 'border-accent-green/40 bg-accent-green/10 text-accent-green' : 'border-white/15 bg-white/[0.04] text-white/70'}`}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
            >
              <div className="flex items-center gap-2">
                {error ? <X className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
                {error || statusMessage}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TOP SECTION: Stats & Trend Overview */}
        <section className="mb-10 grid gap-6 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_500px]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            <StatCard icon={TrendingUp} label="Average Score" value={`${scoreStats.average.toFixed(1)}/10`} tone="text-accent-green" />
            <StatCard icon={Flame} label="Current Streak" value={`${review?.streak.current ?? 0} days`} tone="text-accent-red" />
            <StatCard icon={Clock3} label="Pomodoros" value={`${summary.pomodoroCount}`} tone="text-white" />
            <StatCard icon={BarChart3} label="Total Points" value={`${scoreStats.total}/${scoreStats.max}`} tone="text-amber-400" />
          </div>
          
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h2 className="bg-gradient-to-r from-white to-white/50 bg-clip-text text-sm font-bold tracking-widest text-transparent">
                SCORE TREND
              </h2>
              <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-1">
                {TREND_OPTIONS.map(days => (
                  <button
                    key={days}
                    onClick={() => setRangeDays(days)}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${rangeDays === days ? 'bg-white text-black shadow-sm' : 'text-white/55 hover:bg-white/10 hover:text-white'}`}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex h-40 items-end justify-between gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {trend.map(point => {
                const height = trendMax > 0 ? Math.max(12, Math.round((point.average / trendMax) * 140)) : 12;
                return (
                  <div key={point.date} className="group relative flex w-full min-w-[24px] flex-col items-center justify-end">
                    {/* Tooltip */}
                    <div className="absolute -top-10 scale-0 opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100 bg-white text-black text-xs font-bold px-2 py-1 rounded-md z-10 whitespace-nowrap">
                      {point.average.toFixed(1)}
                    </div>
                    <div
                      className={`w-full rounded-md transition-all duration-500 ${point.date === selectedDate ? 'bg-accent-green shadow-[0_0_15px_rgba(52,211,153,0.5)]' : 'bg-white/20 group-hover:bg-white/40'}`}
                      style={{ height }}
                    />
                    <div className={`mt-2 text-[10px] font-semibold tracking-wider ${point.date === selectedDate ? 'text-white' : 'text-white/40'}`}>
                      {new Date(`${point.date}T12:00:00`).getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* MIDDLE SECTION: Daily Reflection (Scores) */}
        <section className="mb-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="bg-gradient-to-r from-white to-white/50 bg-clip-text text-sm font-bold tracking-widest text-transparent uppercase">
              Daily Reflection
            </h2>
            <button
              onClick={() => void handleSaveScores()}
              disabled={isSavingScores}
              className="group inline-flex items-center gap-2 rounded-xl bg-accent-green px-5 py-2.5 text-xs font-bold tracking-wider text-black shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(52,211,153,0.5)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingScores ? <RotateCcw className="h-4 w-4 animate-spin" strokeWidth={2.5} /> : <BadgeCheck className="h-4 w-4" strokeWidth={2.5} />}
              Save Scores
            </button>
          </div>
          
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-1 backdrop-blur-md">
            <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
              <div className="p-5 flex flex-col gap-5">
                {DISCIPLINE_SCORE_BLOCKS.slice(0, 3).map(block => (
                  <ScoreRow 
                    key={block.key} 
                    block={block} 
                    value={scoreDraft[block.key]} 
                    onChange={(val) => setScoreDraft(prev => ({ ...prev, [block.key]: val }))} 
                  />
                ))}
              </div>
              <div className="p-5 flex flex-col gap-5">
                {DISCIPLINE_SCORE_BLOCKS.slice(3, 6).map(block => (
                  <ScoreRow 
                    key={block.key} 
                    block={block} 
                    value={scoreDraft[block.key]} 
                    onChange={(val) => setScoreDraft(prev => ({ ...prev, [block.key]: val }))} 
                  />
                ))}
              </div>
            </div>
            
            <div className="border-t border-white/5 p-5">
              <textarea
                value={scoreNotes}
                onChange={event => setScoreNotes(event.target.value)}
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none backdrop-blur-sm transition-colors placeholder:text-white/30 focus:border-white/30 focus:bg-white/10"
                placeholder="Write any thoughts, blockers, or reflection for today..."
              />
            </div>
          </div>
        </section>

        {/* BOTTOM SECTION: Activities Grid */}
        <section className="grid gap-8 lg:grid-cols-2">
          
          {/* Left Column: Reading & Exercise Logs */}
          <div className="space-y-8">
            {/* Reading Block */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="bg-gradient-to-r from-white to-white/50 bg-clip-text text-sm font-bold tracking-widest text-transparent uppercase">
                  Reading Log
                </h2>
                {!isAddingReading && (
                  <button 
                    onClick={() => setIsAddingReading(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                )}
              </div>
              
              <AnimatePresence>
                {isAddingReading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 backdrop-blur-md"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={readingTitle}
                        onChange={event => setReadingTitle(event.target.value)}
                        className="col-span-1 sm:col-span-2 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-400/50"
                        placeholder="Book Title or Article"
                      />
                      <input
                        type="number"
                        min="0"
                        value={readingPages}
                        onChange={event => setReadingPages(event.target.value)}
                        className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-400/50"
                        placeholder="Pages read"
                      />
                      <input
                        type="number"
                        min="0"
                        value={readingMinutes}
                        onChange={event => setReadingMinutes(event.target.value)}
                        className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-400/50"
                        placeholder="Minutes spent"
                      />
                      <input
                        value={readingNotes}
                        onChange={event => setReadingNotes(event.target.value)}
                        className="col-span-1 sm:col-span-2 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-400/50"
                        placeholder="Key takeaways..."
                      />
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                      <button 
                        onClick={() => setIsAddingReading(false)}
                        className="px-4 py-2 text-xs font-semibold text-white/50 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => void handleSaveReading()}
                        disabled={savingReading}
                        className="group inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2 text-xs font-bold tracking-wider text-black shadow-[0_0_15px_rgba(251,191,36,0.3)] transition-all hover:shadow-[0_0_20px_rgba(251,191,36,0.5)] disabled:opacity-50"
                      >
                        {savingReading ? <RotateCcw className="h-4 w-4 animate-spin" /> : 'Save Reading'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                {(review?.reading ?? []).slice(0, 5).map(entry => (
                  <div key={entry.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.04]">
                    <div className="flex items-start justify-between gap-3 relative z-10">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold tracking-wide text-white/90">{entry.title || 'Untitled'}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-white/40">
                          <span className="rounded-md bg-white/[0.05] px-2 py-1 text-amber-400/70">{entry.pages} pages</span>
                          <span className="rounded-md bg-white/[0.05] px-2 py-1 text-amber-400/70">{entry.minutes} min</span>
                          <span className="opacity-50">·</span>
                          <span className="opacity-70">{formatDateTime(entry.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    {entry.notes && (
                      <div className="relative z-10 mt-3 rounded-lg bg-black/20 p-3 text-sm leading-relaxed text-white/70">
                        {entry.notes}
                      </div>
                    )}
                  </div>
                ))}
                {(review?.reading?.length ?? 0) === 0 && !loading && !isAddingReading && (
                  <EmptyState icon={BookOpen} message="No reading logged today." onAction={() => setIsAddingReading(true)} actionText="Log Reading" tone="hover:text-amber-400 hover:border-amber-400/30" />
                )}
              </div>
            </div>

            {/* Exercise Block */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="bg-gradient-to-r from-white to-white/50 bg-clip-text text-sm font-bold tracking-widest text-transparent uppercase">
                  Exercise Log
                </h2>
                {!isAddingExercise && (
                  <button 
                    onClick={() => setIsAddingExercise(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold text-accent-green hover:text-green-400 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                )}
              </div>
              
              <AnimatePresence>
                {isAddingExercise && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 rounded-2xl border border-accent-green/20 bg-accent-green/5 p-4 backdrop-blur-md"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={exerciseType}
                        onChange={event => setExerciseType(event.target.value)}
                        className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-accent-green/50"
                        placeholder="Workout type (e.g. Cardio)"
                      />
                      <input
                        type="number"
                        min="0"
                        value={exerciseDuration}
                        onChange={event => setExerciseDuration(event.target.value)}
                        className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-accent-green/50"
                        placeholder="Duration (minutes)"
                      />
                      <input
                        value={exerciseIntensity}
                        onChange={event => setExerciseIntensity(event.target.value)}
                        className="col-span-1 sm:col-span-2 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-accent-green/50"
                        placeholder="Intensity (Low, Medium, High)"
                      />
                      <input
                        value={exerciseNotes}
                        onChange={event => setExerciseNotes(event.target.value)}
                        className="col-span-1 sm:col-span-2 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-accent-green/50"
                        placeholder="Workout notes..."
                      />
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                      <button 
                        onClick={() => setIsAddingExercise(false)}
                        className="px-4 py-2 text-xs font-semibold text-white/50 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => void handleSaveExercise()}
                        disabled={savingExercise}
                        className="group inline-flex items-center gap-2 rounded-xl bg-accent-green px-5 py-2 text-xs font-bold tracking-wider text-black shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all hover:shadow-[0_0_20px_rgba(52,211,153,0.5)] disabled:opacity-50"
                      >
                        {savingExercise ? <RotateCcw className="h-4 w-4 animate-spin" /> : 'Save Exercise'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                {(review?.exercise ?? []).slice(0, 5).map(entry => (
                  <div key={entry.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.04]">
                    <div className="relative z-10 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold tracking-wide text-white/90">{entry.type || 'Exercise'}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-white/40">
                          <span className="rounded-md bg-white/[0.05] px-2 py-1 text-accent-green/70">{entry.durationMinutes} min</span>
                          {entry.intensity && <span className="rounded-md bg-white/[0.05] px-2 py-1 text-white/60">{entry.intensity}</span>}
                          <span className="opacity-50">·</span>
                          <span className="opacity-70">{formatDateTime(entry.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    {entry.notes && (
                      <div className="relative z-10 mt-3 rounded-lg bg-black/20 p-3 text-sm leading-relaxed text-white/70">
                        {entry.notes}
                      </div>
                    )}
                  </div>
                ))}
                {(review?.exercise?.length ?? 0) === 0 && !loading && !isAddingExercise && (
                  <EmptyState icon={Dumbbell} message="No exercise logged today." onAction={() => setIsAddingExercise(true)} actionText="Log Exercise" tone="hover:text-accent-green hover:border-accent-green/30" />
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Pomodoros & Events Timeline */}
          <div className="space-y-8">
            {/* Pomodoros */}
            <div>
              <div className="mb-4">
                <h2 className="bg-gradient-to-r from-white to-white/50 bg-clip-text text-sm font-bold tracking-widest text-transparent uppercase">
                  Pomodoro Sessions
                </h2>
              </div>
              
              <div className="space-y-3">
                {(review?.pomodoros ?? []).slice(0, 5).map(session => (
                  <div key={session.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.04]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="rounded-full bg-white/5 p-2 text-white/40">
                          <Clock3 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold tracking-wide text-white/90">
                            {session.taskTitle || 'Deep Work Session'}
                          </div>
                          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                            {formatDateTime(session.completedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="text-xl font-bold text-white">{session.durationMinutes}<span className="text-[10px] text-white/40 ml-1">min</span></div>
                      </div>
                    </div>
                  </div>
                ))}
                {(review?.pomodoros?.length ?? 0) === 0 && !loading && (
                  <EmptyState icon={Clock3} message="No pomodoro sessions completed yet." />
                )}
              </div>
            </div>

            {/* Events Timeline */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="bg-gradient-to-r from-white to-white/50 bg-clip-text text-sm font-bold tracking-widest text-transparent uppercase">
                  Events Timeline
                </h2>
                <div className="flex gap-2">
                  {Object.entries(summary.eventCounts).slice(0,3).map(([type, count]) => {
                    const EventIcon = EVENT_ICON[type as keyof typeof EVENT_ICON] ?? Play;
                    return (
                      <div key={type} className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold tracking-wider ${EVENT_STYLES[type as keyof typeof EVENT_STYLES] ?? 'border-white/10 bg-white/[0.03] text-white/70'}`}>
                        <EventIcon className="h-3 w-3" strokeWidth={2.5} />
                        {count}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="space-y-3">
                {(review?.events ?? []).slice(0, 8).map(event => {
                  const EventIcon = EVENT_ICON[event.type] || Play;
                  const tagText = event.type.replace('pomodoro_', '');
                  return (
                    <div key={event.id} className={`group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border px-4 py-3 transition-all duration-300 hover:bg-white/[0.04] ${EVENT_STYLES[event.type]}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <EventIcon className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                              {tagText}
                            </span>
                            <span className="text-[10px] opacity-40">· {formatDateTime(event.createdAt)}</span>
                          </div>
                          <div className="truncate text-sm font-semibold tracking-wide mt-0.5 text-white/90">
                            {event.taskTitle || 'Unassigned Session'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(review?.events?.length ?? 0) === 0 && !loading && (
                  <EmptyState icon={Activity} message="No timeline events captured." />
                )}
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

// Subcomponents

function ScoreRow({ block, value, onChange }: { block: any, value: number, onChange: (val: number) => void }) {
  const meta = SCORE_META[block.key as DisciplineScoreKey];
  const Icon = meta.icon;
  return (
    <div className="group flex items-center gap-4">
      <div className={`rounded-xl p-3 shadow-inner ${meta.accent.replace('text-', 'bg-').replace('border-', '')} bg-opacity-10`}>
        <Icon className={`h-5 w-5 ${meta.accent.split(' ')[1]}`} strokeWidth={2.5} />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-end mb-2">
          <span className="text-sm font-semibold tracking-wider text-white/90">{block.label}</span>
          <span className="text-lg font-bold leading-none text-white">{value}<span className="text-[10px] text-white/30 ml-1">/10</span></span>
        </div>
        <div className="relative h-2 w-full rounded-full bg-white/5 overflow-hidden">
          <div 
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${meta.fill}`}
            style={{ width: `${(value / 10) * 100}%` }}
          />
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>
      </div>
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
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:bg-white/[0.04] group">
      <div className="absolute -right-4 -top-4 rounded-full bg-white/5 p-6 blur-3xl transition-all duration-500 group-hover:bg-white/10" />
      <div className="relative z-10 flex items-center gap-3 text-white/50">
        <div className={`rounded-xl bg-white/[0.05] p-2.5 ${tone} shadow-inner`}>
          <Icon className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <span className="text-[11px] font-semibold tracking-widest uppercase text-white/60">{label}</span>
      </div>
      <div className={`relative z-10 mt-5 text-3xl sm:text-4xl font-bold tracking-tight ${tone}`}>{value}</div>
    </div>
  );
}

// Need Activity icon from lucide for EmptyState
import { Activity } from 'lucide-react';

function EmptyState({ 
  icon: Icon, 
  message, 
  onAction, 
  actionText,
  tone = "hover:text-white hover:border-white/30"
}: { 
  icon: LucideIcon, 
  message: string, 
  onAction?: () => void, 
  actionText?: string,
  tone?: string
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-6 py-10 text-center transition-all ${onAction ? 'cursor-pointer ' + tone : ''}`} onClick={onAction}>
      <div className="rounded-full bg-white/5 p-3 mb-3 text-white/20">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-white/40">{message}</p>
      {onAction && actionText && (
        <span className="mt-2 text-xs font-semibold tracking-wider opacity-80">{actionText}</span>
      )}
    </div>
  );
}

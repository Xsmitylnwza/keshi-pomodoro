import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Apple,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  History as HistoryIcon,
  LogOut,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Settings2,
  Target,
  UserCircle,
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
import type { CentralAuthUser } from '../lib/centralAuth';

const SCORE_MAX = 10;
const DAY_SCORE_MAX = DISCIPLINE_SCORE_BLOCKS.length * SCORE_MAX;
const HEATMAP_DAYS = 30;
const CONSISTENCY_DAYS = 7;

type ScoreDraft = Record<DisciplineScoreKey, number>;

const SCORE_META: Record<
  DisciplineScoreKey,
  {
    icon: LucideIcon;
    accent: string;
    track: string;
    fill: string;
    tint: string;
  }
> = {
  deep_work: {
    icon: BarChart3,
    accent: 'text-accent-red',
    track: 'bg-accent-red/15',
    fill: 'bg-accent-red',
    tint: 'bg-accent-red/10',
  },
  reading: {
    icon: BookOpen,
    accent: 'text-amber-300',
    track: 'bg-amber-400/15',
    fill: 'bg-amber-400',
    tint: 'bg-amber-400/10',
  },
  exercise: {
    icon: Dumbbell,
    accent: 'text-accent-green',
    track: 'bg-accent-green/15',
    fill: 'bg-accent-green',
    tint: 'bg-accent-green/10',
  },
  sleep: {
    icon: Moon,
    accent: 'text-sky-300',
    track: 'bg-sky-400/15',
    fill: 'bg-sky-400',
    tint: 'bg-sky-400/10',
  },
  nutrition: {
    icon: Apple,
    accent: 'text-lime-300',
    track: 'bg-lime-400/15',
    fill: 'bg-lime-400',
    tint: 'bg-lime-400/10',
  },
  discipline: {
    icon: BadgeCheck,
    accent: 'text-white',
    track: 'bg-white/10',
    fill: 'bg-white',
    tint: 'bg-white/10',
  },
};

const EVENT_ICON: Record<DisciplineReviewPayload['events'][number]['type'], LucideIcon> = {
  pomodoro_started: Play,
  pomodoro_paused: Pause,
  pomodoro_resumed: RefreshCcw,
  pomodoro_cancelled: X,
  pomodoro_completed: CheckCircle2,
};

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

const scorePercent = (review: DisciplineReviewPayload | null) => {
  if (!review?.score) return null;
  return Math.round(Math.max(0, Math.min(1, review.score.total / DAY_SCORE_MAX)) * 100);
};

interface DisciplineDashboardProps {
  onNavigateHome: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenAnalytics: () => void;
  onLogout: () => void;
  user: CentralAuthUser | null;
  focusSessionMinutes: number;
}

export function DisciplineDashboard({
  onNavigateHome,
  onOpenSettings,
  onOpenHistory,
  onOpenAnalytics,
  onLogout,
  user,
  focusSessionMinutes,
}: DisciplineDashboardProps) {
  const [todayDate, setTodayDate] = useState(() => toDateKey(new Date()));
  const [dataThroughDate, setDataThroughDate] = useState(() => latestCompletedDateKey(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => latestCompletedDateKey(new Date()));
  const [todayReview, setTodayReview] = useState<DisciplineReviewPayload | null>(null);
  const [selectedReview, setSelectedReview] = useState<DisciplineReviewPayload | null>(null);
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
  const [statusTone, setStatusTone] = useState<'success' | 'error'>('success');
  const loadRequestRef = useRef(0);

  const loadData = useCallback(async (reviewDate: string, trendEndDate: string, liveDate: string) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    const clampedReviewDate = clampDateKey(reviewDate, trendEndDate);
    setLoading(true);
    setError(null);

    try {
      const selectedRequest = fetchDisciplineReview(clampedReviewDate);
      const todayRequest = clampedReviewDate === liveDate ? selectedRequest : fetchDisciplineReview(liveDate);
      const [reviewPayload, livePayload, trendPayload] = await Promise.all([
        selectedRequest,
        todayRequest,
        fetchDisciplineTrend(HEATMAP_DAYS, liveDate),
      ]);

      if (loadRequestRef.current !== requestId) return;

      setSelectedDate(clampedReviewDate);
      setSelectedReview(reviewPayload);
      setTodayReview(livePayload);
      setTrend(trendPayload.trend);
      setScoreDraft(normalizeScores(reviewPayload.score?.scores));
      setScoreNotes(reviewPayload.score?.notes ?? '');
    } catch (fetchError) {
      if (loadRequestRef.current !== requestId) return;
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to load discipline data');
    } finally {
      if (loadRequestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(selectedDate, dataThroughDate, todayDate);
  }, [dataThroughDate, loadData, selectedDate, todayDate]);

  useEffect(() => {
    setStatusMessage(null);
  }, [selectedDate]);

  const todaySummary = useMemo(() => summarizeReview(todayReview), [todayReview]);
  const selectedSummary = useMemo(() => summarizeReview(selectedReview), [selectedReview]);

  const taskProgress = todaySummary.taskCount
    ? Math.round((todaySummary.completedTasks / todaySummary.taskCount) * 100)
    : null;
  const todayScore = scorePercent(todayReview);
  const currentStreak = todayReview?.streak.current ?? todayReview?.streak.current_streak ?? selectedReview?.streak.current ?? 0;

  const nextTask = useMemo(() => {
    const tasks = [...(todayReview?.tasks ?? [])].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
    return tasks.find(task => task.status === 'doing') ?? tasks.find(task => task.status !== 'done') ?? null;
  }, [todayReview]);

  const dailyDirection = useMemo(() => {
    if (!todayReview) {
      return {
        shouldFocus: false,
        label: 'CHECKING TODAY',
        headline: 'Reading your current signal.',
        doCopy: 'Hold the next action until today is loaded.',
        stopCopy: 'Do not guess from an empty dashboard.',
        actionLabel: 'Back to Pomodoro',
      };
    }

    if (todaySummary.pomodoroCount === 0) {
      return {
        shouldFocus: true,
        label: 'MORE FOCUS TODAY / YES',
        headline: 'Start the first focused block.',
        doCopy: nextTask
          ? `Run one ${focusSessionMinutes}-minute session on “${nextTask.title}”.`
          : `Choose one outcome, then run one ${focusSessionMinutes}-minute session.`,
        stopCopy: 'Do not reorganize the whole list before the first block.',
        actionLabel: `Start ${focusSessionMinutes} min focus`,
      };
    }

    if (nextTask) {
      return {
        shouldFocus: true,
        label: 'MORE FOCUS TODAY / YES',
        headline: nextTask.status === 'doing' ? 'Finish what is already in motion.' : 'One useful block is still available.',
        doCopy: `Use the next ${focusSessionMinutes} minutes for “${nextTask.title}”.`,
        stopCopy: 'Stop after the block if the next outcome is not obvious.',
        actionLabel: 'Continue focused work',
      };
    }

    if (todaySummary.taskCount > 0) {
      return {
        shouldFocus: false,
        label: 'MORE FOCUS TODAY / NO',
        headline: 'Your planned work is complete.',
        doCopy: 'Close the loop and leave tomorrow easy to start.',
        stopCopy: 'Do not add work just to make today look fuller.',
        actionLabel: 'Return to Pomodoro',
      };
    }

    return {
      shouldFocus: false,
      label: 'MORE FOCUS TODAY / NOT YET',
      headline: 'Focused work is logged. The next outcome is unclear.',
      doCopy: 'Only start another block when you can name the result.',
      stopCopy: 'Do not begin a vague session for the sake of the streak.',
      actionLabel: 'Return to Pomodoro',
    };
  }, [focusSessionMinutes, nextTask, todayReview, todaySummary.pomodoroCount, todaySummary.taskCount]);

  const recentTrend = useMemo(() => trend.slice(-CONSISTENCY_DAYS), [trend]);
  const shownUpDays = recentTrend.filter(day => Number(day.total ?? 0) > 0 || Number(day.activity?.focusMinutes ?? 0) > 0).length;
  const consistencyScore = recentTrend.length ? Math.round((shownUpDays / recentTrend.length) * 100) : 0;
  const hasTrendHistory = trend.some(day => Number(day.total ?? 0) > 0 || Number(day.activity?.focusMinutes ?? 0) > 0);

  const habitSignals = useMemo(() => {
    if (!hasTrendHistory || recentTrend.length === 0) return { strongest: null, weakest: null };
    const averages = DISCIPLINE_SCORE_BLOCKS.map(block => ({
      key: block.key,
      label: block.label,
      average: recentTrend.reduce((sum, day) => sum + Number(day.scores?.[block.key] ?? 0), 0) / recentTrend.length,
    }));
    return {
      strongest: [...averages].sort((a, b) => b.average - a.average)[0] ?? null,
      weakest: [...averages].sort((a, b) => a.average - b.average)[0] ?? null,
    };
  }, [hasTrendHistory, recentTrend]);

  const selectedScoreStats = useMemo(() => {
    const values = DISCIPLINE_SCORE_BLOCKS.map(block => Number(scoreDraft[block.key] ?? 0));
    const total = selectedReview?.score?.total ?? values.reduce((sum, value) => sum + value, 0);
    return {
      total,
      average: values.length ? total / values.length : 0,
    };
  }, [scoreDraft, selectedReview]);

  const selectReviewDate = useCallback(
    (dateKey: string) => {
      if (!dateKey) return;
      const nextDate = clampDateKey(dateKey, dataThroughDate);
      if (nextDate === selectedDate) return;
      setSelectedReview(null);
      setScoreDraft(createEmptyScores());
      setScoreNotes('');
      setSelectedDate(nextDate);
    },
    [dataThroughDate, selectedDate],
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
      setStatusMessage('Daily score saved.');
      await loadData(selectedDate, dataThroughDate, todayDate);
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

      <header className="sticky top-0 z-[60] border-b border-white/10 bg-bg-dark/92 backdrop-blur-xl">
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
              <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={3} />
            </button>
            <AccountMenu
              user={user}
              onOpenSettings={onOpenSettings}
              onOpenHistory={onOpenHistory}
              onOpenAnalytics={onOpenAnalytics}
              onLogout={onLogout}
            />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6 pb-20 sm:px-6 sm:py-8">
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
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
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

        <section aria-labelledby="today-heading" aria-busy={initialLoading}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-accent-green">Today / {formatLongDate(todayDate)}</div>
              <h1 id="today-heading" className="mt-2 font-grotesk text-3xl font-black leading-none tracking-tight text-white sm:text-4xl">
                Your discipline signal.
              </h1>
            </div>
            <div className="border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
              Scores based on recorded data only
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
                      <Target className="h-3.5 w-3.5" strokeWidth={3} /> Current progress
                    </div>
                    <h2 className="mt-5 max-w-xl font-serif-custom text-2xl font-bold leading-tight text-white sm:text-3xl">
                      {todaySummary.pomodoroCount > 0
                        ? `${todaySummary.focusMinutes} focused minutes are already recorded.`
                        : 'No focused learning time is recorded yet.'}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55">
                      {todaySummary.taskCount > 0
                        ? `${todaySummary.completedTasks} of ${todaySummary.taskCount} planned tasks are complete.`
                        : 'There is no task plan for today, so the dashboard will not pretend there is a completion target.'}
                    </p>

                    <div className="mt-6">
                      <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                        <span>{taskProgress === null ? 'Task plan not set' : 'Today progress'}</span>
                        <span>{taskProgress === null ? '—' : `${taskProgress}%`}</span>
                      </div>
                      <div className="h-2 overflow-hidden bg-white/10">
                        <div
                          className="h-full bg-accent-green transition-[width] duration-500"
                          style={{ width: `${taskProgress ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <ScoreDial value={todayScore} total={todayReview?.score?.total ?? null} />
                </div>
              )}
            </article>

            <article
              className={`relative border-2 p-5 sm:p-6 ${
                dailyDirection.shouldFocus
                  ? 'border-accent-green/45 bg-accent-green/[0.07]'
                  : 'border-white/15 bg-white/[0.035]'
              }`}
            >
              <div className={`text-[10px] font-black uppercase tracking-[0.22em] ${dailyDirection.shouldFocus ? 'text-accent-green' : 'text-white/55'}`}>
                {dailyDirection.label}
              </div>
              <h2 className="mt-3 font-grotesk text-2xl font-black leading-tight text-white">{dailyDirection.headline}</h2>

              <div className="mt-5 space-y-3">
                <div className="border-l-2 border-accent-green bg-black/25 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-accent-green">Do next</div>
                  <p className="mt-1 text-sm leading-relaxed text-white/75">{dailyDirection.doCopy}</p>
                </div>
                <div className="border-l-2 border-accent-red bg-black/25 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-accent-red">Stop / avoid</div>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">{dailyDirection.stopCopy}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onNavigateHome}
                className={`mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 border-2 border-black px-4 text-sm font-black uppercase tracking-[0.12em] text-black transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-cream active:translate-y-px ${
                  dailyDirection.shouldFocus ? 'bg-accent-green' : 'bg-paper-cream'
                }`}
                style={{ boxShadow: '5px 5px 0 rgba(0,0,0,0.85)' }}
              >
                {dailyDirection.actionLabel}
                <ArrowRight className="h-4 w-4" strokeWidth={3} />
              </button>
            </article>
          </div>

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
            subtitle="Actual completed focus sessions, mapped across each day"
            id="consistency-heading"
          />

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <article className="border-2 border-white/15 bg-white/[0.03] p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-white">Last 30 days / focus timeline</div>
                  <div className="mt-1 text-xs text-white/45">
                    {trend.length ? `${formatShortDate(trend[0].date)} – ${formatShortDate(trend[trend.length - 1].date)}` : 'Waiting for recorded days'}
                  </div>
                </div>
                <HeatmapLegend />
              </div>

              <div className="mt-6">
                <ContributionHeatmap
                  trend={trend}
                  selectedDate={selectedDate}
                  onSelectDate={selectReviewDate}
                  loading={loading && trend.length === 0}
                />
              </div>

              {!hasTrendHistory && !loading && (
                <div className="mt-5 border border-dashed border-white/15 bg-black/20 p-4 text-sm leading-relaxed text-white/45">
                  No daily scores are recorded in this window yet. The cells will fill from the existing score review; unscored days stay visibly empty.
                </div>
              )}
            </article>

            <article className="border-2 border-white/15 bg-white/[0.03] p-5 sm:p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">7-day consistency score</div>
              <div className="mt-3 flex items-end gap-2">
                <div className="font-grotesk text-5xl font-black leading-none text-white">{consistencyScore}</div>
                <div className="pb-1 text-lg font-black text-accent-green">%</div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                {shownUpDays} of {recentTrend.length || CONSISTENCY_DAYS} days have recorded focus activity or a discipline score.
              </p>

              <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
                <SignalRow
                  label="Strongest signal"
                  value={habitSignals.strongest ? `${habitSignals.strongest.label} · ${habitSignals.strongest.average.toFixed(1)}/10` : 'Waiting for scores'}
                  tone="text-accent-green"
                />
                <SignalRow
                  label="Needs consistency"
                  value={habitSignals.weakest ? `${habitSignals.weakest.label} · ${habitSignals.weakest.average.toFixed(1)}/10` : 'Waiting for scores'}
                  tone="text-amber-300"
                />
              </div>

              <div className="mt-5 border-l-2 border-white/25 bg-black/25 px-4 py-3 text-sm leading-relaxed text-white/65">
                {hasTrendHistory
                  ? consistencyScore >= 80
                    ? 'Your review rhythm is stable. Protect it with an easy-to-start next session.'
                    : consistencyScore >= 50
                      ? 'The pattern is forming. Closing one more daily review matters more than chasing a perfect score.'
                      : 'The highest-value improvement is showing up consistently, not increasing the score on one day.'
                  : 'Complete a daily score review to establish the first honest consistency signal.'}
              </div>
            </article>
          </div>
        </section>

        <details className="group mt-10 border-2 border-white/15 bg-white/[0.02]">
          <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-4 p-4 transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent-green sm:p-6 [&::-webkit-details-marker]:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center border border-white/15 bg-white/[0.04] text-white/65">
                <HistoryIcon className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h2 className="font-grotesk text-lg font-black text-white">Completed-day review & logs</h2>
                <p className="truncate text-sm text-white/45">Open only when you need history, score editing, reading, or exercise logs.</p>
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
              <MetricCard icon={BarChart3} label="Daily score" value={`${selectedScoreStats.total}/${DAY_SCORE_MAX}`} detail={`${selectedScoreStats.average.toFixed(1)}/10 average`} />
              <MetricCard icon={Clock3} label="Focus volume" value={`${selectedSummary.focusMinutes} min`} detail={`${selectedSummary.pomodoroCount} completed sessions`} />
              <MetricCard icon={BookOpen} label="Reading" value={`${selectedSummary.readingPages} pages`} detail={`${selectedSummary.readingMinutes} minutes`} />
              <MetricCard icon={Dumbbell} label="Exercise" value={`${selectedSummary.exerciseMinutes} min`} detail={`${selectedReview?.exercise.length ?? 0} entries`} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <section className="border border-white/10 bg-black/20 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-white">Score breakdown</h3>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Recorded / 10</span>
                  </div>
                  <p className="mt-3 border-l-2 border-white/15 pl-3 text-sm leading-relaxed text-white/55">
                    {selectedReview?.score?.notes?.trim() || 'No reflection was recorded for this day.'}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {DISCIPLINE_SCORE_BLOCKS.map(block => {
                      const meta = SCORE_META[block.key];
                      const Icon = meta.icon;
                      const value = Number(selectedReview?.score?.scores?.[block.key] ?? scoreDraft[block.key] ?? 0);
                      return (
                        <div key={block.key} className="border border-white/10 bg-white/[0.025] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${meta.accent}`} strokeWidth={2.5} />
                              <span className="text-sm font-semibold text-white/75">{block.label}</span>
                            </div>
                            <span className="text-sm font-black text-white">{value}/10</span>
                          </div>
                          <div className={`mt-3 h-1.5 overflow-hidden ${meta.track}`}>
                            <div className={`h-full ${meta.fill}`} style={{ width: `${value * 10}%` }} />
                          </div>
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
                      <h3 className="text-sm font-black text-white">Update daily score</h3>
                      <p className="mt-1 text-xs text-white/45">Uses the existing six score blocks.</p>
                    </div>
                    <span className="font-mono text-[10px] text-white/35">{selectedDate}</span>
                  </div>

                  <div className="space-y-4">
                    {DISCIPLINE_SCORE_BLOCKS.map(block => (
                      <ScoreRow
                        key={block.key}
                        block={block}
                        value={scoreDraft[block.key]}
                        onChange={value => setScoreDraft(previous => ({ ...previous, [block.key]: value }))}
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
                      {isSavingScores ? <RotateCcw className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                      Save score
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
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
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
                            <div className="mt-1 text-xs text-white/40">{entry.pages} pages · {entry.minutes} min</div>
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
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
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
                            <div className="mt-1 text-xs text-white/40">{entry.durationMinutes} min{entry.intensity ? ` · ${entry.intensity}` : ''}</div>
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
      </main>
    </div>
  );
}

export function AccountMenu({
  user,
  onOpenSettings,
  onOpenHistory,
  onOpenAnalytics,
  onLogout,
  compactOnMobile = false,
}: {
  user: CentralAuthUser | null;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenAnalytics: () => void;
  onLogout: () => void;
  compactOnMobile?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
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
            aria-label="Profile and account"
            onKeyDown={handleMenuKeyDown}
            className="absolute right-0 top-[calc(100%+0.65rem)] z-[80] w-[min(18rem,calc(100vw-2rem))] border-2 border-white/20 bg-[#0b0b0b] p-2 shadow-[8px_8px_0_rgba(0,0,0,0.85)]"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <div className="border-b border-white/10 px-3 py-3">
              <div className="truncate text-sm font-black text-white">{name}</div>
              <div className="mt-1 truncate text-xs text-white/40">{user?.email || 'Signed in'}</div>
            </div>

            <div className="py-2">
              <AccountMenuItem icon={Settings2} label="Settings" onClick={() => runAction(onOpenSettings)} />
              <AccountMenuItem icon={HistoryIcon} label="History" onClick={() => runAction(onOpenHistory)} />
              <AccountMenuItem icon={BarChart3} label="Analytics" onClick={() => runAction(onOpenAnalytics)} />
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

function ScoreDial({ value, total }: { value: number | null; total: number | null }) {
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
            <div className="font-grotesk text-3xl font-black leading-none text-white">{value === null ? '—' : value}</div>
            <div className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/40">{value === null ? 'Pending' : 'Percent'}</div>
          </div>
        </div>
      </div>
      <div className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Today discipline score</div>
      <div className="mt-1 text-center text-xs text-white/35">{total === null ? 'Not recorded yet' : `${total}/${DAY_SCORE_MAX} existing total`}</div>
    </div>
  );
}

function ContributionHeatmap({
  trend,
  selectedDate,
  onSelectDate,
  loading,
}: {
  trend: DisciplineTrendPoint[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex gap-1.5" aria-label="Loading contribution history">
        {Array.from({ length: 30 }, (_, index) => (
          <span key={index} className="h-4 w-4 animate-pulse bg-white/10 sm:h-5 sm:w-5" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-[38rem]">
        <div className="mb-2 grid grid-cols-[4.5rem_1fr] gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-white/30" aria-hidden="true">
          <span>Day</span>
          <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-px">
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className="text-center">{hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}</span>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          {trend.map(day => {
            const activity = day.activity;
            const hours = activity?.hourlyMinutes ?? Array.from({ length: 24 }, () => 0);
            const selected = day.date === selectedDate;
            const summary = activity?.focusMinutes
              ? `${activity.focusMinutes} focused min${activity.firstStartedAt ? `, started ${formatTime(activity.firstStartedAt)}` : ''}`
              : day.total > 0
                ? `discipline score ${day.total}/${DAY_SCORE_MAX}`
                : 'no recorded focus activity';
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelectDate(day.date)}
                className={`grid w-full grid-cols-[4.5rem_1fr] items-center gap-2 border px-1.5 py-1 text-left transition hover:border-white/50 hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-cream ${
                  selected ? 'border-paper-cream bg-white/[0.06] ring-1 ring-paper-cream/50' : 'border-transparent'
                }`}
                title={`${formatLongDate(day.date)}: ${summary}`}
                aria-label={`${formatLongDate(day.date)}, ${summary}`}
                aria-pressed={selected}
              >
                <span className="font-mono text-[9px] font-bold text-white/55">{formatShortDate(day.date)}</span>
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

function HeatmapLegend() {
  return (
    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/35" aria-label="Focus timeline intensity from no focus time to a full focus block">
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
    <label className="flex items-center gap-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center ${meta.tint}`}>
        <Icon className={`h-4 w-4 ${meta.accent}`} strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-2 flex items-center justify-between gap-3">
          <span className="truncate text-sm font-semibold text-white/75">{block.label}</span>
          <span className="text-sm font-black text-white">{value}/10</span>
        </span>
        <span className={`relative block h-2 ${meta.track}`}>
          <span className={`absolute inset-y-0 left-0 ${meta.fill}`} style={{ width: `${value * 10}%` }} />
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={value}
            onChange={event => onChange(Number(event.target.value))}
            className="absolute -inset-y-3 inset-x-0 w-full cursor-pointer opacity-0"
            aria-label={`${block.label} score`}
          />
        </span>
      </span>
    </label>
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

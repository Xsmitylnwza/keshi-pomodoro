import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, Clock3, GripVertical, ListTodo, Menu, Pause, Play, Plus, RotateCcw, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import { CustomCursor } from './components/CustomCursor';
import Background from './components/Background';
import { DisciplineDashboard } from './components/DisciplineDashboard';

// Lazy load modals for smaller initial bundle
const SettingsModal = lazy(() => import('./components/Modals').then(m => ({ default: m.SettingsModal })));
const HistoryModal = lazy(() => import('./components/Modals').then(m => ({ default: m.HistoryModal })));
const AnalyticsModal = lazy(() => import('./components/AnalyticsModal').then(m => ({ default: m.AnalyticsModal })));
import { RadioWidget } from './components/RadioWidget';
import { useTheme } from './context/ThemeContext';
import {
  createSprintTask,
  deleteSprintTask,
  fetchSprintTasks,
  loadLocalTasks,
  loadSelectedTaskId,
  pushPomodoroEvent,
  pushPomodoroSession,
  saveLocalTasks,
  saveSelectedTaskId,
  sprintApiBaseUrl,
  updateSprintTask,
} from './lib/sprintApi';
import type { HistoryItem, PomodoroEventType, SprintTask } from './types';
import {
  fadeDown,
  fadeUp,
  scaleIn,
  popIn,
  slideUp,
  letterContainer,
  letterItem,
  staggerContainer,
  staggerItem,
  entranceDelays,
} from './utils/animations';

type TimerMode = 'focus' | 'break';

const MODES = {
  focus: {
    label: 'FOCUS',
    color: 'var(--accent-red)', // Dynamic
    bgColor: 'bg-bg-dark',
    quote: '"I only show you the best of me."'
  },
  break: {
    label: 'RELAX',
    color: 'var(--accent-green)', // Dynamic
    bgColor: 'bg-bg-forest',
    quote: '"Take a breath. You earned this."'
  }
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const todayKey = () => toDateKey(new Date());
const shiftDateKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};
const formatDayLabel = (dateKey: string) => {
  if (dateKey === todayKey()) return 'Today';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const TASK_STATUS_ORDER: SprintTask['status'][] = ['todo', 'doing', 'done'];

function App() {
  const [pathname, setPathname] = useState(() => (typeof window !== 'undefined' ? window.location.pathname : '/'));
  // State
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [focusTime, setFocusTime] = useState(25);
  const [breakTime, setBreakTime] = useState(5);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tasks, setTasks] = useState<SprintTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('inbox');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [taskDay, setTaskDay] = useState(todayKey());
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>('inbox');
  const [taskSyncState, setTaskSyncState] = useState<'idle' | 'syncing' | 'online' | 'offline'>('idle');
  const [taskPendingDelete, setTaskPendingDelete] = useState<SprintTask | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ taskId: string; placement: 'before' | 'after' } | null>(null);

  // Ref to store the absolute end time (timestamp when timer should complete)
  const endTimeRef = useRef<number | null>(null);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clickSoundRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isDisciplineRoute = pathname.startsWith('/discipline');

  const navigateTo = (nextPath: string) => {
    if (typeof window === 'undefined' || window.location.pathname === nextPath) return;
    window.history.pushState({}, '', nextPath);
    setPathname(nextPath);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sound Utility
  const playClick = () => {
    if (clickSoundRef.current && soundEnabled) {
      clickSoundRef.current.currentTime = 0;
      clickSoundRef.current.play().catch(e => console.log('Audio play failed', e));
    }
  };

  // Initial Load
  useEffect(() => {
    const savedHistory = localStorage.getItem('keshi_pomodoro_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    setTasks(loadLocalTasks());
    const savedTaskId = loadSelectedTaskId();
    setSelectedTaskId(savedTaskId);
    setExpandedTaskId(savedTaskId);

    const sFocus = localStorage.getItem('keshi-focus');
    const sBreak = localStorage.getItem('keshi-break');
    if (sFocus) setFocusTime(parseInt(sFocus));
    if (sBreak) setBreakTime(parseInt(sBreak));

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    setHasMounted(true);
  }, []);

  const refreshTasks = async () => {
    setTaskSyncState('syncing');

    try {
      const syncedTasks = await fetchSprintTasks();
      setTasks(syncedTasks);
      setTaskSyncState(sprintApiBaseUrl ? 'online' : 'offline');
    } catch (error) {
      console.warn('Task sync failed', error);
      setTasks(loadLocalTasks());
      setTaskSyncState('offline');
    }
  };

  useEffect(() => {
    refreshTasks();
  }, []);

  // Favicon Updater
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) return;
    // We can use the same logo but if we had a green one we'd swap it.
    // Since we don't, we just ensure it points to the correct static asset.
    link.href = '/logo.png';
  }, [mode]);

  // Timer Logic - Using absolute time to handle browser tab throttling
  useEffect(() => {
    let interval: number;

    if (isRunning && timeLeft > 0) {
      // Set the end time when starting the timer
      if (endTimeRef.current === null) {
        endTimeRef.current = Date.now() + timeLeft * 1000;
      }

      // Check time every 250ms - sufficient for second-level display accuracy
      interval = setInterval(() => {
        if (endTimeRef.current !== null) {
          const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000);

          if (remaining <= 0) {
            setTimeLeft(0);
          } else {
            setTimeLeft(remaining);
          }
        }
      }, 250);
    } else if (timeLeft === 0) {
      handleComplete();
    }

    // Clear endTimeRef when timer is paused or stopped
    if (!isRunning) {
      endTimeRef.current = null;
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  // Handle visibility change - recalculate time when returning to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning && endTimeRef.current !== null) {
        const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          setTimeLeft(0);
        } else {
          setTimeLeft(remaining);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning]);

  // Document Title
  useEffect(() => {
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    document.title = isDisciplineRoute ? `Discipline • ${m}:${s}` : `${m}:${s} • ${mode.toUpperCase()}`;
  }, [timeLeft, mode, isDisciplineRoute]);

  // Keyboard Shortcuts (Enter / Spacebar to toggle timer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or modal is open
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (isDisciplineRoute || showSettings || showHistory || taskPendingDelete) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleTimer();
        playClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDisciplineRoute, showSettings, showHistory, soundEnabled, taskPendingDelete]);

  const handleComplete = () => {
    setIsRunning(false);
    if (soundEnabled && audioRef.current) audioRef.current.play();
    logTimerEvent('pomodoro_completed', {
      elapsedSeconds: plannedSecondsFor(mode),
      remainingSeconds: 0,
    });

    // Browser notification for users on other tabs
    if ('Notification' in window && Notification.permission === 'granted') {
      const notifTitle = mode === 'focus' ? 'Focus Complete!' : 'Break Over!';
      const notifBody = mode === 'focus'
        ? `Great work! ${focusTime} minute focus session complete. Time for a break.`
        : `Break's over! Ready to focus for ${focusTime} minutes?`;

      new Notification(notifTitle, {
        body: notifBody,
        icon: '/logo.png',
        tag: 'keshi-pomodoro-timer',
        requireInteraction: true,
      });
    }

    // Add to history with unique ID
    const selectedTask = tasks.find(task => task.id === selectedTaskId);
    const newItem: HistoryItem = {
      mode: mode,
      duration: mode === 'focus' ? focusTime : breakTime,
      date: new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', month: 'short', day: 'numeric' }),
      id: crypto.randomUUID(),
      taskId: selectedTask?.id,
      taskTitle: selectedTask?.title,
    };
    const newHistory = [newItem, ...history];
    setHistory(newHistory);
    localStorage.setItem('keshi_pomodoro_history', JSON.stringify(newHistory));

    if (mode === 'focus') {
      pushPomodoroSession(newItem)
        .then(() => {
          const syncedHistory = newHistory.map(item =>
            item.id === newItem.id ? { ...item, syncedAt: new Date().toISOString(), syncError: undefined } : item
          );
          setHistory(syncedHistory);
          localStorage.setItem('keshi_pomodoro_history', JSON.stringify(syncedHistory));
          if (sprintApiBaseUrl) setTaskSyncState('online');
        })
        .catch((error) => {
          const syncError = error instanceof Error ? error.message : 'Unable to sync session';
          const failedHistory = newHistory.map(item =>
            item.id === newItem.id ? { ...item, syncError } : item
          );
          setHistory(failedHistory);
          localStorage.setItem('keshi_pomodoro_history', JSON.stringify(failedHistory));
          setTaskSyncState('offline');
        });
    }

    const newMode = mode === 'focus' ? 'break' : 'focus';
    sessionIdRef.current = null;
    setMode(newMode);
    setTimeLeft((newMode === 'focus' ? focusTime : breakTime) * 60);
  };

  const resetTimer = () => {
    cancelActiveTimer();
    setIsRunning(false);
    setTimeLeft((mode === 'focus' ? focusTime : breakTime) * 60);
  };

  const switchMode = (newMode: TimerMode) => {
    if (newMode !== mode) cancelActiveTimer();
    setMode(newMode);
    setIsRunning(false);
    setTimeLeft(newMode === 'focus' ? focusTime * 60 : breakTime * 60);
  };

  const saveSettings = () => {
    localStorage.setItem('keshi-focus', focusTime.toString());
    localStorage.setItem('keshi-break', breakTime.toString());
    // Only reset if not currently running to avoid disrupting active session
    if (!isRunning) {
      resetTimer();
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.setItem('keshi_pomodoro_history', '[]');
  };

  const selectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    saveSelectedTaskId(taskId);
    setExpandedTaskId(taskId);
  };

  const tasksForDay = (sourceTasks: SprintTask[], dateKey: string) => sourceTasks.filter(task => {
    const dateSource = task.createdAt ?? task.updatedAt;
    if (!dateSource) return dateKey === todayKey();
    return toDateKey(new Date(dateSource)) === dateKey;
  });

  const getNextTaskOrder = (dateKey: string) => {
    const dayTasks = tasksForDay(tasks, dateKey);
    const highestOrder = dayTasks.reduce((max, task) => Math.max(max, task.order ?? 0), 0);
    return highestOrder + 1;
  };

  const getStatusMeta = (status: SprintTask['status']) => {
    switch (status) {
      case 'done':
        return {
          label: 'Done',
          border: 'border-accent-green/70',
          surface: 'bg-accent-green/10 text-white/80 hover:text-white',
          pill: 'border-accent-green/40 bg-accent-green/15 text-accent-green',
          chip: 'border-accent-green bg-accent-green text-black',
          chipOnLight: 'border-accent-green/40 bg-accent-green/15 text-accent-green',
          activeButton: 'border-accent-green bg-accent-green text-black',
          inactiveButton: 'border-accent-green/30 bg-accent-green/10 text-accent-green hover:border-accent-green/60 hover:text-accent-green',
          inactiveSelectedButton: 'border-accent-green/30 bg-accent-green/10 text-black/60 hover:border-accent-green/60 hover:text-black',
          ring: 'ring-accent-green/40',
          dropLine: 'bg-accent-green',
        };
      case 'doing':
        return {
          label: 'Doing',
          border: 'border-yellow-400/80',
          surface: 'bg-yellow-400/10 text-white/80 hover:text-white',
          pill: 'border-yellow-400/40 bg-yellow-400/15 text-yellow-300',
          chip: 'border-yellow-400 bg-yellow-400 text-black',
          chipOnLight: 'border-yellow-400/40 bg-yellow-400/15 text-yellow-300',
          activeButton: 'border-yellow-400 bg-yellow-400 text-black',
          inactiveButton: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-200 hover:border-yellow-400/60 hover:text-yellow-100',
          inactiveSelectedButton: 'border-yellow-400/30 bg-yellow-400/10 text-black/60 hover:border-yellow-400/60 hover:text-black',
          ring: 'ring-yellow-400/40',
          dropLine: 'bg-yellow-400',
        };
      default:
        return {
          label: 'Todo',
          border: 'border-white/20',
          surface: 'bg-white/[0.04] text-white/65 hover:text-white',
          pill: 'border-white/15 bg-white/5 text-white/60',
          chip: 'border-white/20 bg-white/5 text-white',
          chipOnLight: 'border-black/15 bg-black/5 text-black',
          activeButton: 'border-black bg-black text-paper-cream',
          inactiveButton: 'border-white/15 bg-white/5 text-white/70 hover:border-white/35 hover:text-white',
          inactiveSelectedButton: 'border-black/15 bg-black/5 text-black/60 hover:border-black/30 hover:text-black',
          ring: 'ring-white/30',
          dropLine: 'bg-white/60',
        };
    }
  };

  const plannedSecondsFor = (timerMode: TimerMode) => (timerMode === 'focus' ? focusTime : breakTime) * 60;

  const getNextTaskStatus = (status: SprintTask['status']) => {
    const currentIndex = TASK_STATUS_ORDER.indexOf(status);
    return TASK_STATUS_ORDER[(currentIndex + 1) % TASK_STATUS_ORDER.length];
  };

  const getStatusIcon = (status: SprintTask['status']) => {
    switch (status) {
      case 'doing':
        return Clock3;
      case 'done':
        return CheckCircle2;
      default:
        return Circle;
    }
  };

  const logTimerEvent = (type: PomodoroEventType, overrides?: { elapsedSeconds?: number; remainingSeconds?: number; sessionId?: string }) => {
    const selectedTask = tasks.find(task => task.id === selectedTaskId);
    const plannedSeconds = plannedSecondsFor(mode);
    const remainingSeconds = overrides?.remainingSeconds ?? timeLeft;
    const elapsedSeconds = overrides?.elapsedSeconds ?? Math.max(0, plannedSeconds - remainingSeconds);
    const sessionId = overrides?.sessionId ?? sessionIdRef.current ?? crypto.randomUUID();

    sessionIdRef.current = sessionId;

    pushPomodoroEvent({
      id: crypto.randomUUID(),
      sessionId,
      type,
      mode,
      taskId: selectedTask?.id ?? null,
      taskTitle: selectedTask?.title ?? null,
      plannedSeconds,
      elapsedSeconds,
      remainingSeconds,
      createdAt: new Date().toISOString(),
      source: 'keshi-pomodoro',
    })
      .then(() => {
        if (sprintApiBaseUrl) setTaskSyncState('online');
      })
      .catch((error) => {
        console.warn('Timer event sync failed', error);
        setTaskSyncState('offline');
      });
  };

  const cancelActiveTimer = () => {
    const plannedSeconds = plannedSecondsFor(mode);
    const elapsedSeconds = Math.max(0, plannedSeconds - timeLeft);
    if (elapsedSeconds > 0 && sessionIdRef.current) {
      logTimerEvent('pomodoro_cancelled', { elapsedSeconds, remainingSeconds: timeLeft });
    }
    sessionIdRef.current = null;
  };

  const toggleTimer = () => {
    if (isRunning) {
      logTimerEvent('pomodoro_paused');
      setIsRunning(false);
      return;
    }

    const plannedSeconds = plannedSecondsFor(mode);
    const isFreshRun = timeLeft === plannedSeconds || !sessionIdRef.current;
    logTimerEvent(isFreshRun ? 'pomodoro_started' : 'pomodoro_resumed', {
      sessionId: isFreshRun ? crypto.randomUUID() : sessionIdRef.current ?? undefined,
    });
    setIsRunning(true);
  };

  const addTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    const createdAt = new Date(`${taskDay}T${new Date().toTimeString().slice(0, 8)}`).toISOString();

    const nextTask: SprintTask = {
      id: crypto.randomUUID(),
      title,
      status: 'doing',
      sprint: formatDayLabel(taskDay),
      order: getNextTaskOrder(taskDay),
      createdAt,
      updatedAt: createdAt,
      subtasks: [],
    };
    const nextTasks = [nextTask, ...tasks];
    const normalizedTasks = nextTasks.slice().sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
    setTasks(normalizedTasks);
    saveLocalTasks(normalizedTasks);
    selectTask(nextTask.id);
    setNewTaskTitle('');

    createSprintTask(nextTask)
      .then(() => {
        if (sprintApiBaseUrl) setTaskSyncState('online');
      })
      .catch((error) => {
        console.warn('Task create failed', error);
        setTaskSyncState('offline');
      });
  };

  const persistTask = (task: SprintTask, nextTasks: SprintTask[]) => {
    setTasks(nextTasks);
    saveLocalTasks(nextTasks);

    updateSprintTask(task)
      .then(() => {
        if (sprintApiBaseUrl) setTaskSyncState('online');
      })
      .catch((error) => {
        console.warn('Task update failed', error);
        setTaskSyncState('offline');
      });
  };

  const patchTask = (taskId: string, patch: Partial<SprintTask>) => {
    const nextTasks = tasks.map(task => {
      if (task.id !== taskId) return task;
      return {
        ...task,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
    });
    const updatedTask = nextTasks.find(task => task.id === taskId);
    if (!updatedTask) return;
    persistTask(updatedTask, nextTasks);
  };

  const setTaskStatus = (taskId: string, status: SprintTask['status']) => {
    patchTask(taskId, { status });
  };

  const advanceTaskStatus = (taskId: string) => {
    const currentTask = tasks.find(task => task.id === taskId);
    if (!currentTask) return;
    setTaskStatus(taskId, getNextTaskStatus(currentTask.status));
  };

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTaskId(prev => (prev === taskId ? null : taskId));
  };

  const removeTask = (taskId: string) => {
    const nextTasks = tasks.filter(task => task.id !== taskId);
    setTasks(nextTasks);
    saveLocalTasks(nextTasks);

    if (selectedTaskId === taskId) {
      const fallbackId = nextTasks[0]?.id ?? 'inbox';
      setSelectedTaskId(fallbackId);
      saveSelectedTaskId(fallbackId);
      setExpandedTaskId(fallbackId);
    }

    deleteSprintTask(taskId)
      .then(() => {
        if (sprintApiBaseUrl) setTaskSyncState('online');
      })
      .catch((error) => {
        console.warn('Task delete failed', error);
        setTaskSyncState('offline');
      });
  };

  const requestDeleteTask = (task: SprintTask) => {
    setTaskPendingDelete(task);
  };

  const confirmDeleteTask = () => {
    if (!taskPendingDelete) return;
    removeTask(taskPendingDelete.id);
    setTaskPendingDelete(null);
  };

  const addSubtask = () => {
    const title = newSubtaskTitle.trim();
    if (!title || !selectedTask) return;
    patchTask(selectedTask.id, {
      subtasks: [
        ...(selectedTask.subtasks ?? []),
        {
          id: crypto.randomUUID(),
          title,
          done: false,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setNewSubtaskTitle('');
  };

  const toggleSubtask = (task: SprintTask, subtaskId: string) => {
    patchTask(task.id, {
      subtasks: (task.subtasks ?? []).map(subtask =>
        subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask
      ),
    });
  };

  const removeSubtask = (task: SprintTask, subtaskId: string) => {
    patchTask(task.id, {
      subtasks: (task.subtasks ?? []).filter(subtask => subtask.id !== subtaskId),
    });
  };

  const reorderTasksForDay = (draggedTaskId: string, targetTaskId: string, placement: 'before' | 'after') => {
    if (draggedTaskId === targetTaskId) return;

    const dayTasks = tasksForDay(tasks, taskDay).slice().sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
    const draggedIndex = dayTasks.findIndex(task => task.id === draggedTaskId);
    const targetIndex = dayTasks.findIndex(task => task.id === targetTaskId);
    if (draggedIndex < 0 || targetIndex < 0) return;

    const reordered = [...dayTasks];
    const [draggedTask] = reordered.splice(draggedIndex, 1);
    let insertIndex = placement === 'before' ? targetIndex : targetIndex + 1;
    if (draggedIndex < targetIndex) insertIndex -= 1;
    reordered.splice(insertIndex, 0, draggedTask);

    const maxOrder = reordered.length;
    const orderById = new Map(reordered.map((task, index) => [task.id, maxOrder - index]));
    const now = new Date().toISOString();
    const nextTasks = tasks.map(task => {
      if (!orderById.has(task.id)) return task;
      return {
        ...task,
        order: orderById.get(task.id) ?? task.order,
        updatedAt: now,
      };
    }).sort((a, b) => (b.order ?? 0) - (a.order ?? 0));

    setTasks(nextTasks);
    saveLocalTasks(nextTasks);
    setDraggedTaskId(null);
    setDropTarget(null);

    reordered.forEach(task => {
      const updatedTask = nextTasks.find(candidate => candidate.id === task.id);
      if (updatedTask) {
        updateSprintTask(updatedTask).catch(error => {
          console.warn('Task reorder sync failed', error);
          setTaskSyncState('offline');
        });
      }
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalTime = (mode === 'focus' ? focusTime : breakTime) * 60;
  // Calculate progress ensuring we don't divide by zero
  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  const { colors } = useTheme();
  const selectedTask = tasks.find(task => task.id === selectedTaskId) ?? tasks[0];
  const visibleTasks = tasksForDay(tasks, taskDay).slice().sort((a, b) => (b.order ?? 0) - (a.order ?? 0));

  // Calculate dynamic background color - Only tint background in Relax mode
  // Focus mode should correspond to "The Void" (Absolute Black) for maximum contrast
  const dynamicBg = mode === 'focus'
    ? '#080808'
    : `color-mix(in srgb, ${colors.break} 10%, #050505)`;

  if (isDisciplineRoute) {
    return <DisciplineDashboard onNavigateHome={() => navigateTo('/')} />;
  }

  return (
    <div
      className={`min-h-screen text-paper-cream relative overflow-hidden flex flex-col font-grotesk transition-[background-color] duration-1000 ease-in-out`}
      style={{ backgroundColor: dynamicBg }}
    >
      <CustomCursor />
      <Background mode={mode} />

      {/* Audio */}
      <audio ref={audioRef} src="/yandere-simulator-akademi-school-bell.mp3" preload="auto" />
      <audio ref={clickSoundRef} src="/clicksoundeffect.mp3" preload="auto" />

      {/* Grain Overlay handled globally in index.css (.noise-overlay) */}
      <div className="noise-overlay"></div>

      {/* Navigation (Floating / Minimal) */}
      <nav className="fixed top-0 left-0 right-0 z-40 p-3 sm:p-4 md:p-6 flex justify-between items-start" style={{ viewTransitionName: 'main-nav' }}>
        <motion.div
          className="flex items-center gap-2 sm:gap-4 group cursor-pointer"
          variants={fadeDown}
          initial="initial"
          animate="animate"
          transition={{ delay: entranceDelays.logo }}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 relative isolate">
            <img src="/f25d6e80f442ce4dc10c171831b1fc76.jpg"
              alt="Logo"
              className="w-full h-full object-cover rounded-full border-2 border-paper-cream grayscale group-hover:scale-110 group-hover:grayscale-0 transition-all duration-300 mix-blend-normal" />
          </div>
          <span className="font-grotesk font-bold text-sm sm:text-lg md:text-xl tracking-widest text-paper-cream hidden sm:inline">
            DEV<span className="text-accent-red">.</span>GABRIEL
          </span>
        </motion.div>

        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => { setShowSettings(true); playClick(); }}
              className={`text-sm tracking-widest uppercase transition-all font-bold flex items-center gap-2 group p-2 border-2 border-transparent hover:border-current rounded-sm ${mode === 'focus' ? 'hover:text-accent-red hover:bg-accent-red/10' : 'hover:text-accent-green hover:bg-accent-green/10'}`}
              variants={fadeDown}
              initial="initial"
              animate="animate"
              transition={{ delay: entranceDelays.menu }}
              whileTap={{ scale: 0.95 }}
            >
              <span>Menu</span>
              <Menu className="w-5 h-5 group-hover:rotate-90 transition-transform" strokeWidth={3} />
            </motion.button>
            <motion.button
              onClick={() => { playClick(); navigateTo('/discipline'); }}
              className="inline-flex items-center gap-2 border-2 border-transparent px-3 py-2 text-sm font-black uppercase tracking-widest text-white/65 transition-all hover:border-accent-green/40 hover:bg-accent-green/10 hover:text-accent-green"
              variants={fadeDown}
              initial="initial"
              animate="animate"
              transition={{ delay: entranceDelays.menu + 0.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Open discipline dashboard"
              title="Discipline dashboard"
            >
              <BarChart3 className="w-5 h-5" strokeWidth={3} />
            </motion.button>
          </div>
          <motion.div
            className={`${mode === 'focus' ? 'bg-accent-red' : 'bg-accent-green'} ${mode === 'focus' ? 'text-white' : 'text-black'} text-[10px] px-2 py-0.5 font-bold shadow-sm transition-colors duration-500`}
            variants={popIn}
            initial="initial"
            animate="animate"
            transition={{ delay: entranceDelays.badge }}
          >
            KESHI MODE V2.0
          </motion.div>
        </div>
      </nav>

      {/* Sprint Task Dock */}
      <motion.button
        onClick={() => { setIsTaskPanelOpen(prev => !prev); playClick(); }}
        className={`fixed right-3 top-24 z-[70] flex min-h-12 w-12 items-center justify-center border-2 border-black bg-paper-cream text-black transition-all hover:-translate-x-1 active:translate-x-0 sm:right-5 md:right-6 ${isTaskPanelOpen ? 'pointer-events-none opacity-0 scale-90' : 'pointer-events-auto opacity-100 scale-100'}`}
        style={{ boxShadow: '5px 5px 0 rgba(0,0,0,0.85)' }}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: isTaskPanelOpen ? 0 : 1, x: 0, scale: isTaskPanelOpen ? 0.9 : 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        aria-label="Open sprint task panel"
        title={selectedTask?.title ? `Sprint task: ${selectedTask.title}` : 'Sprint tasks'}
      >
        <ListTodo className="h-5 w-5" strokeWidth={3} />
      </motion.button>

      <AnimatePresence>
        {isTaskPanelOpen && (
          <motion.aside
            className="fixed right-3 top-24 z-[71] pointer-events-auto flex max-h-[calc(100vh-12rem)] w-[min(24rem,calc(100vw-1.5rem))] flex-col border-2 border-paper-cream/80 bg-black/85 p-4 text-paper-cream shadow-[10px_10px_0_rgba(0,0,0,0.75)] backdrop-blur-md sm:right-5 md:right-6"
            initial={{ opacity: 0, x: 36, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 32, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-white/75">
                  <ListTodo className="h-4 w-4 shrink-0" strokeWidth={3} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em]">Sprint task</span>
                </div>
                <div className="mt-2 truncate font-grotesk text-lg font-black leading-none">
                  {selectedTask?.title ?? 'No task selected'}
                </div>
              </div>
              <button
                onClick={() => { setIsTaskPanelOpen(false); playClick(); }}
                className="grid h-9 w-9 shrink-0 place-items-center border-2 border-white/15 bg-white/5 text-white/65 transition-colors hover:border-white/60 hover:text-white"
                aria-label="Close sprint task panel"
              >
                <X className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>

              <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-2 border-y border-white/10 py-2">
                <button
                  onClick={() => { setTaskDay(shiftDateKey(taskDay, -1)); playClick(); }}
                  className="grid h-8 w-8 place-items-center border border-white/10 bg-white/5 text-white/55 hover:text-white"
                  aria-label="Previous task day"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={3} />
                </button>
                <div className="flex min-w-0 items-center justify-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 text-white/45" strokeWidth={3} />
                  <span className="truncate text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">
                    {formatDayLabel(taskDay)}
                  </span>
                </div>
                <button
                  onClick={() => { setTaskDay(shiftDateKey(taskDay, 1)); playClick(); }}
                  className="grid h-8 w-8 place-items-center border border-white/10 bg-white/5 text-white/55 hover:text-white"
                  aria-label="Next task day"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={3} />
                </button>
              </div>

              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">
                  {visibleTasks.length} tasks / {selectedTask?.status ?? 'idle'}
                </span>
                <button
                  onClick={() => { refreshTasks(); playClick(); }}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/45 transition-colors hover:text-white"
                  title={sprintApiBaseUrl ? `Syncing with ${sprintApiBaseUrl}` : 'Local task mode'}
                >
                  {taskSyncState === 'online' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                  {taskSyncState === 'syncing' ? 'Syncing' : taskSyncState === 'online' ? 'VPS' : 'Local'}
                </button>
              </div>

            <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
              <input
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addTask();
                  }
                }}
                className="min-w-0 border-2 border-white/15 bg-black/45 px-3 py-2.5 font-mono text-xs text-paper-cream outline-none transition-colors placeholder:text-white/25 focus:border-paper-cream"
                placeholder="Add task..."
              />
              <button
                onClick={() => { addTask(); playClick(); }}
                className="inline-grid h-11 w-11 place-items-center border-2 border-black bg-paper-cream text-black transition-transform hover:-translate-y-0.5 active:translate-y-0"
                style={{ boxShadow: '4px 4px 0 rgba(0,0,0,1)' }}
                aria-label="Add sprint task"
              >
                <Plus className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {visibleTasks.length === 0 && (
                <div className="border border-dashed border-white/15 px-3 py-5 text-center font-mono text-[11px] uppercase tracking-widest text-white/30">
                  No tasks for {formatDayLabel(taskDay)}
                </div>
              )}
              {visibleTasks.map(task => {
                const isSelected = task.id === selectedTask?.id;
                const isExpanded = task.id === expandedTaskId;
                const statusMeta = getStatusMeta(task.status);
                const completedSubtasks = (task.subtasks ?? []).filter(subtask => subtask.done).length;
                const totalSubtasks = (task.subtasks ?? []).length;
                return (
                  <div
                    key={task.id}
                    title={task.title}
                    className={`relative overflow-hidden border-2 p-2.5 transition-all ${statusMeta.border} ${isExpanded
                      ? (isSelected ? 'bg-paper-cream text-black' : statusMeta.surface)
                      : 'bg-black/55 text-white/75 hover:bg-black/65 hover:text-white'
                      } ${draggedTaskId === task.id ? 'opacity-50' : ''} ${dropTarget?.taskId === task.id ? `ring-2 ${statusMeta.ring}` : ''}`}
                    onDragOver={(event) => {
                      if (!draggedTaskId || draggedTaskId === task.id) return;
                      event.preventDefault();
                      const rect = event.currentTarget.getBoundingClientRect();
                      const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                      setDropTarget({ taskId: task.id, placement });
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!draggedTaskId || draggedTaskId === task.id) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                      reorderTasksForDay(draggedTaskId, task.id, placement);
                    }}
                    onDragLeave={() => {
                      if (dropTarget?.taskId === task.id) setDropTarget(null);
                    }}
                  >
                      {dropTarget?.taskId === task.id && dropTarget.placement === 'before' && (
                        <div className={`absolute left-2 right-2 top-0 h-0.5 ${statusMeta.dropLine}`} />
                      )}
                      {dropTarget?.taskId === task.id && dropTarget.placement === 'after' && (
                        <div className={`absolute left-2 right-2 bottom-0 h-0.5 ${statusMeta.dropLine}`} />
                      )}

                      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2">
                        <button
                          draggable
                          onDragStart={() => {
                            setDraggedTaskId(task.id);
                            setDropTarget(null);
                          }}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDropTarget(null);
                          }}
                          className={`grid h-8 w-8 cursor-grab place-items-center border-2 active:cursor-grabbing ${isSelected ? 'border-black/20 bg-black/5' : 'border-white/10 bg-black/20'}`}
                          aria-label={`Drag ${task.title}`}
                          title="Drag to reorder"
                        >
                          <GripVertical className="h-4 w-4" strokeWidth={2.5} />
                        </button>

                        <button
                          onClick={() => { selectTask(task.id); playClick(); }}
                          className="min-w-0 text-left"
                          title={task.title}
                        >
                          <div className="truncate font-grotesk text-sm font-black">{task.title}</div>
                          <div className="mt-1 text-[9px] uppercase tracking-widest opacity-60">{task.sprint ?? 'Sprint'} / {statusMeta.label}</div>
                        </button>

                        <button
                          onClick={() => { advanceTaskStatus(task.id); playClick(); }}
                          className={`inline-flex h-8 items-center gap-1.5 border px-2 text-[9px] font-black uppercase tracking-[0.22em] transition-colors ${isExpanded && isSelected ? statusMeta.chipOnLight : statusMeta.chip}`}
                          aria-label={`Advance ${task.title} status to ${getStatusMeta(getNextTaskStatus(task.status)).label}`}
                          title={`Advance to ${getStatusMeta(getNextTaskStatus(task.status)).label}`}
                        >
                          {(() => {
                            const StatusIcon = getStatusIcon(task.status);
                            return <StatusIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />;
                          })()}
                          <span>{statusMeta.label}</span>
                        </button>

                        <button
                          onClick={() => { toggleTaskExpanded(task.id); playClick(); }}
                          className={`grid h-8 w-8 place-items-center border-2 transition-colors ${isSelected ? 'border-black/20 hover:bg-black hover:text-white' : 'border-white/10 hover:border-white/40'}`}
                          aria-label={isExpanded ? `Collapse ${task.title}` : `Expand ${task.title}`}
                          title={isExpanded ? 'Collapse details' : 'Expand details'}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" strokeWidth={3} /> : <ChevronDown className="h-4 w-4" strokeWidth={3} />}
                        </button>

                        <button
                          onClick={() => { requestDeleteTask(task); playClick(); }}
                          className={`grid h-8 w-8 place-items-center border-2 transition-colors ${isSelected ? 'border-black/20 hover:bg-black hover:text-white' : 'border-white/10 hover:border-accent-red hover:text-accent-red'}`}
                          aria-label={`Delete ${task.title}`}
                          title="Delete task"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={3} />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className={`mt-3 border-t pt-3 ${isSelected ? 'border-black/15 text-black' : 'border-white/10 text-white'}`}>
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-[0.22em] opacity-55">Status</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest opacity-45">
                              {completedSubtasks}/{totalSubtasks}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {(['todo', 'doing', 'done'] as const).map(status => {
                              const active = task.status === status;
                              const statusButtonMeta = getStatusMeta(status);
                              const StatusIcon = getStatusIcon(status);
                              const label = status === 'todo' ? 'Todo' : status === 'doing' ? 'Doing' : 'Done';
                              const buttonClasses = active
                                ? statusButtonMeta.activeButton
                                : isSelected
                                  ? statusButtonMeta.inactiveSelectedButton
                                  : statusButtonMeta.inactiveButton;

                              return (
                                <button
                                  key={status}
                                  onClick={() => { setTaskStatus(task.id, status); playClick(); }}
                                  className={`flex items-center gap-2 border-2 px-3 py-2 text-left transition-colors ${buttonClasses}`}
                                >
                                  <StatusIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
                                  <div className="min-w-0">
                                    <div className="text-[9px] font-black uppercase tracking-[0.24em]">{label}</div>
                                    <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-70">
                                      {status === 'todo' ? 'Not started' : status === 'doing' ? 'In progress' : 'Finished'}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-3 border-t border-black/10 pt-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-[9px] font-bold uppercase tracking-[0.22em] opacity-55">Subtasks</span>
                              <span className="text-[9px] font-bold uppercase tracking-widest opacity-45">
                                {completedSubtasks}/{totalSubtasks}
                              </span>
                            </div>
                            <div className="mb-2 grid grid-cols-[1fr_auto] gap-2">
                              <input
                                value={newSubtaskTitle}
                                onChange={(event) => setNewSubtaskTitle(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addSubtask();
                                  }
                                }}
                                className="min-w-0 border border-black/20 bg-black/5 px-2.5 py-2 font-mono text-[11px] text-black outline-none transition-colors placeholder:text-black/35 focus:border-black"
                                placeholder="Add subtask..."
                              />
                              <button
                                onClick={() => { addSubtask(); playClick(); }}
                                className="grid h-9 w-9 place-items-center border-2 border-black bg-black text-paper-cream"
                                aria-label="Add subtask"
                              >
                                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                              </button>
                            </div>
                            <div className="max-h-32 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                              {(task.subtasks ?? []).map(subtask => (
                                <div key={subtask.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border border-black/10 bg-black/[0.04] px-2 py-1.5">
                                  <button onClick={() => { toggleSubtask(task, subtask.id); playClick(); }} aria-label={`Toggle ${subtask.title}`}>
                                    {subtask.done ? <CheckCircle2 className="h-3.5 w-3.5 text-accent-green" strokeWidth={3} /> : <Circle className="h-3.5 w-3.5 text-black/45" strokeWidth={3} />}
                                  </button>
                                  <span className={`truncate text-xs ${subtask.done ? 'text-black/35 line-through' : 'text-black/75'}`}>{subtask.title}</span>
                                  <button onClick={() => { removeSubtask(task, subtask.id); playClick(); }} className="text-black/35 hover:text-accent-red" aria-label={`Delete ${subtask.title}`}>
                                    <X className="h-3.5 w-3.5" strokeWidth={3} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                );
              })}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="relative z-10 flex-grow flex flex-col items-center justify-center p-4">

        {/* Ransom Note Title - Mode Switcher */}
        <motion.div
          className="mb-12 relative group cursor-pointer"
          onClick={() => { switchMode(mode === 'focus' ? 'break' : 'focus'); playClick(); }}
          variants={letterContainer}
          initial="initial"
          animate="animate"
        >
          <div className={`absolute inset-0 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${mode === 'focus' ? 'bg-accent-red/20' : 'bg-accent-green/20'}`}></div>
          <div className="flex flex-wrap justify-center gap-1 sm:gap-2 pointer-events-auto select-none scale-125 md:scale-150 transition-transform duration-300 group-hover:scale-[1.6]">
            {MODES[mode].label.split('').map((char, i) => (
              <motion.span
                key={i}
                className={`ransom-letter torn-text-bg font-grotesk text-4xl shadow-lg`}
                style={{
                  backgroundColor: i % 2 === 0 ? 'var(--paper-cream)' : (mode === 'focus' ? 'var(--accent-red)' : 'var(--accent-green)'),
                  color: i % 2 === 0 ? '#000' : (mode === 'focus' ? '#fff' : '#000'),
                  transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (2 + i % 3)}deg)`,
                }}
                variants={letterItem}
                custom={i}
                initial="initial"
                animate={!hasMounted ? "animate" : (isRunning ? {
                  opacity: 1,
                  scale: 1,
                  y: [0, -3, 0],
                  rotate: [(i % 2 === 0 ? -1 : 1) * (2 + i % 3), (i % 2 === 0 ? -1 : 1) * (2 + i % 3) + 1, (i % 2 === 0 ? -1 : 1) * (2 + i % 3)],
                } : {
                  opacity: 1,
                  scale: 1,
                })}
                transition={!hasMounted ? {
                  type: "spring",
                  damping: 12,
                  stiffness: 200
                } : {
                  duration: 2,
                  repeat: isRunning ? Infinity : 0,
                  ease: "easeInOut",
                  delay: i * 0.2,
                }}
                whileHover={{ scale: 1.15, rotate: 0 }}
              >
                {char}
              </motion.span>
            ))}
          </div>
          <motion.p
            className="text-center mt-6 font-mono text-xs opacity-50 tracking-[0.5em] uppercase"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ delay: entranceDelays.ransomLetters + 0.3 }}
          >
            Click to Switch
          </motion.p>
        </motion.div>

        {/* Timer Display */}
        <motion.div
          className="relative mb-6 sm:mb-8 md:mb-10 group text-center"
          variants={scaleIn}
          initial="initial"
          animate="animate"
          transition={{ delay: entranceDelays.timer }}
        >
          <div className="text-[4rem] sm:text-[6rem] md:text-[8rem] lg:text-[12rem] font-serif-custom italic leading-none tracking-tighter mix-blend-difference opacity-90 group-hover:scale-105 transition-transform duration-500 cursor-default select-none">
            {formatTime(timeLeft)}
          </div>
        </motion.div>

        {/* Progress Bar (Typewriter / Newspaper Style) - Separate from timer for stable width */}
        <motion.div
          className="w-64 sm:w-72 md:w-80 mb-8 sm:mb-10 md:mb-12 mx-auto"
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={{ delay: entranceDelays.progressBar }}
          style={{ originX: 0.5 }}
        >
          {/* Newspaper Header Line */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-px bg-white/30"></div>
            <span className="text-[8px] sm:text-[10px] font-mono uppercase tracking-[0.2em] sm:tracking-[0.3em] text-white/40">
              {mode === 'focus' ? 'session in progress' : 'break time'}
            </span>
            <div className="flex-1 h-px bg-white/30"></div>
          </div>

          {/* Typewriter Progress Track */}
          <div className="relative h-3 sm:h-4 bg-paper-cream/10 border border-white/10 overflow-hidden"
            style={{
              clipPath: 'polygon(0 20%, 2% 0, 98% 0, 100% 20%, 100% 80%, 98% 100%, 2% 100%, 0 80%)'
            }}>
            {/* Striped Background Pattern */}
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)'
              }}></div>

            {/* Progress Fill - "Ink" spreading effect */}
            <div
              className="h-full transition-all duration-1000 ease-linear relative overflow-hidden"
              style={{ width: `${progress}%` }}>
              {/* Halftone / Newspaper Dot Pattern */}
              <div
                className={`absolute inset-0 ${mode === 'focus' ? 'bg-accent-red' : 'bg-accent-green'} transition-colors duration-1000`}
                style={{
                  backgroundImage: `radial-gradient(circle, ${mode === 'focus' ? '#7f1d1d' : '#065f46'} 1px, transparent 1px)`,
                  backgroundSize: '4px 4px'
                }}></div>

              {/* Typewriter "ink stamp" edge effect */}
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-l from-black/30 to-transparent"></div>
            </div>

            {/* Typewriter Carriage Line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/60 shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-all duration-1000"
              style={{ left: `${progress}%` }}></div>
          </div>

          {/* Percentage Text - Newspaper Style */}
          <div className="flex justify-between mt-1 sm:mt-1.5 text-[8px] sm:text-[9px] font-mono text-white/30 uppercase tracking-widest">
            <span>00:00</span>
            <span className="text-white/50">{Math.round(progress)}%</span>
            <span>{formatTime(totalTime)}</span>
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div
          className="relative w-full max-w-md flex items-center justify-center"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <motion.button
            onClick={() => { toggleTimer(); playClick(); }}
            className={`group relative px-6 py-3 sm:px-8 sm:py-3 md:px-10 md:py-4 bg-paper-cream transition-all overflow-hidden border-2 border-black hover:-translate-y-1 active:translate-y-1 active:shadow-none`}
            style={{ boxShadow: '6px 6px 0 rgba(0,0,0,1)' }}
            variants={staggerItem}
          >
            <span className={`relative z-10 font-grotesk text-sm sm:text-base md:text-lg tracking-widest uppercase font-black flex items-center gap-2 sm:gap-3 ${mode === 'focus' ? 'text-accent-red group-hover:text-white' : 'text-accent-green group-hover:text-white'}`}>
              {isRunning ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" strokeWidth={3} /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" strokeWidth={3} />}
              {isRunning ? 'Pause' : 'Start'}
            </span>
            <div className={`absolute inset-0 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ${mode === 'focus' ? 'bg-accent-red' : 'bg-accent-green'}`}></div>
          </motion.button>

          <motion.button
            onClick={() => { resetTimer(); playClick(); }}
            className="absolute right-0 p-3 sm:p-4 rounded-none border-2 border-white/20 hover:border-white transition-all group bg-white/5 hover:bg-white/10 hover:-translate-y-1 active:translate-y-0"
            style={{ boxShadow: '4px 4px 0 rgba(0,0,0,0.5)' }}
            variants={staggerItem}
          >
            <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-white/50 group-hover:text-white group-hover:-rotate-180 transition-all duration-500" strokeWidth={3} />
          </motion.button>
        </motion.div>
      </main>

      {/* Quote Footer - Poetic Fragment */}
      <motion.footer
        className="absolute bottom-12 sm:bottom-10 md:bottom-8 left-0 right-0 text-center z-20 pointer-events-none px-4"
        variants={slideUp}
        initial="initial"
        animate="animate"
        transition={{ delay: entranceDelays.quote }}
      >
        <motion.div
          className="inline-block bg-black text-white px-3 py-1.5 sm:px-4 sm:py-2 font-serif-custom italic text-sm sm:text-lg md:text-xl transform -rotate-1 border border-white/20 shadow-lg pointer-events-auto hover:rotate-1 transition-transform duration-300 max-w-[90vw]"
          whileHover={{ scale: 1.05, rotate: 1 }}
        >
          {MODES[mode].quote}
        </motion.div>
      </motion.footer>

      {/* Marquee Tape (Bottom Fixed) */}
      <RadioWidget mode={mode} />
      <motion.div
        className={`fixed bottom-0 left-0 w-full overflow-hidden py-2 transform rotate-0 z-30 border-t-4 border-black mix-blend-normal transition-colors duration-1000 ${mode === 'focus' ? 'bg-accent-red' : 'bg-accent-green'}`}
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: entranceDelays.ticker, duration: 0.5 }}
        style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}
      >
        <div className="whitespace-nowrap flex animate-ticker">
          <span className="mx-4 font-black font-marker text-black text-sm tracking-widest leading-none">FOCUS / CREATE / BREATHE / KESHI MODE /</span>
          <span className="mx-4 font-black font-marker text-black text-sm tracking-widest leading-none">FOCUS / CREATE / BREATHE / KESHI MODE /</span>
          <span className="mx-4 font-black font-marker text-black text-sm tracking-widest leading-none">FOCUS / CREATE / BREATHE / KESHI MODE /</span>
          <span className="mx-4 font-black font-marker text-black text-sm tracking-widest leading-none">FOCUS / CREATE / BREATHE / KESHI MODE /</span>
          <span className="mx-4 font-black font-marker text-black text-sm tracking-widest leading-none">FOCUS / CREATE / BREATHE / KESHI MODE /</span>
          <span className="mx-4 font-black font-marker text-black text-sm tracking-widest leading-none">FOCUS / CREATE / BREATHE / KESHI MODE /</span>
        </div>
      </motion.div>

      <AnimatePresence>
        {taskPendingDelete && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-task-title"
          >
            <motion.div
              className="w-full max-w-sm border-2 border-paper-cream bg-black p-5 text-paper-cream shadow-[10px_10px_0_rgba(0,0,0,0.85)]"
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2 text-accent-red">
                    <Trash2 className="h-4 w-4" strokeWidth={3} />
                    <span className="text-[10px] font-black uppercase tracking-[0.24em]">Delete task</span>
                  </div>
                  <h2 id="delete-task-title" className="truncate font-grotesk text-xl font-black leading-tight">
                    {taskPendingDelete.title}
                  </h2>
                </div>
                <button
                  onClick={() => { setTaskPendingDelete(null); playClick(); }}
                  className="grid h-9 w-9 shrink-0 place-items-center border-2 border-white/15 bg-white/5 text-white/60 hover:border-white/60 hover:text-white"
                  aria-label="Cancel delete task"
                >
                  <X className="h-4 w-4" strokeWidth={3} />
                </button>
              </div>

              <p className="mb-5 font-mono text-xs leading-relaxed text-white/55">
                This will remove the task{(taskPendingDelete.subtasks?.length ?? 0) > 0 ? ` and ${taskPendingDelete.subtasks?.length} subtask${taskPendingDelete.subtasks?.length === 1 ? '' : 's'}` : ''} from the sprint list.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setTaskPendingDelete(null); playClick(); }}
                  className="border-2 border-white/20 px-4 py-3 font-grotesk text-xs font-black uppercase tracking-widest text-white/70 transition-colors hover:border-white hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { confirmDeleteTask(); playClick(); }}
                  className="border-2 border-black bg-accent-red px-4 py-3 font-grotesk text-xs font-black uppercase tracking-widest text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
                  style={{ boxShadow: '4px 4px 0 rgba(0,0,0,1)' }}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        {showSettings && (
          <SettingsModal
            isOpen={showSettings}
            onClose={() => { setShowSettings(false); saveSettings(); }}
            focusTime={focusTime}
            breakTime={breakTime}
            setFocusTime={setFocusTime}
            setBreakTime={setBreakTime}
            soundEnabled={soundEnabled}
            toggleSound={() => setSoundEnabled(!soundEnabled)}
            openHistory={() => setShowHistory(true)}
            openAnalytics={() => setShowAnalytics(true)}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showHistory && (
          <HistoryModal
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
            history={history}
            clearHistory={clearHistory}
            onBack={() => { setShowHistory(false); setShowSettings(true); }}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showAnalytics && (
          <AnalyticsModal
            isOpen={showAnalytics}
            onClose={() => setShowAnalytics(false)}
            history={history}
            onBack={() => { setShowAnalytics(false); setShowSettings(true); }}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Calendar,
  Clock3,
  History as HistoryIcon,
  Image as ImageIcon,
  Settings2,
  Trash2,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ThemeSettings } from './ThemeSettings';
import type { HistoryItem } from '../types';

type SettingsTab = 'general' | 'theme';
export type InsightsTab = 'overview' | 'history';

interface PanelShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  eyebrow: string;
  subtitle: string;
  icon: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

function PanelShell({
  isOpen,
  onClose,
  title,
  eyebrow,
  subtitle,
  icon: Icon,
  children,
  footer,
  wide = false,
}: PanelShellProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label="Close panel"
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden border-2 border-white/15 bg-[#0b0b0b] text-paper-cream shadow-[12px_12px_0_rgba(0,0,0,0.85)] ${
              wide ? 'max-w-3xl' : 'max-w-xl'
            }`}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-accent-green/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-accent-red/10 blur-3xl" />

            <header className="relative z-10 flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-accent-green">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {eyebrow}
                </div>
                <h2 id={titleId} className="mt-2 font-grotesk text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-white/50">{subtitle}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="grid h-11 w-11 shrink-0 place-items-center border-2 border-white/10 bg-white/[0.03] text-white/55 transition hover:border-white/30 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green active:translate-y-px"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={3} />
              </button>
            </header>

            <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar px-5 py-5 sm:px-6">{children}</div>

            {footer && (
              <footer className="relative z-10 border-t border-white/10 bg-black/30 px-5 py-4 sm:px-6">{footer}</footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ id: T; label: string; icon: LucideIcon }>;
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-2 border-2 border-white/10 bg-white/[0.03] p-1" role="tablist">
      {options.map(option => {
        const Icon = option.icon;
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={`inline-flex min-h-11 items-center justify-center gap-2 px-3 text-xs font-black uppercase tracking-[0.16em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green active:translate-y-px ${
              active
                ? 'bg-paper-cream text-black'
                : 'text-white/45 hover:bg-white/[0.05] hover:text-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  focusTime: number;
  breakTime: number;
  setFocusTime: (time: number) => void;
  setBreakTime: (time: number) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  openInsights?: (tab?: InsightsTab) => void;
  /** @deprecated use openInsights */
  openHistory?: () => void;
  /** @deprecated use openAnalytics */
  openAnalytics?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  focusTime,
  breakTime,
  setFocusTime,
  setBreakTime,
  soundEnabled,
  toggleSound,
  openInsights,
  openHistory,
  openAnalytics,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  useEffect(() => {
    if (isOpen) setActiveTab('general');
  }, [isOpen]);

  const goInsights = (tab: InsightsTab) => {
    onClose();
    if (openInsights) {
      openInsights(tab);
      return;
    }
    if (tab === 'history') openHistory?.();
    else openAnalytics?.();
  };

  return (
    <PanelShell
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      eyebrow="Timer / Preferences"
      subtitle="Tune focus length, sound, and visual theme without leaving the void."
      icon={Settings2}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-12 w-full items-center justify-center border-2 border-black bg-accent-red px-4 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-cream active:translate-y-px"
        >
          Save changes
        </button>
      }
    >
      <SegmentedTabs
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { id: 'general', label: 'General', icon: Settings2 },
          { id: 'theme', label: 'Theme', icon: ImageIcon },
        ]}
      />

      {activeTab === 'general' ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => goInsights('history')}
              className="border-2 border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/25 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green active:translate-y-px"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Records</div>
              <div className="mt-2 flex items-center gap-2 font-grotesk text-lg font-black text-white">
                <HistoryIcon className="h-4 w-4 text-accent-red" strokeWidth={2.5} />
                Session history
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/45">Browse completed focus and break sessions.</p>
            </button>
            <button
              type="button"
              onClick={() => goInsights('overview')}
              className="border-2 border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/25 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green active:translate-y-px"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Insights</div>
              <div className="mt-2 flex items-center gap-2 font-grotesk text-lg font-black text-white">
                <BarChart3 className="h-4 w-4 text-accent-green" strokeWidth={2.5} />
                Analytics
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/45">Totals, streaks, and top tasks at a glance.</p>
            </button>
          </div>

          <div className="space-y-4 border-2 border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div>
              <label htmlFor="settings-focus-duration" className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-accent-red">
                Focus duration (minutes)
              </label>
              <input
                id="settings-focus-duration"
                type="number"
                min={1}
                value={focusTime}
                onChange={event => setFocusTime(parseInt(event.target.value, 10) || 0)}
                className="min-h-12 w-full border-2 border-white/10 bg-black/35 px-3 font-mono text-sm text-white outline-none transition focus:border-white/35"
              />
            </div>
            <div>
              <label htmlFor="settings-break-duration" className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-accent-green">
                Relax duration (minutes)
              </label>
              <input
                id="settings-break-duration"
                type="number"
                min={1}
                value={breakTime}
                onChange={event => setBreakTime(parseInt(event.target.value, 10) || 0)}
                className="min-h-12 w-full border-2 border-white/10 bg-black/35 px-3 font-mono text-sm text-white outline-none transition focus:border-white/35"
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Sound</div>
                <p className="mt-1 text-xs text-white/40">{soundEnabled ? 'Clicks and cues enabled' : 'Silent mode'}</p>
              </div>
              <button
                type="button"
                onClick={toggleSound}
                className={`inline-flex min-h-11 items-center gap-2 border-2 px-3 text-xs font-black uppercase tracking-[0.14em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green active:translate-y-px ${
                  soundEnabled
                    ? 'border-accent-green/50 bg-accent-green/10 text-accent-green'
                    : 'border-white/10 bg-white/[0.03] text-white/40'
                }`}
                aria-pressed={soundEnabled}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {soundEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ThemeSettings />
      )}
    </PanelShell>
  );
};

interface InsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  clearHistory: () => void;
  initialTab?: InsightsTab;
}

export const InsightsModal: React.FC<InsightsModalProps> = ({
  isOpen,
  onClose,
  history,
  clearHistory,
  initialTab = 'overview',
}) => {
  const [activeTab, setActiveTab] = useState<InsightsTab>(initialTab);

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  const stats = useMemo(() => {
    const focusSessions = history.filter(item => item.mode === 'focus');
    const breakSessions = history.filter(item => item.mode !== 'focus');
    const totalMinutes = focusSessions.reduce((acc, item) => acc + item.duration, 0);
    const totalSessions = focusSessions.length;
    const avgMinutes = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

    const taskTotals = focusSessions.reduce<Record<string, number>>((acc, item) => {
      const task = item.taskTitle?.trim() || 'Unassigned';
      acc[task] = (acc[task] ?? 0) + item.duration;
      return acc;
    }, {});
    const topTaskEntry = Object.entries(taskTotals).sort((a, b) => b[1] - a[1])[0];
    const topTask = topTaskEntry?.[0] ?? 'TBD';
    const topTaskMinutes = topTaskEntry?.[1] ?? 0;

    const hourBuckets = focusSessions.reduce<Record<number, number>>((acc, item) => {
      const hour = new Date(item.date).getHours();
      if (!Number.isFinite(hour)) return acc;
      acc[hour] = (acc[hour] ?? 0) + item.duration;
      return acc;
    }, {});
    const bestHourEntry = Object.entries(hourBuckets).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    const bestTime = bestHourEntry
      ? new Date(2000, 0, 1, Number(bestHourEntry[0])).toLocaleTimeString('en-US', {
          hour: 'numeric',
        })
      : 'TBD';

    const uniqueDays = new Set(
      focusSessions
        .map(item => item.businessDate || item.date.slice(0, 10))
        .filter(Boolean),
    );

    const insight =
      totalSessions === 0
        ? 'The journey of a thousand miles begins with a single step.'
        : totalMinutes > 120
          ? "You're in the zone. Pure energy."
          : totalMinutes > 60
            ? 'Solid progress. Keep the rhythm.'
            : 'Building momentum.';

    return {
      minutes: totalMinutes,
      sessions: totalSessions,
      breaks: breakSessions.length,
      avgMinutes,
      bestTime,
      topTask,
      topTaskMinutes,
      activeDays: uniqueDays.size,
      insight,
    };
  }, [history]);

  return (
    <PanelShell
      isOpen={isOpen}
      onClose={onClose}
      title="Insights"
      eyebrow="History / Analytics"
      subtitle="One place for session records and focus signal."
      icon={BarChart3}
      wide
      footer={
        activeTab === 'history' && history.length > 0 ? (
          <button
            type="button"
            onClick={clearHistory}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 border-2 border-white/20 bg-transparent px-4 text-xs font-black uppercase tracking-[0.16em] text-white/70 transition hover:border-accent-red/60 hover:bg-accent-red/10 hover:text-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-red active:translate-y-px"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.5} />
            Clear history
          </button>
        ) : undefined
      }
    >
      <SegmentedTabs
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'history', label: 'History', icon: HistoryIcon },
        ]}
      />

      {activeTab === 'overview' ? (
        <div className="space-y-4">
          <div className="border-2 border-white/15 bg-white/[0.035] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-green">Signal</div>
            <p className="mt-3 font-serif-custom text-xl font-bold leading-tight text-white sm:text-2xl">
              {stats.insight}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              {stats.sessions === 0
                ? 'Complete a focus session to unlock analytics.'
                : `${stats.activeDays} active day${stats.activeDays === 1 ? '' : 's'} tracked from local history.`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Clock3} label="Focus minutes" value={`${stats.minutes}`} accent="text-accent-red" />
            <StatCard icon={Zap} label="Focus sessions" value={`${stats.sessions}`} accent="text-accent-green" />
            <StatCard icon={Calendar} label="Best window" value={stats.bestTime} accent="text-sky-300" />
            <StatCard icon={TrendingUp} label="Avg session" value={stats.sessions ? `${stats.avgMinutes}m` : 'TBD'} accent="text-amber-300" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="border-2 border-white/10 bg-black/25 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Top task</div>
              <div className="mt-3 truncate font-grotesk text-xl font-black text-white">{stats.topTask}</div>
              <p className="mt-2 text-xs text-white/45">
                {stats.topTaskMinutes > 0 ? `${stats.topTaskMinutes} focused minutes` : 'No assigned task yet'}
              </p>
            </article>
            <article className="border-2 border-white/10 bg-black/25 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Breaks logged</div>
              <div className="mt-3 font-grotesk text-xl font-black text-white">{stats.breaks}</div>
              <p className="mt-2 text-xs text-white/45">Recover sessions kept alongside focus history.</p>
            </article>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-white/10 bg-black/20 px-5 py-12 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-white/20">
                <HistoryIcon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-semibold text-white/40">No sessions recorded yet.</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-accent-green">
                Finish a timer to start the log
              </p>
            </div>
          ) : (
            history.map(item => (
              <article
                key={item.id}
                className="flex items-center justify-between gap-4 border-2 border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                <div className="min-w-0">
                  <span
                    className={`inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                      item.mode === 'focus'
                        ? 'border-accent-red/40 bg-accent-red/10 text-accent-red'
                        : 'border-accent-green/40 bg-accent-green/10 text-accent-green'
                    }`}
                  >
                    {item.mode}
                  </span>
                  <div className="mt-2 font-mono text-xs font-bold text-white/45">{item.date}</div>
                  {item.taskTitle && (
                    <div className="mt-1 truncate font-grotesk text-sm font-black text-white">{item.taskTitle}</div>
                  )}
                  {item.syncError && (
                    <div className="mt-1 font-mono text-[10px] font-bold text-accent-red">Sync pending</div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-grotesk text-2xl font-black text-white">{item.duration}</div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">min</div>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </PanelShell>
  );
};

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <article className="border-2 border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${accent}`} strokeWidth={2.5} />
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{label}</div>
      </div>
      <div className="mt-3 truncate font-grotesk text-2xl font-black text-white">{value}</div>
    </article>
  );
}

/** Back-compat aliases used by older imports. */
export const HistoryModal = InsightsModal;
export const AnalyticsModal = InsightsModal;

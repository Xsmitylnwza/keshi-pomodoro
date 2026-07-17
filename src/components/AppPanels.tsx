import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Calendar,
  Clock3,
  Image as ImageIcon,
  Link2,
  Settings2,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ThemeSettings } from './ThemeSettings';
import type { HistoryItem } from '../types';
import type { AppCalendarSettings } from '../lib/appSettingsApi';

type SettingsTab = 'general' | 'theme' | 'calendar';

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
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      closeRef.current?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.button
            type="button"
            aria-label="Close panel"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className={`relative z-10 flex max-h-[min(92vh,52rem)] w-full flex-col border-2 border-white/20 bg-[#0b0b0b] text-white shadow-[10px_10px_0_rgba(0,0,0,0.75)] sm:max-h-[min(88vh,48rem)] ${
              wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'
            }`}
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  <Icon className="h-3.5 w-3.5 text-accent-green" strokeWidth={2.5} />
                  {eyebrow}
                </div>
                <h2 id={titleId} className="mt-2 font-grotesk text-2xl font-black tracking-tight text-white">
                  {title}
                </h2>
                <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-white/45">
                  {subtitle}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="grid h-11 w-11 shrink-0 place-items-center border-2 border-white/10 bg-white/[0.03] text-white/60 transition hover:border-white/30 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green active:translate-y-px"
                aria-label={`Close ${title}`}
              >
                <X className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>

            {footer ? <div className="border-t border-white/10 px-4 py-4 sm:px-6">{footer}</div> : null}
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
  onChange: (next: T) => void;
  options: Array<{ id: T; label: string; icon: LucideIcon }>;
}) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-2 border-2 border-white/10 bg-black/30 p-1.5" role="tablist">
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
            className={`inline-flex min-h-11 items-center justify-center gap-2 px-3 text-[11px] font-black uppercase tracking-[0.14em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green active:translate-y-px ${
              active
                ? 'border border-white/20 bg-white text-black'
                : 'border border-transparent text-white/45 hover:bg-white/[0.05] hover:text-white'
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
  calendarSettings: AppCalendarSettings;
  setCalendarSettings: (next: AppCalendarSettings) => void;
  openInsights?: () => void;
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
  calendarSettings,
  setCalendarSettings,
  openInsights,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  useEffect(() => {
    if (isOpen) setActiveTab('general');
  }, [isOpen]);

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
          { id: 'calendar', label: 'Calendar', icon: Calendar },
          { id: 'theme', label: 'Theme', icon: ImageIcon },
        ]}
      />

      {activeTab === 'general' ? (
        <div className="space-y-5">
          {openInsights ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                openInsights();
              }}
              className="w-full border-2 border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/25 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green active:translate-y-px"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Insights</div>
              <div className="mt-2 flex items-center gap-2 font-grotesk text-lg font-black text-white">
                <BarChart3 className="h-4 w-4 text-accent-green" strokeWidth={2.5} />
                Focus analytics
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/45">Totals, streaks, and top tasks at a glance.</p>
            </button>
          ) : null}

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
      ) : activeTab === 'calendar' ? (
        <div className="space-y-5">
          <div className="space-y-4 border-2 border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Google Calendar</div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Show events from a secret Google Calendar ICS link. Read-only — does not write back.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCalendarSettings({ ...calendarSettings, enabled: !calendarSettings.enabled })}
                className={`inline-flex min-h-11 items-center gap-2 border-2 px-3 text-xs font-black uppercase tracking-[0.14em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green active:translate-y-px ${
                  calendarSettings.enabled
                    ? 'border-accent-green/50 bg-accent-green/10 text-accent-green'
                    : 'border-white/10 bg-white/[0.03] text-white/40'
                }`}
                aria-pressed={calendarSettings.enabled}
              >
                <Calendar className="h-4 w-4" />
                {calendarSettings.enabled ? 'On' : 'Off'}
              </button>
            </div>

            <div>
              <label htmlFor="settings-calendar-ics" className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-paper-cream/70">
                Secret ICS URL
              </label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  id="settings-calendar-ics"
                  type="url"
                  value={calendarSettings.icsUrl}
                  onChange={event => setCalendarSettings({ ...calendarSettings, icsUrl: event.target.value })}
                  placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                  className="min-h-12 w-full border-2 border-white/10 bg-black/35 py-2 pl-10 pr-3 font-mono text-xs text-white outline-none transition placeholder:text-white/25 focus:border-white/35"
                />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-white/35">
                Google Calendar → Settings → Integrate calendar → Secret address in iCal format.
              </p>
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
}

export const InsightsModal: React.FC<InsightsModalProps> = ({
  isOpen,
  onClose,
  history,
}) => {
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
      eyebrow="Focus signal"
      subtitle="Aggregated focus stats from completed sessions."
      icon={BarChart3}
      wide
    >
      <div className="space-y-4">
        <div className="border-2 border-white/15 bg-white/[0.035] p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-green">Signal</div>
          <p className="mt-3 font-serif-custom text-xl font-bold leading-tight text-white sm:text-2xl">
            {stats.insight}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            {stats.sessions === 0
              ? 'Complete a focus session to unlock analytics.'
              : `${stats.activeDays} active day${stats.activeDays === 1 ? '' : 's'} tracked from completed sessions.`}
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
            <p className="mt-2 text-xs text-white/45">Recovery sessions kept alongside focus totals.</p>
          </article>
        </div>
      </div>
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

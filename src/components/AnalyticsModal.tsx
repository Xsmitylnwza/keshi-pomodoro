import React, { useMemo } from 'react';
import { X, TrendingUp, Clock, Calendar, Zap, ChevronLeft } from 'lucide-react';
import type { HistoryItem } from '../types';

interface AnalyticsModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: HistoryItem[];
    onBack: () => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ isOpen, onClose, history, onBack }) => {
    if (!isOpen) return null;

    // Calculate Stats
    const stats = useMemo(() => {
        const focusSessions = history.filter(h => h.mode === 'focus');
        const totalMinutes = focusSessions.reduce((acc, curr) => acc + curr.duration, 0);
        const totalSessions = focusSessions.length;
        const streak = totalSessions > 0 ? 'Active' : 'N/A';
        const taskTotals = focusSessions.reduce<Record<string, number>>((acc, curr) => {
            const task = curr.taskTitle ?? 'Unassigned';
            acc[task] = (acc[task] ?? 0) + curr.duration;
            return acc;
        }, {});
        const topTask = Object.entries(taskTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'TBD';

        // Simplified best time logic for stability
        const bestTime = totalSessions > 0 ? 'Evening' : 'TBD';

        return { minutes: totalMinutes, sessions: totalSessions, bestTime, streak, topTask };
    }, [history]);

    // Generate Insights
    const getInsight = () => {
        if (stats.sessions === 0) return "The journey of a thousand miles begins with a single step.";
        if (stats.minutes > 120) return "You're in the zone. Pure energy.";
        if (stats.minutes > 60) return "Solid progress. Keep the rhythm.";
        return "Building momentum.";
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 transition-all duration-500">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>

            <div className="relative bg-paper-cream text-black w-full max-w-lg p-8 transform transition-transform duration-500 animate-in fade-in zoom-in-95 torn-paper-1" style={{ boxShadow: '12px 12px 0 rgba(0,0,0,1)' }}>
                {/* Header Controls */}
                <button onClick={onBack} className="absolute top-6 left-6 text-black/50 hover:text-black transition-colors flex items-center gap-1 group">
                    <ChevronLeft size={24} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Back</span>
                </button>
                <button onClick={onClose} className="absolute top-6 right-6 text-black/50 hover:text-accent-red transition-all hover:scale-110">
                    <X size={24} strokeWidth={3} />
                </button>

                <div className="mt-8 mb-8 flex items-end justify-between border-b-2 border-black/10 pb-4">
                    <div>
                        <h2 className="font-marker text-4xl uppercase tracking-wider mb-1 text-black">Insights</h2>
                        <p className="font-serif italic text-black/60 font-bold">Performance report</p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-transparent border-2 border-black rounded-none group hover:-translate-y-1 transition-transform" style={{ boxShadow: '4px 4px 0 rgba(0,0,0,1)' }}>
                        <div className="flex items-center gap-2 mb-2 text-black/50">
                            <Clock size={16} strokeWidth={3} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-black">Total Focus</span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-grotesk font-black text-black">
                            {Math.floor(stats.minutes / 60)}<span className="text-sm text-black/50 ml-1">h</span> {stats.minutes % 60}<span className="text-sm text-black/50 ml-1">m</span>
                        </div>
                    </div>
                    <div className="p-4 bg-transparent border-2 border-black rounded-none group hover:-translate-y-1 transition-transform" style={{ boxShadow: '4px 4px 0 rgba(0,0,0,1)' }}>
                        <div className="flex items-center gap-2 mb-2 text-black/50">
                            <TrendingUp size={16} strokeWidth={3} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-black">Sessions</span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-grotesk font-black text-black">
                            {stats.sessions}
                        </div>
                    </div>
                    <div className="p-4 bg-transparent border-2 border-black rounded-none group hover:-translate-y-1 transition-transform" style={{ boxShadow: '4px 4px 0 rgba(0,0,0,1)' }}>
                        <div className="flex items-center gap-2 mb-2 text-black/50">
                            <Calendar size={16} strokeWidth={3} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-black">Top Task</span>
                        </div>
                        <div className="text-xl font-grotesk font-black uppercase text-black truncate">
                            {stats.topTask}
                        </div>
                    </div>
                    <div className="p-4 bg-transparent border-2 border-black rounded-none group hover:-translate-y-1 transition-transform" style={{ boxShadow: '4px 4px 0 rgba(0,0,0,1)' }}>
                        <div className="flex items-center gap-2 mb-2 text-black/50">
                            <Zap size={16} strokeWidth={3} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-black">Vibe</span>
                        </div>
                        <div className="text-xl font-grotesk font-black uppercase text-accent-green">
                            {stats.sessions > 5 ? 'Flowing' : 'Building'}
                        </div>
                    </div>
                </div>

                {/* Report Summary */}
                <div className="relative p-6 border-l-4 border-accent-green bg-black/5 font-serif-custom italic text-lg leading-relaxed text-black/80 font-bold" style={{ boxShadow: '4px 4px 0 rgba(0,0,0,0.1)' }}>
                    <span className="absolute -left-3 -top-3 text-4xl text-black/20 font-serif">"</span>
                    {getInsight()}
                </div>
            </div>
        </div>
    );
};

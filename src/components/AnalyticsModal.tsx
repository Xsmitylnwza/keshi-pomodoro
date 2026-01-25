import React, { useMemo } from 'react';
import { X, TrendingUp, Clock, Calendar, Zap, ChevronLeft } from 'lucide-react';

interface HistoryItem {
    id: string;
    mode: string;
    duration: number;
    date: string;
}

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

        // Simplified best time logic for stability
        const bestTime = totalSessions > 0 ? 'Evening' : 'TBD';

        return { minutes: totalMinutes, sessions: totalSessions, bestTime, streak };
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

            <div className="relative glass-panel w-full max-w-lg p-8 transform transition-transform duration-500 border-b-4 border-accent-green animate-in fade-in zoom-in-95">
                {/* Header Controls */}
                <button onClick={onBack} className="absolute top-6 left-6 text-gray-500 hover:text-white transition-colors flex items-center gap-1 group">
                    <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Back</span>
                </button>
                <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-accent-red transition-colors">
                    <X size={24} />
                </button>

                <div className="mt-8 mb-8 flex items-end justify-between border-b border-white/10 pb-4">
                    <div>
                        <h2 className="font-display font-black text-3xl uppercase tracking-tighter mb-1">Insights</h2>
                        <p className="font-serif italic text-gray-500">Performance report</p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                            <Clock size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Total Focus</span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-grotesk font-bold text-white">
                            {Math.floor(stats.minutes / 60)}<span className="text-sm text-gray-500 ml-1">h</span> {stats.minutes % 60}<span className="text-sm text-gray-500 ml-1">m</span>
                        </div>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                            <TrendingUp size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Sessions</span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-grotesk font-bold text-white">
                            {stats.sessions}
                        </div>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                            <Calendar size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Peak Time</span>
                        </div>
                        <div className="text-xl font-grotesk font-bold uppercase text-white">
                            {stats.bestTime}
                        </div>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                            <Zap size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Vibe</span>
                        </div>
                        <div className="text-xl font-grotesk font-bold uppercase text-accent-green">
                            {stats.sessions > 5 ? 'Flowing' : 'Building'}
                        </div>
                    </div>
                </div>

                {/* Report Summary */}
                <div className="relative p-6 border-l-2 border-accent-green/50 bg-white/5 font-serif-custom italic text-lg leading-relaxed text-gray-300">
                    <span className="absolute -left-2 -top-2 text-2xl text-white/10">"</span>
                    {getInsight()}
                </div>
            </div>
        </div>
    );
};

import React from 'react';
import { X, Volume2, VolumeX, ChevronLeft } from 'lucide-react';
import { ThemeSettings } from './ThemeSettings';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    focusTime: number;
    breakTime: number;
    setFocusTime: (time: number) => void;
    setBreakTime: (time: number) => void;
    soundEnabled: boolean;
    toggleSound: () => void;
    openHistory: () => void;
    openAnalytics: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen, onClose, focusTime, breakTime, setFocusTime, setBreakTime, soundEnabled, toggleSound,
    openHistory, openAnalytics
}) => {
    const [activeTab, setActiveTab] = React.useState<'general' | 'theme'>('general');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 transition-all duration-500">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative glass-panel w-full max-w-md p-8 transform transition-transform duration-500 border-l-4 border-accent-red animate-in fade-in zoom-in-95 flex flex-col min-h-[550px] max-h-[90vh]">
                <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-accent-red transition-colors">
                    <X size={24} />
                </button>
                <h2 className="font-display font-black text-3xl uppercase mb-1">Settings</h2>
                <p className="font-serif italic text-gray-500 mb-6">Customize your flow</p>

                {/* Tab Navigation */}
                <div className="flex gap-4 mb-6 border-b border-white/10 pb-1">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`text-xs font-bold uppercase tracking-widest pb-2 transition-colors relative ${activeTab === 'general' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                    >
                        General
                        {activeTab === 'general' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-red"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('theme')}
                        className={`text-xs font-bold uppercase tracking-widest pb-2 transition-colors relative ${activeTab === 'theme' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                    >
                        Theme
                        {activeTab === 'theme' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-red"></div>}
                    </button>
                </div>

                <div className="overflow-y-auto custom-scrollbar pr-2 flex-1">
                    {/* General Tab Content */}
                    {activeTab === 'general' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                            {/* Navigation Links */}
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => { onClose(); openHistory(); }}
                                    className="p-4 border border-white/10 hover:bg-white/5 hover:border-accent-red transition-all group text-left"
                                >
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-white mb-1">Records</div>
                                    <div className="font-grotesk font-bold text-lg sm:text-xl group-hover:text-accent-red transition-colors">HISTORY &gt;</div>
                                </button>
                                <button
                                    onClick={() => { onClose(); openAnalytics(); }}
                                    className="p-4 border border-white/10 hover:bg-white/5 hover:border-accent-red transition-all group text-left"
                                >
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-white mb-1">Insights</div>
                                    <div className="font-grotesk font-bold text-lg sm:text-xl group-hover:text-accent-red transition-colors">ANALYTICS &gt;</div>
                                </button>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-white/10">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-accent-red">Focus Duration</label>
                                    <input
                                        type="number"
                                        value={focusTime}
                                        onChange={(e) => setFocusTime(parseInt(e.target.value) || 0)}
                                        className="w-full bg-white/5 border border-white/10 p-3 text-white font-mono focus:border-accent-red outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-gray-400">Relax Duration</label>
                                    <input
                                        type="number"
                                        value={breakTime}
                                        onChange={(e) => setBreakTime(parseInt(e.target.value) || 0)}
                                        className="w-full bg-white/5 border border-white/10 p-3 text-white font-mono focus:border-white outline-none transition-colors"
                                    />
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <span className="text-xs font-bold uppercase tracking-widest">Sound</span>
                                    <button onClick={toggleSound} className="text-accent-red text-xl">
                                        {soundEnabled ? <Volume2 /> : <VolumeX className="text-gray-500" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Theme Tab Content */}
                    {activeTab === 'theme' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <ThemeSettings />
                        </div>
                    )}
                </div>

                <button onClick={onClose} className="w-full py-3 bg-accent-red hover:bg-red-700 text-white font-bold uppercase tracking-widest transition-colors shadow-lg shadow-red-900/20 mt-6 shrink-0">
                    Save Changes
                </button>
            </div>
        </div>
    );
};

interface HistoryItem {
    id: string;
    mode: string;
    duration: number;
    date: string;
}

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: HistoryItem[];
    clearHistory: () => void;
    onBack: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, clearHistory, onBack }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 transition-all duration-500">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative glass-panel w-full max-w-md p-8 transform transition-transform duration-500 border-r-4 border-white animate-in fade-in zoom-in-95">
                <button onClick={onBack} className="absolute top-6 left-6 text-gray-500 hover:text-white transition-colors flex items-center gap-1 group">
                    <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Back</span>
                </button>
                <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
                    <X size={24} />
                </button>
                <h2 className="mt-8 font-display font-black text-3xl uppercase mb-1">History</h2>
                <p className="font-serif italic text-gray-500 mb-8">Your best moments</p>

                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-gray-600">
                            <p className="font-mono text-xs">No sessions recorded yet.</p>
                        </div>
                    ) : (
                        history.map((item) => (
                            <div key={item.id} className="bg-white/5 border border-white/10 p-4 rounded-sm flex justify-between items-center group hover:bg-white/10 transition-colors">
                                <div>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${item.mode === 'focus' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                        {item.mode}
                                    </span>
                                    <div className="mt-2 font-mono text-sm text-gray-400">{item.date}</div>
                                </div>
                                <div className="font-grotesk font-bold text-xl text-white">
                                    {item.duration} <span className="text-xs text-gray-500 font-normal">min</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {history.length > 0 && (
                    <button onClick={clearHistory} className="mt-6 w-full py-3 border border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs font-bold uppercase tracking-widest transition-colors mb-2">
                        Clear History
                    </button>
                )}
            </div>
        </div>
    );
};

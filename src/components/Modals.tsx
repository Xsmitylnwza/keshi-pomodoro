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
            <div className="relative bg-paper-cream text-black w-full max-w-md p-8 transform transition-transform duration-500 animate-in fade-in zoom-in-95 flex flex-col min-h-[550px] max-h-[90vh] torn-paper-1" style={{ boxShadow: '12px 12px 0 rgba(0,0,0,1)' }}>
                <button onClick={onClose} className="absolute top-6 right-6 text-black/50 hover:text-accent-red hover:scale-110 transition-all">
                    <X size={24} strokeWidth={3} />
                </button>
                <h2 className="font-marker text-4xl uppercase mb-1 tracking-wider text-black">Settings</h2>
                <p className="font-serif italic text-black/60 mb-6 font-bold">Customize your flow</p>

                {/* Tab Navigation */}
                <div className="flex gap-4 mb-6 border-b-2 border-black/10 pb-1">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`text-xs font-bold uppercase tracking-widest pb-2 transition-colors relative ${activeTab === 'general' ? 'text-black' : 'text-black/40 hover:text-black'}`}
                    >
                        General
                        {activeTab === 'general' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent-red"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('theme')}
                        className={`text-xs font-bold uppercase tracking-widest pb-2 transition-colors relative ${activeTab === 'theme' ? 'text-black' : 'text-black/40 hover:text-black'}`}
                    >
                        Theme
                        {activeTab === 'theme' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent-red"></div>}
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
                                    className="p-4 border-2 border-black/20 hover:bg-black/5 hover:border-black transition-all group text-left hover:-translate-y-1" style={{ boxShadow: '4px 4px 0 rgba(0,0,0,0.1)' }}
                                >
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-black/50 group-hover:text-black mb-1">Records</div>
                                    <div className="font-grotesk font-black text-lg sm:text-xl group-hover:text-accent-red transition-colors">HISTORY &gt;</div>
                                </button>
                                <button
                                    onClick={() => { onClose(); openAnalytics(); }}
                                    className="p-4 border-2 border-black/20 hover:bg-black/5 hover:border-black transition-all group text-left hover:-translate-y-1" style={{ boxShadow: '4px 4px 0 rgba(0,0,0,0.1)' }}
                                >
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-black/50 group-hover:text-black mb-1">Insights</div>
                                    <div className="font-grotesk font-black text-lg sm:text-xl group-hover:text-accent-green transition-colors">ANALYTICS &gt;</div>
                                </button>
                            </div>

                            <div className="space-y-4 pt-4 border-t-2 border-black/10">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-accent-red">Focus Duration</label>
                                    <input
                                        type="number"
                                        value={focusTime}
                                        onChange={(e) => setFocusTime(parseInt(e.target.value) || 0)}
                                        className="w-full bg-transparent border-2 border-black/20 p-3 text-black font-mono focus:border-black outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-black/50">Relax Duration</label>
                                    <input
                                        type="number"
                                        value={breakTime}
                                        onChange={(e) => setBreakTime(parseInt(e.target.value) || 0)}
                                        className="w-full bg-transparent border-2 border-black/20 p-3 text-black font-mono focus:border-black outline-none transition-colors"
                                    />
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <span className="text-xs font-bold uppercase tracking-widest">Sound</span>
                                    <button onClick={toggleSound} className="text-black hover:scale-110 transition-transform">
                                        {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} className="text-black/30" />}
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

                <button onClick={onClose} className="w-full py-3 bg-accent-red hover:bg-red-700 text-white font-bold uppercase tracking-widest transition-transform shadow-lg mt-6 shrink-0 active:translate-y-1 active:shadow-none font-grotesk" style={{ boxShadow: '4px 4px 0 rgba(0,0,0,1)' }}>
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
            <div className="relative bg-paper-cream text-black w-full max-w-md p-8 transform transition-transform duration-500 animate-in fade-in zoom-in-95 torn-paper-2" style={{ boxShadow: '-12px 12px 0 rgba(0,0,0,1)' }}>
                <button onClick={onBack} className="absolute top-6 left-6 text-black/50 hover:text-black transition-colors flex items-center gap-1 group">
                    <ChevronLeft size={24} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Back</span>
                </button>
                <button onClick={onClose} className="absolute top-6 right-6 text-black/50 hover:text-black transition-colors hover:scale-110">
                    <X size={24} strokeWidth={3} />
                </button>
                <h2 className="mt-8 font-marker text-4xl uppercase mb-1 tracking-wider text-black">History</h2>
                <p className="font-serif italic text-black/60 mb-8 font-bold">Your best moments</p>

                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar space-y-4 pr-2">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-black/50">
                            <p className="font-mono text-xs font-bold">No sessions recorded yet.</p>
                        </div>
                    ) : (
                        history.map((item) => (
                            <div key={item.id} className="bg-transparent border-2 border-black p-4 flex justify-between items-center group hover:-translate-y-1 transition-transform" style={{ boxShadow: '4px 4px 0 rgba(0,0,0,1)' }}>
                                <div>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 border-2 border-current ${item.mode === 'focus' ? 'text-accent-red bg-accent-red/10' : 'text-accent-green bg-accent-green/10'}`}>
                                        {item.mode}
                                    </span>
                                    <div className="mt-2 font-mono text-sm text-black/60 font-bold">{item.date}</div>
                                </div>
                                <div className="font-grotesk font-black text-2xl text-black">
                                    {item.duration} <span className="text-xs text-black/50 font-bold">min</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {history.length > 0 && (
                    <button onClick={clearHistory} className="mt-8 w-full py-3 border-2 border-black text-black hover:bg-black hover:text-white text-xs font-bold uppercase tracking-widest transition-all mb-2 active:translate-y-1 font-grotesk">
                        Clear History
                    </button>
                )}
            </div>
        </div>
    );
};

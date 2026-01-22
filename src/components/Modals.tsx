import React from 'react';
import { X, Volume2, VolumeX } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    focusTime: number;
    breakTime: number;
    setFocusTime: (t: number) => void;
    setBreakTime: (t: number) => void;
    soundEnabled: boolean;
    toggleSound: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen, onClose, focusTime, breakTime, setFocusTime, setBreakTime, soundEnabled, toggleSound
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 transition-all duration-500">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative glass-panel w-full max-w-md p-8 transform transition-transform duration-500 border-l-4 border-accent-red animate-in fade-in zoom-in-95">
                <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-accent-red transition-colors">
                    <X size={24} />
                </button>
                <h2 className="font-display font-black text-3xl uppercase mb-1">Settings</h2>
                <p className="font-serif italic text-gray-500 mb-8">Customize your flow</p>

                <div className="space-y-6">
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
                    <button onClick={onClose} className="w-full py-3 bg-accent-red hover:bg-red-700 text-white font-bold uppercase tracking-widest transition-colors shadow-lg shadow-red-900/20">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};


interface HistoryItem {
    mode: string;
    duration: number;
    date: string;
}

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: HistoryItem[];
    clearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, clearHistory }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 transition-all duration-500">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative glass-panel w-full max-w-md p-8 transform transition-transform duration-500 border-r-4 border-white animate-in fade-in zoom-in-95">
                <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
                    <X size={24} />
                </button>
                <h2 className="font-display font-black text-3xl uppercase mb-1">History</h2>
                <p className="font-serif italic text-gray-500 mb-8">Your best moments</p>

                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {history.length === 0 ? (
                        <div className="text-center py-8 text-gray-600 italic">No sessions yet</div>
                    ) : (
                        history.map((item, idx) => (
                            <div key={idx} className={`bg-white/5 p-3 flex justify-between items-center border-l-2 ${item.mode === 'focus' ? 'border-accent-red' : 'border-white'}`}>
                                <div>
                                    <div className={`text-xs font-bold uppercase tracking-wider ${item.mode === 'focus' ? 'text-red-400' : 'text-white'}`}>{item.mode}</div>
                                    <div className="text-[10px] text-gray-500">{item.date}</div>
                                </div>
                                <div className="font-display font-bold text-lg">{item.duration}m</div>
                            </div>
                        ))
                    )}
                </div>
                <button onClick={clearHistory} className="mt-6 text-xs font-bold uppercase tracking-widest text-accent-red hover:text-red-400 transition-colors w-full text-center">
                    Clear All Records
                </button>
            </div>
        </div>
    );
};

import { useState, useEffect, useRef } from 'react';
import { Menu, Play, Pause, RotateCcw, History as HistoryIcon } from 'lucide-react';
import { CustomCursor } from './components/CustomCursor';
import Background from './components/Background';
import { SettingsModal, HistoryModal } from './components/Modals';

type TimerMode = 'focus' | 'break';

const MODES = {
  focus: {
    label: 'FOCUS',
    color: '#b91c1c', // accent-red
    bgColor: 'bg-bg-dark',
    quote: '"I only show you the best of me."'
  },
  break: {
    label: 'RELAX',
    color: '#34d399', // accent-green
    bgColor: 'bg-bg-forest',
    quote: '"Take a breath. You earned this."'
  }
};

interface HistoryItem {
  mode: string;
  duration: number;
  date: string;
  id: string; // Add ID for better key management
}

function App() {
  // State
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [focusTime, setFocusTime] = useState(25);
  const [breakTime, setBreakTime] = useState(5);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clickSoundRef = useRef<HTMLAudioElement | null>(null);

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

    const sFocus = localStorage.getItem('keshi-focus');
    const sBreak = localStorage.getItem('keshi-break');
    if (sFocus) setFocusTime(parseInt(sFocus));
    if (sBreak) setBreakTime(parseInt(sBreak));
    if (sFocus) setFocusTime(parseInt(sFocus));
    if (sBreak) setBreakTime(parseInt(sBreak));
  }, []);

  // Favicon Updater
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) return;
    // We can use the same logo but if we had a green one we'd swap it.
    // Since we don't, we just ensure it points to the correct static asset.
    link.href = '/logo.png';
  }, [mode]);

  // Timer Logic
  useEffect(() => {
    let interval: number;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0) {
      handleComplete();
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  // Document Title
  useEffect(() => {
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    document.title = `${m}:${s} • ${mode.toUpperCase()}`;
  }, [timeLeft, mode]);

  const handleComplete = () => {
    setIsRunning(false);
    if (soundEnabled && audioRef.current) audioRef.current.play();

    // Add to history with unique ID
    const newItem: HistoryItem = {
      mode: mode,
      duration: mode === 'focus' ? focusTime : breakTime,
      date: new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', month: 'short', day: 'numeric' }),
      id: crypto.randomUUID()
    };
    const newHistory = [newItem, ...history];
    setHistory(newHistory);
    localStorage.setItem('keshi_pomodoro_history', JSON.stringify(newHistory));

    const newMode = mode === 'focus' ? 'break' : 'focus';
    setMode(newMode);
    setTimeLeft((newMode === 'focus' ? focusTime : breakTime) * 60);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft((mode === 'focus' ? focusTime : breakTime) * 60);
  };

  const switchMode = (newMode: TimerMode) => {
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalTime = (mode === 'focus' ? focusTime : breakTime) * 60;
  // Calculate progress ensuring we don't divide by zero
  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  return (
    <div className={`min-h-screen ${MODES[mode].bgColor} text-paper-cream relative overflow-hidden flex flex-col font-grotesk transition-colors duration-1000 ease-in-out`}>
      <CustomCursor />
      <Background mode={mode} />

      {/* Audio */}
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />
      <audio ref={clickSoundRef} src="https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3" preload="auto" />

      {/* Grain Overlay handled globally in index.css (.noise-overlay) */}
      <div className="noise-overlay"></div>

      {/* Navigation (Floating / Minimal) */}
      <nav className="fixed top-0 left-0 right-0 z-40 p-6 flex justify-between items-start mix-blend-difference" style={{ viewTransitionName: 'main-nav' }}>
        <div className="flex items-center gap-4 group cursor-pointer">
          <div className="w-12 h-12 relative">
            <img src="/profile.jpg"
              alt="Logo"
              className="w-full h-full object-cover rounded-full border-2 border-paper-cream grayscale group-hover:scale-110 group-hover:grayscale-0 transition-all duration-300" />
          </div>
          <span className="font-grotesk font-bold text-xl tracking-widest text-paper-cream">
            DEV<span className="text-accent-red">.</span>GABRIEL
          </span>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <button onClick={() => { setShowSettings(true); playClick(); }}
            className={`text-sm tracking-widest uppercase transition-colors font-bold flex items-center gap-2 group ${mode === 'focus' ? 'hover:text-accent-red' : 'hover:text-accent-green'}`}>
            <span>Menu</span>
            <Menu className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
          <div className={`${mode === 'focus' ? 'bg-accent-red' : 'bg-accent-green'} ${mode === 'focus' ? 'text-white' : 'text-black'} text-[10px] px-2 py-0.5 transform -rotate-2 font-bold shadow-sm transition-colors duration-500`}>
            KESHI MODE V2.0
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex-grow flex flex-col items-center justify-center p-4">

        {/* Ransom Note Title - Mode Switcher */}
        <div className="mb-12 relative group cursor-pointer" onClick={() => { switchMode(mode === 'focus' ? 'break' : 'focus'); playClick(); }}>
          <div className={`absolute inset-0 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${mode === 'focus' ? 'bg-accent-red/20' : 'bg-accent-green/20'}`}></div>
          <div className="flex flex-wrap justify-center gap-1 sm:gap-2 pointer-events-auto select-none scale-125 md:scale-150 transition-transform duration-300 group-hover:scale-[1.6]">
            {MODES[mode].label.split('').map((char, i) => (
              <span key={i} className={`ransom-letter torn-text-bg font-grotesk text-4xl shadow-lg`}
                style={{
                  transform: `rotate(${Math.random() * 10 - 5}deg)`,
                  backgroundColor: i % 2 === 0 ? '#f2efe9' : (mode === 'focus' ? '#b91c1c' : '#34d399'),
                  color: i % 2 === 0 ? '#000' : (mode === 'focus' ? '#fff' : '#000')
                }}>
                {char}
              </span>
            ))}
          </div>
          <p className="text-center mt-6 font-mono text-xs opacity-50 tracking-[0.5em] uppercase">Click to Switch</p>
        </div>

        {/* Timer Display */}
        <div className="relative mb-12 group">
          <div className="text-[8rem] md:text-[12rem] font-serif-custom italic leading-none tracking-tighter mix-blend-difference opacity-90 group-hover:scale-105 transition-transform duration-500 cursor-default select-none">
            {formatTime(timeLeft)}
          </div>

          {/* Progress Bar (Tape Style) */}
          <div className="w-64 h-2 bg-white/10 mt-4 rounded-full overflow-hidden mx-auto border border-white/20">
            <div className="h-full transition-all duration-1000 ease-linear relative" style={{ width: `${progress}%`, backgroundColor: MODES[mode].color }}>
              <div className="absolute inset-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-30"></div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-8">
          <button onClick={() => { resetTimer(); playClick(); }} className="p-4 rounded-full border border-white/10 hover:border-white/50 hover:bg-white/5 transition-all group">
            <RotateCcw className="w-6 h-6 text-white/50 group-hover:text-white group-hover:-rotate-180 transition-all duration-500" />
          </button>

          <button onClick={() => { setIsRunning(!isRunning); playClick(); }}
            className={`group relative px-10 py-4 bg-transparent border border-white/30 transition-colors overflow-hidden ${mode === 'focus' ? 'hover:border-accent-red' : 'hover:border-accent-green'}`}>
            <span className="relative z-10 font-grotesk text-lg tracking-widest uppercase font-bold group-hover:text-white flex items-center gap-3">
              {isRunning ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              {isRunning ? 'Pause' : 'Start'}
            </span>
            <div className={`absolute inset-0 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ${mode === 'focus' ? 'bg-accent-red' : 'bg-accent-green'}`}></div>
          </button>

          <button onClick={() => { setShowHistory(true); playClick(); }} className="p-4 rounded-full border border-white/10 hover:border-white/50 hover:bg-white/5 transition-all group">
            <HistoryIcon className="w-6 h-6 text-white/50 group-hover:text-white transition-colors" />
          </button>
        </div>
      </main>

      {/* Quote Footer - Poetic Fragment */}
      <footer className="absolute bottom-8 left-0 right-0 text-center z-20 pointer-events-none">
        <div className="inline-block bg-black text-white px-4 py-2 font-serif-custom italic text-xl transform -rotate-1 border border-white/20 shadow-lg pointer-events-auto hover:rotate-1 transition-transform duration-300">
          {MODES[mode].quote}
        </div>
      </footer>

      {/* Marquee Tape (Bottom Fixed) */}
      <div className={`fixed bottom-0 left-0 w-full overflow-hidden py-1 transform rotate-0 z-30 border-t-2 border-black mix-blend-normal transition-colors duration-1000 ${mode === 'focus' ? 'bg-accent-red' : 'bg-accent-green'}`}>
        <div className="whitespace-nowrap flex animate-ticker">
          <span className="mx-4 font-bold text-black uppercase tracking-widest text-xs">• FOCUS • CREATE • BREATHE • KESHI MODE •</span>
          <span className="mx-4 font-bold text-black uppercase tracking-widest text-xs">• FOCUS • CREATE • BREATHE • KESHI MODE •</span>
          <span className="mx-4 font-bold text-black uppercase tracking-widest text-xs">• FOCUS • CREATE • BREATHE • KESHI MODE •</span>
          <span className="mx-4 font-bold text-black uppercase tracking-widest text-xs">• FOCUS • CREATE • BREATHE • KESHI MODE •</span>
          <span className="mx-4 font-bold text-black uppercase tracking-widest text-xs">• FOCUS • CREATE • BREATHE • KESHI MODE •</span>
          <span className="mx-4 font-bold text-black uppercase tracking-widest text-xs">• FOCUS • CREATE • BREATHE • KESHI MODE •</span>
        </div>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => { setShowSettings(false); saveSettings(); }}
        focusTime={focusTime}
        breakTime={breakTime}
        setFocusTime={setFocusTime}
        setBreakTime={setBreakTime}
        soundEnabled={soundEnabled}
        toggleSound={() => setSoundEnabled(!soundEnabled)}
      />

      <HistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        history={history}
        clearHistory={clearHistory}
      />
    </div>
  );
}

export default App;

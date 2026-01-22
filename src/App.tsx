import { useState, useEffect, useRef } from 'react';
import { Menu, Play, Pause, RotateCcw, History as HistoryIcon } from 'lucide-react';
import { CustomCursor } from './components/CustomCursor';
import Background from './components/Background';
import { SettingsModal, HistoryModal } from './components/Modals';
import { RadioWidget } from './components/RadioWidget';

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

  // Keyboard Shortcuts (Enter / Spacebar to toggle timer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or modal is open
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (showSettings || showHistory) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsRunning(prev => !prev);
        playClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSettings, showHistory, soundEnabled]);

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
      <nav className="fixed top-0 left-0 right-0 z-40 p-3 sm:p-4 md:p-6 flex justify-between items-start mix-blend-difference" style={{ viewTransitionName: 'main-nav' }}>
        <div className="flex items-center gap-2 sm:gap-4 group cursor-pointer">
          <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 relative">
            <img src="/profile.jpg"
              alt="Logo"
              className="w-full h-full object-cover rounded-full border-2 border-paper-cream grayscale group-hover:scale-110 group-hover:grayscale-0 transition-all duration-300" />
          </div>
          <span className="font-grotesk font-bold text-sm sm:text-lg md:text-xl tracking-widest text-paper-cream hidden sm:inline">
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
        <div className="relative mb-6 sm:mb-8 md:mb-10 group text-center">
          <div className="text-[4rem] sm:text-[6rem] md:text-[8rem] lg:text-[12rem] font-serif-custom italic leading-none tracking-tighter mix-blend-difference opacity-90 group-hover:scale-105 transition-transform duration-500 cursor-default select-none">
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress Bar (Typewriter / Newspaper Style) - Separate from timer for stable width */}
        <div className="w-64 sm:w-72 md:w-80 mb-8 sm:mb-10 md:mb-12 mx-auto">
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
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 sm:gap-6 md:gap-8">
          <button onClick={() => { resetTimer(); playClick(); }} className="p-3 sm:p-4 rounded-full border border-white/10 hover:border-white/50 hover:bg-white/5 transition-all group">
            <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-white/50 group-hover:text-white group-hover:-rotate-180 transition-all duration-500" />
          </button>

          <button onClick={() => { setIsRunning(!isRunning); playClick(); }}
            className={`group relative px-6 py-3 sm:px-8 sm:py-3 md:px-10 md:py-4 bg-transparent border border-white/30 transition-colors overflow-hidden ${mode === 'focus' ? 'hover:border-accent-red' : 'hover:border-accent-green'}`}>
            <span className="relative z-10 font-grotesk text-sm sm:text-base md:text-lg tracking-widest uppercase font-bold group-hover:text-white flex items-center gap-2 sm:gap-3">
              {isRunning ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
              {isRunning ? 'Pause' : 'Start'}
            </span>
            <div className={`absolute inset-0 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ${mode === 'focus' ? 'bg-accent-red' : 'bg-accent-green'}`}></div>
          </button>

          <button onClick={() => { setShowHistory(true); playClick(); }} className="p-3 sm:p-4 rounded-full border border-white/10 hover:border-white/50 hover:bg-white/5 transition-all group">
            <HistoryIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white/50 group-hover:text-white transition-colors" />
          </button>
        </div>
      </main>

      {/* Quote Footer - Poetic Fragment */}
      <footer className="absolute bottom-12 sm:bottom-10 md:bottom-8 left-0 right-0 text-center z-20 pointer-events-none px-4">
        <div className="inline-block bg-black text-white px-3 py-1.5 sm:px-4 sm:py-2 font-serif-custom italic text-sm sm:text-lg md:text-xl transform -rotate-1 border border-white/20 shadow-lg pointer-events-auto hover:rotate-1 transition-transform duration-300 max-w-[90vw]">
          {MODES[mode].quote}
        </div>
      </footer>

      {/* Marquee Tape (Bottom Fixed) */}
      <RadioWidget mode={mode} />
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

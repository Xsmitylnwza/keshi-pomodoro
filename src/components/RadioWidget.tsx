import React, { useState, useRef, useEffect } from 'react';
import { Radio, Play, Pause, SkipForward, Volume2, VolumeX, ChevronLeft, ChevronRight } from 'lucide-react';

interface RadioStation {
    id: string;
    name: string;
    shortName: string;
    youtubeId: string;
}

const STATIONS: RadioStation[] = [
    { id: '1', name: 'Lofi Girl', shortName: 'LOFI', youtubeId: 'jfKfPfyJRdk' },
    { id: '2', name: 'Chillhop Music', shortName: 'CHILL', youtubeId: '5yx6BWlEVcY' },
    { id: '3', name: 'Lofi Cafe', shortName: 'CAFE', youtubeId: 'h2zkV-l_TbY' },
    { id: '4', name: 'Jazz Hop Café', shortName: 'JAZZ', youtubeId: '-5KAN9_CzSA' },
];

interface RadioWidgetProps {
    mode: 'focus' | 'break';
}

export const RadioWidget: React.FC<RadioWidgetProps> = ({ mode }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentStation, setCurrentStation] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(50);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const station = STATIONS[currentStation];
    const bgAccent = mode === 'focus' ? '#b91c1c' : '#34d399';
    const glowColor = mode === 'focus' ? 'rgba(185, 28, 28, 0.4)' : 'rgba(52, 211, 153, 0.4)';

    // Show tooltip on first visit
    useEffect(() => {
        const hasSeenTooltip = localStorage.getItem('keshi_radio_tooltip_seen');
        if (!hasSeenTooltip) {
            setShowTooltip(true);
            const timer = setTimeout(() => {
                setShowTooltip(false);
                localStorage.setItem('keshi_radio_tooltip_seen', 'true');
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, []);

    // YouTube Player API control
    useEffect(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            const command = isPlaying ? 'playVideo' : 'pauseVideo';
            iframeRef.current.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: command }),
                '*'
            );
        }
    }, [isPlaying]);

    useEffect(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            const command = isMuted ? 'mute' : 'unMute';
            iframeRef.current.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: command }),
                '*'
            );
        }
    }, [isMuted]);

    // Volume control
    useEffect(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: 'setVolume', args: [volume] }),
                '*'
            );
        }
    }, [volume]);

    const nextStation = () => {
        setCurrentStation((prev) => (prev + 1) % STATIONS.length);
        if (isPlaying) {
            setIsPlaying(false);
            setTimeout(() => setIsPlaying(true), 100);
        }
    };

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
        if (showTooltip) {
            setShowTooltip(false);
            localStorage.setItem('keshi_radio_tooltip_seen', 'true');
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseInt(e.target.value);
        setVolume(newVolume);
        if (newVolume === 0) {
            setIsMuted(true);
        } else if (isMuted) {
            setIsMuted(false);
        }
    };

    return (
        <>
            {/* Hidden YouTube Player */}
            <div className="fixed -left-[9999px] -top-[9999px] w-0 h-0 overflow-hidden">
                <iframe
                    ref={iframeRef}
                    width="1"
                    height="1"
                    src={`https://www.youtube.com/embed/${station.youtubeId}?enablejsapi=1&autoplay=${isPlaying ? 1 : 0}&loop=1&playlist=${station.youtubeId}`}
                    allow="autoplay; encrypted-media"
                    title="Radio Player"
                />
            </div>

            {/* First Visit Tooltip - Mood Board Style */}
            {showTooltip && (
                <div
                    className="fixed bottom-28 right-6 z-[60] cursor-pointer group"
                    style={{ animation: 'float 3s ease-in-out infinite' }}
                    onClick={() => {
                        setShowTooltip(false);
                        localStorage.setItem('keshi_radio_tooltip_seen', 'true');
                    }}
                >
                    <div className="bg-paper-cream text-black px-4 py-2 font-mono text-sm relative transform -rotate-2 border border-black shadow-lg group-hover:scale-105 transition-transform"
                        style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.3)' }}>
                        {/* Tape effect on top */}
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-3 bg-[#dbd8d0] opacity-80 transform rotate-1"></div>
                        {/* Close X */}
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white rounded-full flex items-center justify-center text-[8px] font-bold opacity-60 group-hover:opacity-100 transition-opacity">×</div>
                        <span className="tracking-wider uppercase text-xs">♪ play lo-fi</span>
                        <div className="text-[8px] text-black/50 mt-0.5 tracking-wide">click to dismiss</div>
                        {/* Arrow pointing to widget */}
                        <div className="absolute -bottom-2 right-6 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-paper-cream"></div>
                    </div>
                </div>
            )}

            {/* Radio Widget */}
            <div
                className={`fixed bottom-16 right-4 z-50 transition-all duration-500 ${isExpanded ? 'w-72' : 'w-20'}`}
            >
                {/* Main Container - Cassette Tape Style with Glow */}
                <div
                    className={`relative bg-[#1a1a1a] border-2 rounded-lg shadow-2xl overflow-hidden transition-all duration-500`}
                    style={{
                        borderColor: isPlaying ? bgAccent : 'rgba(255,255,255,0.2)',
                        boxShadow: `0 0 ${isPlaying ? '20px' : '15px'} ${isPlaying ? glowColor : 'rgba(255,255,255,0.1)'}`,
                        animation: !isPlaying ? 'pulse-radio 3s ease-in-out infinite' : 'none'
                    }}
                >
                    {/* Cassette Top Label */}
                    <div className="bg-[#222] px-3 py-1.5 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Radio className={`w-4 h-4 transition-colors duration-300`}
                                style={{ color: isPlaying ? bgAccent : 'rgba(255,255,255,0.5)' }} />
                            <span className="text-[10px] font-mono uppercase tracking-wider text-white/60">
                                {isExpanded ? 'LOFI RADIO' : 'RADIO'}
                            </span>
                        </div>
                        {isPlaying && (
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: bgAccent }}></div>
                                <span className="text-[8px] font-mono text-white/40">LIVE</span>
                            </div>
                        )}
                    </div>

                    {/* Main Body */}
                    <div className="p-3">
                        {/* Cassette Reels / Audio Visualizer */}
                        <div className="flex items-center justify-center gap-4 mb-3">
                            {/* Left Reel */}
                            <div className={`w-8 h-8 rounded-full bg-[#0a0a0a] border-2 border-[#333] flex items-center justify-center ${isPlaying ? 'animate-spin' : ''}`}
                                style={{ animationDuration: '3s' }}>
                                <div className="w-3 h-3 rounded-full bg-[#1a1a1a] border border-[#444]"></div>
                            </div>

                            {/* Tape Window / Audio Bars */}
                            {isExpanded ? (
                                <div className="flex-1 h-8 bg-[#0a0a0a] rounded border border-[#333] flex items-end justify-center gap-0.5 overflow-hidden px-2 py-1">
                                    {/* Audio Visualization Bars - Expanded (Slow & Chill) */}
                                    {[...Array(16)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="w-1 rounded-sm origin-bottom"
                                            style={{
                                                backgroundColor: bgAccent,
                                                height: '4px',
                                                animation: isPlaying ? `audioBarExpanded ${1.2 + (i % 5) * 0.3}s ease-in-out ${i * 0.08}s infinite alternate` : 'none'
                                            }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                /* Collapsed: Mini Audio Bars (Slow & Chill) */
                                <div className="flex items-end gap-0.5 h-6">
                                    {[...Array(4)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="w-1 rounded-sm origin-bottom"
                                            style={{
                                                backgroundColor: bgAccent,
                                                height: '4px',
                                                opacity: isPlaying ? 1 : 0.5,
                                                animation: isPlaying ? `audioBar ${1.5 + i * 0.4}s ease-in-out ${i * 0.15}s infinite alternate` : 'none'
                                            }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Right Reel */}
                            <div className={`w-8 h-8 rounded-full bg-[#0a0a0a] border-2 border-[#333] flex items-center justify-center ${isPlaying ? 'animate-spin' : ''}`}
                                style={{ animationDuration: '3s', animationDirection: 'reverse' }}>
                                <div className="w-3 h-3 rounded-full bg-[#1a1a1a] border border-[#444]"></div>
                            </div>
                        </div>

                        {/* Station Info (Expanded) */}
                        {isExpanded && (
                            <div className="text-center mb-3">
                                <div className="text-xs font-mono text-white/80 tracking-wider">{station.name}</div>
                                <div className="text-[10px] font-mono text-white/40 uppercase">YouTube Live</div>
                            </div>
                        )}

                        {/* Controls */}
                        <div className="flex items-center justify-center gap-2">
                            {/* Volume Button with Slider */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                                    onMouseEnter={() => setShowVolumeSlider(true)}
                                    className="p-1.5 rounded-full bg-[#0a0a0a] border border-white/10 hover:border-white/30 transition-colors"
                                >
                                    {isMuted || volume === 0 ? (
                                        <VolumeX className="w-3 h-3 text-white/50" />
                                    ) : (
                                        <Volume2 className="w-3 h-3 text-white/50" />
                                    )}
                                </button>

                                {/* Volume Slider Popup */}
                                {showVolumeSlider && (
                                    <div
                                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-[#1a1a1a] border border-white/20 rounded-lg shadow-xl"
                                        onMouseLeave={() => setShowVolumeSlider(false)}
                                    >
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={volume}
                                            onChange={handleVolumeChange}
                                            className="w-20 h-1 accent-current cursor-pointer"
                                            style={{ accentColor: bgAccent }}
                                        />
                                        <div className="text-[8px] text-center text-white/40 mt-1 font-mono">
                                            {volume}%
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Play/Pause - Main Button */}
                            <button
                                onClick={togglePlay}
                                className="p-2.5 rounded-full border-2 transition-all duration-300 hover:scale-110"
                                style={{
                                    backgroundColor: isPlaying ? bgAccent : 'transparent',
                                    borderColor: bgAccent
                                }}
                            >
                                {isPlaying ? (
                                    <Pause className="w-4 h-4" style={{ color: mode === 'focus' ? '#fff' : '#000' }} />
                                ) : (
                                    <Play className="w-4 h-4" style={{ color: bgAccent }} />
                                )}
                            </button>

                            {/* Next Station */}
                            <button
                                onClick={nextStation}
                                className="p-1.5 rounded-full bg-[#0a0a0a] border border-white/10 hover:border-white/30 transition-colors"
                            >
                                <SkipForward className="w-3 h-3 text-white/50" />
                            </button>
                        </div>

                        {/* Station Indicator Dots (Expanded) */}
                        {isExpanded && (
                            <div className="flex justify-center gap-1.5 mt-3">
                                {STATIONS.map((s, i) => (
                                    <button
                                        key={s.id}
                                        onClick={() => setCurrentStation(i)}
                                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentStation ? 'scale-125' : 'opacity-50 hover:opacity-80'
                                            }`}
                                        style={{ backgroundColor: i === currentStation ? bgAccent : '#666' }}
                                        title={s.name}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Expand/Collapse Toggle - Full Circle (Outside overflow container) */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="absolute top-1/2 -translate-y-1/2 -left-5 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-white/10 z-10"
                    style={{
                        backgroundColor: '#2a2a2a',
                        borderColor: '#444'
                    }}
                >
                    {isExpanded ? (
                        <ChevronRight className="w-5 h-5 text-white/70" />
                    ) : (
                        <ChevronLeft className="w-5 h-5 text-white/70" />
                    )}
                </button>

                {/* Frequency Display */}
                <div className="mt-1 text-center">
                    <span className="text-[8px] font-mono text-white/30 tracking-widest">
                        {station.shortName} • 88.{currentStation + 1} FM
                    </span>
                </div>
            </div>

            {/* Custom Styles for Animations */}
            <style>{`
        @keyframes pulse-radio {
          0%, 100% { box-shadow: 0 0 10px ${glowColor}; }
          50% { box-shadow: 0 0 20px ${glowColor}; }
        }
        @keyframes audioBar {
          0% { transform: scaleY(1); }
          50% { transform: scaleY(3); }
          100% { transform: scaleY(1.5); }
        }
        @keyframes audioBarExpanded {
          0% { transform: scaleY(1); }
          50% { transform: scaleY(4); }
          100% { transform: scaleY(2); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-8px) rotate(-1deg); }
        }
      `}</style>
        </>
    );
};

export default RadioWidget;

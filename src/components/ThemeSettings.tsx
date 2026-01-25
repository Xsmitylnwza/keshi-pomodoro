import React, { useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { RefreshCw, Image as ImageIcon, Trash2 } from 'lucide-react';

const COLOR_PRESETS = [
    { name: 'Keshi Red', value: '#b91c1c' },
    { name: 'Crimson', value: '#991b1b' },
    { name: 'Rose', value: '#be123c' },
    { name: 'Orange', value: '#c2410c' },
    { name: 'Amber', value: '#b45309' },
    { name: 'Keshi Green', value: '#34d399' },
    { name: 'Emerald', value: '#059669' },
    { name: 'Teal', value: '#0d9488' },
    { name: 'Cyan', value: '#0891b2' },
    { name: 'Sky', value: '#0284c7' },
    { name: 'Indigo', value: '#4338ca' },
    { name: 'Violet', value: '#7c3aed' },
    { name: 'Fuchsia', value: '#c026d3' },
    { name: 'Pink', value: '#db2777' },
];

export const ThemeSettings: React.FC = () => {
    const { colors, updateColor, resetTheme, leftImage, updateLeftImage, rightImage, updateRightImage } = useTheme();
    const focusInputRef = useRef<HTMLInputElement>(null);
    const breakInputRef = useRef<HTMLInputElement>(null);

    // Independent file refs
    const leftFileRef = useRef<HTMLInputElement>(null);
    const rightFileRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'left' | 'right') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (side === 'left') updateLeftImage(reader.result as string);
                else updateRightImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-3">
            {/* Header / Reset with slight separation */}
            <div className="flex justify-end border-b border-white/5 pb-2">
                <button
                    onClick={resetTheme}
                    className="text-white/30 text-[10px] flex items-center gap-1 hover:text-white transition-colors font-mono uppercase tracking-wider"
                    title="Reset to default"
                >
                    <RefreshCw size={10} /> Reset Default
                </button>
            </div>

            {/* Collage Photos Section */}
            <div>
                <div className="min-h-[2rem] mb-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-white block mb-1">Collage Photos</label>
                    <p className="text-[10px] text-gray-500 font-mono leading-tight">Customize the left and right fragments.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Left Photo */}
                    <div className="flex flex-col gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-white/50 tracking-widest">Left Side</span>
                            {leftImage && (
                                <button onClick={() => updateLeftImage(null)} className="text-red-400 hover:text-red-300 transition-colors">
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>

                        <div className="w-full aspect-[3/4] rounded-md overflow-hidden bg-black/20 border border-white/10 relative group cursor-pointer"
                            onClick={() => leftFileRef.current?.click()}>
                            {leftImage ? (
                                <img src={leftImage} alt="Left" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 gap-2 group-hover:text-white/40 transition-colors">
                                    <ImageIcon size={20} />
                                    <span className="text-[9px] uppercase tracking-widest">Upload</span>
                                </div>
                            )}
                        </div>
                        <input type="file" ref={leftFileRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'left')} />
                    </div>

                    {/* Right Photo */}
                    <div className="flex flex-col gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-white/50 tracking-widest">Right Side</span>
                            {rightImage && (
                                <button onClick={() => updateRightImage(null)} className="text-red-400 hover:text-red-300 transition-colors">
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>

                        <div className="w-full aspect-[3/4] rounded-md overflow-hidden bg-black/20 border border-white/10 relative group cursor-pointer"
                            onClick={() => rightFileRef.current?.click()}>
                            {rightImage ? (
                                <img src={rightImage} alt="Right" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 gap-2 group-hover:text-white/40 transition-colors">
                                    <ImageIcon size={20} />
                                    <span className="text-[9px] uppercase tracking-widest">Upload</span>
                                </div>
                            )}
                        </div>
                        <input type="file" ref={rightFileRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'right')} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Focus Color Section */}
                <div className="space-y-4">
                    <div className="min-h-[2rem]">
                        <label className="text-xs font-bold uppercase tracking-widest text-accent-red block mb-1">Focus Mode</label>
                        <p className="text-[10px] text-gray-500 font-mono leading-tight">Reflects your energy while working.</p>
                    </div>
                    <div className="flex gap-4 items-center bg-white/5 p-3 rounded-lg border border-white/5">
                        <div
                            className="w-10 h-10 rounded-full shadow-lg cursor-pointer relative overflow-hidden group hover:scale-105 transition-transform ring-2 ring-white/10"
                            style={{ backgroundColor: colors.focus }}
                            onClick={() => focusInputRef.current?.click()}
                        >
                            <input
                                ref={focusInputRef}
                                type="color"
                                value={colors.focus}
                                onChange={(e) => updateColor('focus', e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                        </div>
                        <div className="flex-1">
                            <input
                                type="text"
                                value={colors.focus}
                                onChange={(e) => updateColor('focus', e.target.value)}
                                className="w-full bg-transparent font-mono text-sm text-white focus:outline-none uppercase tracking-wider"
                            />
                            <div className="text-[9px] text-gray-600 uppercase tracking-widest mt-0.5">Hex Code</div>
                        </div>
                    </div>
                    {/* Tiny Swatches */}
                    <div className="flex flex-wrap gap-2">
                        {COLOR_PRESETS.slice(0, 7).map((c) => (
                            <button
                                key={c.value}
                                title={c.name}
                                className="w-6 h-6 rounded-full border border-white/10 hover:scale-110 hover:border-white transition-all"
                                style={{ backgroundColor: c.value }}
                                onClick={() => updateColor('focus', c.value)}
                            />
                        ))}
                    </div>
                </div>

                {/* Break Color Section */}
                <div className="space-y-4">
                    <div className="min-h-[2rem]">
                        <label className="text-xs font-bold uppercase tracking-widest text-accent-green block mb-1">Relax Mode</label>
                        <p className="text-[10px] text-gray-500 font-mono leading-tight">Sets the mood for your breaks.</p>
                    </div>
                    <div className="flex gap-4 items-center bg-white/5 p-3 rounded-lg border border-white/5">
                        <div
                            className="w-10 h-10 rounded-full shadow-lg cursor-pointer relative overflow-hidden group hover:scale-105 transition-transform ring-2 ring-white/10"
                            style={{ backgroundColor: colors.break }}
                            onClick={() => breakInputRef.current?.click()}
                        >
                            <input
                                ref={breakInputRef}
                                type="color"
                                value={colors.break}
                                onChange={(e) => updateColor('break', e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                        </div>
                        <div className="flex-1">
                            <input
                                type="text"
                                value={colors.break}
                                onChange={(e) => updateColor('break', e.target.value)}
                                className="w-full bg-transparent font-mono text-sm text-white focus:outline-none uppercase tracking-wider"
                            />
                            <div className="text-[9px] text-gray-600 uppercase tracking-widest mt-0.5">Hex Code</div>
                        </div>
                    </div>
                    {/* Tiny Swatches */}
                    <div className="flex flex-wrap gap-2">
                        {COLOR_PRESETS.slice(7).map((c) => (
                            <button
                                key={c.value}
                                title={c.name}
                                className="w-6 h-6 rounded-full border border-white/10 hover:scale-110 hover:border-white transition-all"
                                style={{ backgroundColor: c.value }}
                                onClick={() => updateColor('break', c.value)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

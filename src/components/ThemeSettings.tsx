import React, { useRef } from 'react';
import { useTheme } from '../context/useTheme';
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
  const leftFileRef = useRef<HTMLInputElement>(null);
  const rightFileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'left' | 'right') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (side === 'left') updateLeftImage(reader.result as string);
      else updateRightImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Theme kit</div>
          <p className="mt-1 text-xs text-white/45">Collage fragments and mode accents.</p>
        </div>
        <button
          type="button"
          onClick={resetTheme}
          className="inline-flex min-h-10 items-center gap-2 border border-white/10 bg-white/[0.03] px-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/45 transition hover:border-white/25 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green active:translate-y-px"
          title="Reset to default"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      <section>
        <div className="mb-3">
          <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-white">Collage photos</label>
          <p className="mt-1 text-xs text-white/40">Customize the left and right fragments.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { label: 'Left side', image: leftImage, clear: () => updateLeftImage(null), ref: leftFileRef, side: 'left' as const },
            { label: 'Right side', image: rightImage, clear: () => updateRightImage(null), ref: rightFileRef, side: 'right' as const },
          ].map(slot => (
            <div key={slot.label} className="flex flex-col gap-3 border-2 border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">{slot.label}</span>
                {slot.image && (
                  <button type="button" onClick={slot.clear} className="text-red-300 transition hover:text-red-200">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="relative aspect-[3/4] w-full overflow-hidden border border-white/10 bg-black/30 transition hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green"
                onClick={() => slot.ref.current?.click()}
              >
                {slot.image ? (
                  <img src={slot.image} alt={slot.label} className="h-full w-full object-cover opacity-85 transition hover:opacity-100" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/25">
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-[9px] font-black uppercase tracking-[0.16em]">Upload</span>
                  </div>
                )}
              </button>
              <input
                type="file"
                ref={slot.ref}
                className="hidden"
                accept="image/*"
                onChange={event => handleFileUpload(event, slot.side)}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5">
        <ColorSection
          label="Focus mode"
          hint="Reflects your energy while working."
          accent="text-accent-red"
          value={colors.focus}
          onChange={value => updateColor('focus', value)}
          inputRef={focusInputRef}
          presets={COLOR_PRESETS.slice(0, 7)}
        />
        <ColorSection
          label="Relax mode"
          hint="Sets the mood for your breaks."
          accent="text-accent-green"
          value={colors.break}
          onChange={value => updateColor('break', value)}
          inputRef={breakInputRef}
          presets={COLOR_PRESETS.slice(7)}
        />
      </div>
    </div>
  );
};

function ColorSection({
  label,
  hint,
  accent,
  value,
  onChange,
  inputRef,
  presets,
}: {
  label: string;
  hint: string;
  accent: string;
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  presets: Array<{ name: string; value: string }>;
}) {
  return (
    <section className="space-y-3 border-2 border-white/10 bg-white/[0.03] p-4">
      <div>
        <label className={`block text-[10px] font-black uppercase tracking-[0.18em] ${accent}`}>{label}</label>
        <p className="mt-1 text-xs text-white/40">{hint}</p>
      </div>
      <div className="flex items-center gap-4 border border-white/10 bg-black/25 p-3">
        <button
          type="button"
          className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-white/15 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green"
          style={{ backgroundColor: value }}
          onClick={() => inputRef.current?.click()}
          aria-label={`${label} color picker`}
        >
          <input
            ref={inputRef}
            type="color"
            value={value}
            onChange={event => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={value}
            onChange={event => onChange(event.target.value)}
            className="w-full bg-transparent font-mono text-sm uppercase tracking-wider text-white outline-none"
            aria-label={`${label} hex code`}
          />
          <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/30">Hex code</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map(preset => (
          <button
            key={preset.value}
            type="button"
            title={preset.name}
            className="h-6 w-6 rounded-full border border-white/10 transition hover:scale-110 hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green"
            style={{ backgroundColor: preset.value }}
            onClick={() => onChange(preset.value)}
          />
        ))}
      </div>
    </section>
  );
}

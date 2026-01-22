import React, { useEffect, useState } from 'react';
import { Star, Pin } from 'lucide-react';

// Using the images from the user's reference HTML for authentic vibe:
// Main: https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/be7bd51c-6dd7-4e04-a620-8108ef138948/1768838242918-60798e6e/Justin_and_Hailey_Bieber___.jpg
// Logo: https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/be7bd51c-6dd7-4e04-a620-8108ef138948/1768838209454-e8f8239a/___________4_.jpg

interface BackgroundProps {
    mode: 'focus' | 'break';
}

const Background: React.FC<BackgroundProps> = ({ mode }) => {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const x = (e.clientX / window.innerWidth) * 2 - 1;
            const y = (e.clientY / window.innerHeight) * 2 - 1;
            setMousePos({ x, y });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const parallax = (strength: number) => ({
        transform: `translate(${mousePos.x * strength}px, ${mousePos.y * strength}px) rotate(var(--r, 0deg))`
    });

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Grain Overlay handled in index.css */}

            {/* Decorative Background Elements */}
            <div className="absolute top-10 left-[-20px] opacity-20 transform rotate-12 transition-transform duration-100 ease-out"
                style={{ ...parallax(-20), '--r': '12deg' } as React.CSSProperties}>
                <img src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/be7bd51c-6dd7-4e04-a620-8108ef138948/1768838242918-60798e6e/Justin_and_Hailey_Bieber___.jpg"
                    className="w-64 h-80 object-cover grayscale contrast-150 blur-sm" alt="decorative" />
            </div>

            <div className="absolute bottom-20 right-[-30px] opacity-10 transform -rotate-12 transition-transform duration-100 ease-out"
                style={{ ...parallax(-30), '--r': '-12deg' } as React.CSSProperties}>
                <img src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/be7bd51c-6dd7-4e04-a620-8108ef138948/1768838242918-60798e6e/Justin_and_Hailey_Bieber___.jpg"
                    className="w-72 h-96 object-cover sepia contrast-125" alt="decorative" />
            </div>

            {/* Center Collage Elements - Positioned absolutely to frame the main content */}

            {/* Main Image - Torn Paper Left */}
            <div className="absolute top-1/4 left-[10%] hidden lg:block animate-float" style={{ '--r': '-3deg' } as React.CSSProperties}>
                <div className="relative w-72 h-96 bg-white p-2 torn-paper-1 shadow-2xl transform -rotate-3 transition-transform duration-500 hover:rotate-0 hover:scale-105 z-10 pointer-events-auto">
                    <img src="/left.jpg"
                        alt="Artist Portrait"
                        className="w-full h-full object-cover grayscale sepia-[.4] contrast-125 brightness-90 hover:grayscale-0 hover:sepia-0 hover:contrast-100 hover:brightness-100 transition-all duration-500" />

                    {/* Tape Strip */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-[#dbd8d0] opacity-80 transform rotate-2 shadow-sm backdrop-blur-sm"></div>

                    {/* Vision Board Pin (Realistic Tack) */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20">
                        <div className={`w-3 h-3 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.4)] border border-black/10 transition-colors duration-1000 ${mode === 'focus' ? 'bg-[#b91c1c] shadow-red-900/30' : 'bg-[#34d399] shadow-emerald-900/30'}`}>
                            {/* Tiny highlight for 3D effect */}
                            <div className="absolute top-0.5 left-0.5 w-1 h-1 bg-white/40 rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Secondary Fragment - Torn Paper Right */}
            <div className="absolute bottom-1/4 right-[10%] hidden lg:block animate-float" style={{ '--r': '5deg', animationDelay: '1s' } as React.CSSProperties}>
                <div className={`w-56 h-56 overflow-hidden border-4 border-white shadow-xl transform rotate-6 torn-paper-2 group pointer-events-auto hover:rotate-3 transition-all duration-1000 ${mode === 'focus' ? 'bg-accent-red' : 'bg-accent-green'}`}>
                    <img src="/right.jpg"
                        className="w-full h-full object-cover scale-150 object-top mix-blend-multiply opacity-80 grayscale sepia-[.4] contrast-125 brightness-90 group-hover:opacity-100 transition-opacity" alt="fragment" />
                </div>
                {/* Vision Board Pin */}

            </div>

            {/* Sticker Stars */}
            <div className="absolute top-[15%] left-[5%] animate-pulse-glow z-0">
                <Star className="w-12 h-12 text-white fill-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] transform rotate-12" />
            </div>
            <div className={`absolute bottom-[20%] right-[5%] opacity-60 transition-colors duration-1000 ${mode === 'focus' ? 'text-accent-red fill-accent-red' : 'text-accent-green fill-accent-green'}`}>
                <Star className="w-8 h-8 transform -rotate-12" />
            </div>

            {/* Random text fragments */}
            <div className="absolute bottom-10 left-10 z-0 opacity-50">
                <div className="bg-black text-white px-3 py-1 font-serif-custom italic text-lg transform -rotate-3 border border-white/20 shadow-lg">
                    "in the void"
                </div>
            </div>

            <div className="absolute top-32 right-20 z-0 opacity-60">
                <div className="bg-paper-cream text-black px-2 py-0.5 text-xs font-mono transform rotate-6 border border-black shadow-md">
                    keshi.mode_v2
                </div>
            </div>
        </div>
    );
};

export default Background;

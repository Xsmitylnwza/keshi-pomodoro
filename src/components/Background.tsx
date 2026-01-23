import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import {
    tossInLeft,
    tossInRight,
    starPop,
    fragmentSlide,
    entranceDelays,
} from '../utils/animations';

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

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Grain Overlay handled in index.css */}

            {/* Decorative Background Elements - Hidden on mobile */}
            <motion.div
                className="hidden md:block absolute top-10 left-[-20px] opacity-20"
                initial={{ opacity: 0, scale: 0.5, x: -100 }}
                animate={{
                    opacity: 0.2,
                    scale: 1,
                    x: mousePos.x * -30,
                    y: mousePos.y * -20,
                    rotate: 12 + mousePos.x * 3,
                }}
                transition={{
                    opacity: { delay: entranceDelays.collageLeft + 0.5, duration: 1 },
                    scale: { delay: entranceDelays.collageLeft + 0.5, duration: 1 },
                    x: { type: "spring", stiffness: 30, damping: 20 },
                    y: { type: "spring", stiffness: 30, damping: 20 },
                    rotate: { type: "spring", stiffness: 50, damping: 30 },
                }}
            >
                <img src="/Hailey Bieber & Justin bieber, 2022_.jpg"
                    className="w-64 h-80 object-cover grayscale contrast-150 blur-sm" alt="decorative" />
            </motion.div>

            <motion.div
                className="hidden md:block absolute bottom-20 right-[-30px] opacity-10"
                initial={{ opacity: 0, scale: 0.5, x: 100 }}
                animate={{
                    opacity: 0.1,
                    scale: 1,
                    x: mousePos.x * -40,
                    y: mousePos.y * -25,
                    rotate: -12 + mousePos.x * -3,
                }}
                transition={{
                    opacity: { delay: entranceDelays.collageRight + 0.5, duration: 1 },
                    scale: { delay: entranceDelays.collageRight + 0.5, duration: 1 },
                    x: { type: "spring", stiffness: 25, damping: 25 },
                    y: { type: "spring", stiffness: 25, damping: 25 },
                    rotate: { type: "spring", stiffness: 40, damping: 30 },
                }}
            >
                <img src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/be7bd51c-6dd7-4e04-a620-8108ef138948/1768838242918-60798e6e/Justin_and_Hailey_Bieber___.jpg"
                    className="w-72 h-96 object-cover sepia contrast-125" alt="decorative" />
            </motion.div>

            {/* Center Collage Elements - Positioned absolutely to frame the main content */}

            {/* Main Image - Torn Paper Left */}
            <motion.div
                className="absolute top-1/4 left-[10%] hidden lg:block"
                variants={tossInLeft}
                initial="initial"
                animate="animate"
                transition={{ delay: entranceDelays.collageLeft }}
                style={{ '--r': '-3deg' } as React.CSSProperties}
            >
                <motion.div
                    className="relative w-72 h-96 bg-white p-2 torn-paper-1 shadow-2xl transform -rotate-3 z-10 pointer-events-auto"
                    whileHover={{ scale: 1.08, rotate: 0 }}
                    animate={{
                        y: [0, -15, -5, -20, 0],
                        x: [0, 8, -5, 10, 0],
                        rotate: [-3, -1, -4, -2, -3],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                >
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

                </motion.div>

                {/* Decorations - Outside the clipped container to be visible */}
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 100 }}>
                    {/* Handwritten Text */}
                    <motion.div
                        className="absolute -bottom-8 -right-4 font-marker text-xl text-white transform rotate-[-8deg] drop-shadow-lg"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: entranceDelays.collageLeft + 0.5, duration: 0.5 }}
                    >
                        for you ♡
                        <svg className="absolute -bottom-2 left-0 w-full h-3 overflow-visible" viewBox="0 0 100 12" preserveAspectRatio="none">
                            <motion.path
                                d="M0,5 Q 50,15 100,5"
                                fill="transparent"
                                stroke="white"
                                strokeWidth="4"
                                strokeLinecap="round"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ delay: entranceDelays.collageLeft + 0.8, duration: 0.8, ease: "easeInOut" }}
                            />
                        </svg>
                    </motion.div>

                    {/* Sparkle Particles */}
                    <motion.div
                        className="absolute -top-4 -right-6 text-white text-lg"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        ✦
                    </motion.div>
                    <motion.div
                        className="absolute top-1/4 -left-5 text-white/70 text-sm"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                    >
                        ✧
                    </motion.div>
                    <motion.div
                        className="absolute bottom-1/3 -right-8 text-white/60 text-xs"
                        animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.9, 0.5] }}
                        transition={{ duration: 2.5, repeat: Infinity, delay: 0.7 }}
                    >
                        ❋
                    </motion.div>
                </div>
            </motion.div>

            {/* Secondary Fragment - Torn Paper Right */}
            <motion.div
                className="absolute bottom-1/4 right-[10%] hidden lg:block"
                variants={tossInRight}
                initial="initial"
                animate="animate"
                transition={{ delay: entranceDelays.collageRight }}
                style={{ '--r': '5deg' } as React.CSSProperties}
            >
                <motion.div
                    className={`w-56 h-56 overflow-hidden border-4 border-white shadow-xl transform rotate-6 torn-paper-2 group pointer-events-auto transition-colors duration-1000 ${mode === 'focus' ? 'bg-accent-red' : 'bg-accent-green'}`}
                    whileHover={{ scale: 1.08, rotate: 3 }}
                    animate={{
                        y: [0, -20, -8, -18, 0],
                        x: [0, -10, 5, -8, 0],
                        rotate: [6, 8, 5, 7, 6],
                    }}
                    transition={{
                        duration: 18,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 2,
                    }}
                >
                    <img src="/right.jpg"
                        className="w-full h-full object-cover scale-150 object-top mix-blend-multiply opacity-80 grayscale sepia-[.4] contrast-125 brightness-90 group-hover:opacity-100 transition-opacity" alt="fragment" />

                </motion.div>

                {/* Decorations - Outside the clipped container to be visible */}
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 100 }}>
                    {/* Handwritten Text */}
                    <motion.div
                        className="absolute -top-6 -left-2 font-marker text-lg text-white transform rotate-[12deg] drop-shadow-lg"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: entranceDelays.collageRight + 0.5, duration: 0.5 }}
                    >
                        stay ✿
                        <svg className="absolute -bottom-2 left-0 w-full h-3 overflow-visible" viewBox="0 0 100 12" preserveAspectRatio="none">
                            <motion.path
                                d="M0,5 Q 50,15 100,5"
                                fill="transparent"
                                stroke="white"
                                strokeWidth="4"
                                strokeLinecap="round"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ delay: entranceDelays.collageRight + 0.8, duration: 0.8, ease: "easeInOut" }}
                            />
                        </svg>
                    </motion.div>

                    {/* Sparkle Particles */}
                    <motion.div
                        className="absolute -bottom-3 -left-4 text-white text-base"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7], rotate: [0, 15, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                    >
                        ✦
                    </motion.div>
                    <motion.div
                        className="absolute top-1/2 -right-4 text-white/80 text-sm"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.9, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                    >
                        ❀
                    </motion.div>
                    <motion.div
                        className="absolute -top-2 right-1/4 text-white/60 text-xs"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.8, 0.4] }}
                        transition={{ duration: 2.2, repeat: Infinity, delay: 1 }}
                    >
                        ✧
                    </motion.div>
                </div>
            </motion.div>

            {/* Sticker Stars */}
            <motion.div
                className="absolute top-[15%] left-[5%] z-0"
                variants={starPop}
                initial="initial"
                animate="animate"
                transition={{ delay: entranceDelays.decorativeElements }}
            >
                <motion.div
                    animate={{
                        boxShadow: ['0 0 10px rgba(185, 28, 28, 0.3)', '0 0 25px rgba(185, 28, 28, 0.6)', '0 0 10px rgba(185, 28, 28, 0.3)']
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    <Star className="w-12 h-12 text-white fill-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] transform rotate-12" />
                </motion.div>
            </motion.div>

            <motion.div
                className={`absolute bottom-[20%] right-[5%] opacity-60 transition-colors duration-1000 ${mode === 'focus' ? 'text-accent-red fill-accent-red' : 'text-accent-green fill-accent-green'}`}
                variants={starPop}
                initial="initial"
                animate="animate"
                transition={{ delay: entranceDelays.decorativeElements + 0.2 }}
            >
                <Star className="w-8 h-8 transform -rotate-12" />
            </motion.div>

            {/* Random text fragments */}
            <motion.div
                className="absolute bottom-10 left-10 z-0"
                variants={fragmentSlide}
                initial="initial"
                animate="animate"
                transition={{ delay: entranceDelays.decorativeElements + 0.3 }}
            >
                <div className="bg-black text-white px-3 py-1 font-serif-custom italic text-lg transform -rotate-3 border border-white/20 shadow-lg">
                    "in the void"
                </div>
            </motion.div>

            <motion.div
                className="absolute top-32 right-20 z-0"
                initial={{ opacity: 0, x: 30, rotate: 0 }}
                animate={{ opacity: 0.6, x: 0, rotate: 6 }}
                transition={{ delay: entranceDelays.decorativeElements + 0.4, duration: 0.6 }}
            >
                <div className="bg-paper-cream text-black px-2 py-0.5 text-xs font-mono transform rotate-6 border border-black shadow-md">
                    keshi.mode_v2
                </div>
            </motion.div>
        </div>
    );
};

export default Background;

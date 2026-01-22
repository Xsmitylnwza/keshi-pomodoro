import React, { useEffect, useRef, useState } from 'react';

export const CustomCursor: React.FC = () => {
    const cursorRef = useRef<HTMLDivElement>(null);
    const trailerRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        const cursor = cursorRef.current;
        const trailer = trailerRef.current;

        if (!cursor || !trailer) return;

        const onMouseMove = (e: MouseEvent) => {
            const { clientX, clientY } = e;

            // Main cursor follows instantly
            cursor.style.transform = `translate(${clientX}px, ${clientY}px)`;

            // Trailer follows with delay
            trailer.animate({
                left: `${clientX}px`,
                top: `${clientY}px`
            }, { duration: 500, fill: "forwards" });
        };

        const onMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('button') || target.closest('a')) {
                setIsHovering(true);
            } else {
                setIsHovering(false);
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseover', onMouseOver);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseover', onMouseOver);
        };
    }, []);

    return (
        <>
            {/* Main Dot */}
            <div
                ref={cursorRef}
                className="fixed top-0 left-0 w-3 h-3 bg-accent-red rounded-full pointer-events-none z-[9999] mix-blend-difference -translate-x-1/2 -translate-y-1/2"
            />

            {/* Trailer Ring */}
            <div
                ref={trailerRef}
                className={`fixed top-0 left-0 w-8 h-8 border border-white/50 rounded-full pointer-events-none z-[9998] transition-all duration-300 ease-out -translate-x-1/2 -translate-y-1/2
                    ${isHovering ? 'scale-150 bg-white/10 border-accent-red/50' : 'scale-100'}
                `}
            />
        </>
    );
};

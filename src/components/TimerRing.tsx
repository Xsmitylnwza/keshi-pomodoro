import React from 'react';

interface TimerRingProps {
    radius: number;
    stroke: number;
    progress: number;
    color: string;
}

const TimerRing: React.FC<TimerRingProps> = ({ radius, stroke, progress, color }) => {
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center">
            <svg
                height={radius * 2}
                width={radius * 2}
                className="-rotate-90 transform transition-all duration-500 drop-shadow-[0_0_15px_rgba(220,38,38,0.3)]"
            >
                <circle
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={2}
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />
                <circle
                    stroke={color}
                    fill="transparent"
                    strokeWidth={stroke}
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset }}
                    strokeLinecap="round"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    className="transition-all duration-1000 ease-linear"
                />
            </svg>
        </div>
    );
};

export default TimerRing;

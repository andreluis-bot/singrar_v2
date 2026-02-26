import React from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store';

export function CompassIndicator() {
    const deviceHeading = useStore((s) => s.deviceHeading) || 0;

    return (
        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 border border-white/10 shadow-inner">
            <motion.div
                animate={{ rotate: deviceHeading }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="relative w-8 h-8 flex items-center justify-center"
            >
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                    <path d="M50 10 L65 50 L50 90 L35 50 Z" fill="rgba(255,255,255,0.2)" />
                    {/* Seta Vermelha (Norte) */}
                    <path d="M50 10 L65 50 L35 50 Z" fill="#ef4444" />
                    <circle cx="50" cy="50" r="4" fill="white" />
                </svg>
            </motion.div>
            <span className="text-[10px] text-[#8892b0] font-mono mt-1 font-bold tracking-widest">
                {Math.round(deviceHeading)}°
            </span>
        </div>
    );
}

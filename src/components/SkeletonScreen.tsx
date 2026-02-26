/**
 * SkeletonScreen — Loading placeholders estilo mobile nativo
 * 
 * Uso:
 * <SkeletonScreen type="weather" />
 * <SkeletonScreen type="logbook" />
 * <SkeletonScreen type="list" rows={5} />
 */

import React, { memo } from 'react';
import { motion } from 'motion/react';

// Bloco skeleton genérico
const SkeletonBlock = memo(function SkeletonBlock({
  className = '',
  style = {},
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`skeleton rounded-xl ${className}`}
      style={style}
    />
  );
});

// Linha skeleton
const SkeletonLine = memo(function SkeletonLine({
  width = '100%',
  height = 14,
  className = '',
}: {
  width?: string | number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton rounded-md ${className}`}
      style={{ width, height }}
    />
  );
});

/* --- Tipos de skeleton --- */

function SkeletonWeather() {
  return (
    <div className="h-full flex flex-col p-6 gap-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <SkeletonLine width={140} height={32} className="rounded-xl" />
        <SkeletonLine width={80} height={36} className="rounded-xl" />
      </div>

      {/* Tabs */}
      <SkeletonBlock className="h-12 rounded-2xl" />

      {/* Main card */}
      <SkeletonBlock className="h-48 rounded-3xl" />

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        <SkeletonBlock className="h-28 rounded-2xl" />
        <SkeletonBlock className="h-28 rounded-2xl" />
        <SkeletonBlock className="h-28 rounded-2xl" />
        <SkeletonBlock className="h-28 rounded-2xl" />
      </div>

      {/* Chart */}
      <SkeletonBlock className="h-40 rounded-2xl" />
    </div>
  );
}

function SkeletonLogbook() {
  return (
    <div className="h-full flex flex-col p-6 gap-4">
      {/* Header */}
      <SkeletonLine width={180} height={32} className="rounded-xl mb-2" />
      
      {/* Tabs */}
      <SkeletonBlock className="h-12 rounded-2xl" />

      {/* Items */}
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="flex gap-3 items-center"
        >
          <SkeletonBlock className="w-14 h-14 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="70%" height={16} />
            <SkeletonLine width="50%" height={12} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-6 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ background: 'rgba(17, 34, 64, 0.5)' }}
        >
          <SkeletonBlock className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine width={`${60 + Math.random() * 30}%`} height={14} />
            <SkeletonLine width={`${30 + Math.random() * 30}%`} height={11} />
          </div>
          <SkeletonBlock className="w-16 h-8 rounded-lg" />
        </motion.div>
      ))}
    </div>
  );
}

function SkeletonMap() {
  return (
    <div className="h-full flex items-center justify-center" style={{ background: '#0d2137' }}>
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="flex flex-col items-center gap-3"
      >
        <div className="w-12 h-12 rounded-full border-4 border-[#233554] border-t-[#64ffda] animate-spin" />
        <p className="text-[#8892b0] text-sm font-mono">Carregando mapa...</p>
      </motion.div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <SkeletonLine width={160} height={28} className="rounded-xl" />
      
      {/* Cards */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08 }}
        >
          <SkeletonBlock className="h-32 rounded-3xl" />
        </motion.div>
      ))}
    </div>
  );
}

/* --- Componente Principal --- */
export const SkeletonScreen = memo(function SkeletonScreen({
  type = 'list',
  rows,
}: {
  type?: 'weather' | 'logbook' | 'list' | 'map' | 'cards';
  rows?: number;
}) {
  switch (type) {
    case 'weather': return <SkeletonWeather />;
    case 'logbook': return <SkeletonLogbook />;
    case 'map':     return <SkeletonMap />;
    case 'cards':   return <SkeletonCards />;
    default:        return <SkeletonList rows={rows} />;
  }
});

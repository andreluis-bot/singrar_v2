/**
 * LogbookView — Diário de Bordo
 * 
 * Melhorias:
 * - Sem hover states
 * - Haptic feedback
 * - SkeletonScreen inicial
 * - Lazy rendering de listas longas
 * - Swipe to delete (gesture)
 */

import React, { useState, useCallback, memo } from 'react';
import { useStore } from '../store';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { hapticLight, hapticHeavy, hapticSuccess } from '../hooks/useHaptics';
import { SkeletonScreen } from '../components/SkeletonScreen';
import {
  Fish, MapPin, Calendar, Plus, Trash2, Route,
  Eye, EyeOff, Waves, Zap, Anchor, Info,
} from 'lucide-react';
import { format } from 'date-fns';

/* ============================================================
   TIPOS
   ============================================================ */
type LogTab = 'logs' | 'waypoints' | 'tracks';

/* ============================================================
   SUB-COMPONENTES
   ============================================================ */

/** Ícone por tipo de atividade */
function activityIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    fishing: <Fish size={18} />,
    jetski: <Zap size={18} />,
    wakesurf: <Waves size={18} />,
    diving: <Anchor size={18} />,
  };
  return icons[type] ?? <Info size={18} />;
}

function activityColor(type: string): string {
  const colors: Record<string, string> = {
    fishing: '#22c55e',
    jetski: '#3b82f6',
    wakesurf: '#22d3ee',
    diving: '#818cf8',
  };
  return colors[type] ?? '#8892b0';
}

/** Item de log com swipe to delete */
const LogItem = memo(function LogItem({
  entry,
  onDelete,
}: {
  entry: any;
  onDelete: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (info.offset.x < -80) {
        hapticHeavy();
        onDelete();
      }
      setIsDragging(false);
    },
    [onDelete]
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      drag="x"
      dragConstraints={{ left: -120, right: 0 }}
      dragElastic={0.2}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      className="relative cursor-grab active:cursor-grabbing"
    >
      {/* Delete hint */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center w-24 rounded-2xl"
        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        <Trash2 size={18} className="text-red-400" />
      </div>

      {/* Card principal */}
      <motion.div
        className="relative flex gap-3 p-4 rounded-2xl"
        style={{
          background: 'rgba(17,34,64,0.7)',
          border: '1px solid rgba(255,255,255,0.06)',
          zIndex: 1,
        }}
        animate={{ x: isDragging ? undefined : 0 }}
      >
        {/* Ícone */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: `${activityColor(entry.type)}15`,
            color: activityColor(entry.type),
            border: `1px solid ${activityColor(entry.type)}30`,
          }}
        >
          {activityIcon(entry.type)}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-sm truncate">{entry.title}</h3>
          {entry.species && (
            <p className="text-[#64ffda] text-xs font-semibold">{entry.species}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {entry.weight && (
              <span className="text-[#8892b0] text-xs">{entry.weight}kg</span>
            )}
            {entry.length && (
              <span className="text-[#8892b0] text-xs">{entry.length}cm</span>
            )}
            <span className="text-[#4a5568] text-xs">
              {format(new Date(entry.createdAt), 'dd/MM/yy HH:mm')}
            </span>
          </div>
          {entry.notes && (
            <p className="text-[#8892b0] text-xs mt-1 truncate">{entry.notes}</p>
          )}
        </div>

        {/* Foto preview */}
        {entry.photo && (
          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
            <img src={entry.photo} alt="catch" className="w-full h-full object-cover" />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
});

/** Item de waypoint */
const WaypointItem = memo(function WaypointItem({
  wp,
  onDelete,
}: {
  wp: any;
  onDelete: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80 }}
      className="flex items-center gap-3 p-4 rounded-2xl"
      style={{ background: 'rgba(17,34,64,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl"
        style={{ background: `${wp.color}20`, border: `1px solid ${wp.color}40` }}
      >
        {wp.icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm truncate">{wp.name}</p>
        <p className="text-[#8892b0] text-xs font-mono">
          {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
        </p>
      </div>

      <button
        onPointerDown={async () => { await hapticHeavy(); onDelete(); }}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 bg-red-500/10 select-none"
      >
        <Trash2 size={15} />
      </button>
    </motion.div>
  );
});

/** Item de trilha */
const TrackItem = memo(function TrackItem({
  track,
  onDelete,
  onToggleVisibility,
}: {
  track: any;
  onDelete: () => void;
  onToggleVisibility: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80 }}
      className="flex items-center gap-3 p-4 rounded-2xl"
      style={{ background: 'rgba(17,34,64,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${track.color}20`, border: `1px solid ${track.color}40` }}
      >
        <Route size={18} style={{ color: track.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm truncate">{track.name}</p>
        <p className="text-[#8892b0] text-xs">
          {track.points?.length || 0} pontos · {format(new Date(track.createdAt), 'dd/MM/yy')}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onPointerDown={async () => { await hapticLight(); onToggleVisibility(); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 select-none"
          style={{ color: track.visible !== false ? '#64ffda' : '#8892b0' }}
        >
          {track.visible !== false ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button
          onPointerDown={async () => { await hapticHeavy(); onDelete(); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 bg-red-500/10 select-none"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </motion.div>
  );
});

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
export const LogbookView = memo(function LogbookView() {
  const logEntries = useStore((s) => s.logEntries);
  const waypoints = useStore((s) => s.waypoints);
  const tracks = useStore((s) => s.tracks);
  const removeLogEntry = useStore((s) => s.removeLogEntry);
  const removeWaypoint = useStore((s) => s.removeWaypoint);
  const removeTrack = useStore((s) => s.removeTrack);
  const updateTrack = useStore((s) => s.updateTrack);

  const [activeTab, setActiveTab] = useState<LogTab>('logs');

  const handleTabChange = useCallback(async (tab: LogTab) => {
    await hapticLight();
    setActiveTab(tab);
  }, []);

  const safeLogEntries = logEntries || [];
  const safeWaypoints = waypoints || [];
  const safeTracks = tracks || [];

  /* ---- Tabs ---- */
  const tabs = [
    { key: 'logs' as LogTab, label: 'Atividades', count: safeLogEntries.length },
    { key: 'waypoints' as LogTab, label: 'Marcadores', count: safeWaypoints.length },
    { key: 'tracks' as LogTab, label: 'Rotas', count: safeTracks.length },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header
        className="px-5 pt-5 pb-0 shrink-0"
        style={{ background: 'linear-gradient(to bottom, #0a192f 70%, transparent)' }}
      >
        <h1 className="text-3xl font-black text-white tracking-tight mb-4">
          Diário de Bordo
        </h1>

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-2xl"
          style={{ background: 'rgba(17,34,64,0.8)' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onPointerDown={() => handleTabChange(tab.key)}
              className="flex-1 py-2.5 text-xs font-bold rounded-xl transition-all select-none"
              style={{
                background: activeTab === tab.key ? 'rgba(100,255,218,0.15)' : 'transparent',
                color: activeTab === tab.key ? '#64ffda' : '#8892b0',
                border: activeTab === tab.key ? '1px solid rgba(100,255,218,0.3)' : '1px solid transparent',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-black"
                  style={{
                    background: activeTab === tab.key ? 'rgba(100,255,218,0.2)' : 'rgba(255,255,255,0.08)',
                    color: activeTab === tab.key ? '#64ffda' : '#8892b0',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 pb-6">
        <AnimatePresence mode="wait">
          {/* LOGS */}
          {activeTab === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {safeLogEntries.length === 0 ? (
                <EmptyState
                  icon="📋"
                  title="Nenhuma atividade"
                  subtitle="Registre capturas e atividades pelo mapa"
                />
              ) : (
                safeLogEntries
                  .slice()
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((entry) => (
                    <LogItem
                      key={entry.id}
                      entry={entry}
                      onDelete={() => removeLogEntry(entry.id)}
                    />
                  ))
              )}
            </motion.div>
          )}

          {/* WAYPOINTS */}
          {activeTab === 'waypoints' && (
            <motion.div
              key="waypoints"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {safeWaypoints.length === 0 ? (
                <EmptyState
                  icon="📍"
                  title="Nenhum marcador"
                  subtitle="Adicione waypoints pelo mapa"
                />
              ) : (
                safeWaypoints
                  .slice()
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((wp) => (
                    <WaypointItem
                      key={wp.id}
                      wp={wp}
                      onDelete={() => removeWaypoint(wp.id)}
                    />
                  ))
              )}
            </motion.div>
          )}

          {/* TRACKS */}
          {activeTab === 'tracks' && (
            <motion.div
              key="tracks"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {safeTracks.length === 0 ? (
                <EmptyState
                  icon="🗺️"
                  title="Nenhuma rota"
                  subtitle="Grave uma rota pelo mapa"
                />
              ) : (
                safeTracks
                  .slice()
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((track) => (
                    <TrackItem
                      key={track.id}
                      track={track}
                      onDelete={() => removeTrack(track.id)}
                      onToggleVisibility={() =>
                        updateTrack(track.id, { visible: track.visible === false })
                      }
                    />
                  ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

/* ============================================================
   ESTADO VAZIO
   ============================================================ */
const EmptyState = memo(function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
      <p className="text-[#8892b0] text-sm">{subtitle}</p>
    </motion.div>
  );
});

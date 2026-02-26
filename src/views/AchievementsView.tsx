import React from "react";
import { useStore } from "../store";
import { Trophy, Star, Lock, CheckCircle2, Info } from "lucide-react";
import { format } from "date-fns";
import { motion } from "motion/react";

export function AchievementsView() {
  const achievements = useStore((state) => state.achievements);
  const tracks = useStore((state) => state.tracks);
  const waypoints = useStore((state) => state.waypoints);
  const logEntries = useStore((state) => state.logEntries);
  const events = useStore((state) => state.events);
  const user = useStore((state) => state.user);
  const userEmail = user?.email || "offline_user@example.com";

  const stats = {
    tracks_count: (tracks || []).length,
    waypoints_count: (waypoints || []).length,
    catches_count: (logEntries || []).filter(l => l.type === 'fishing').length,
    events_joined: (events || []).filter(e => e.attendees.includes(userEmail)).length,
    distance_total: 0,
  };

  const unlockedCount = (achievements || []).filter(a => a.unlockedAt).length;
  const totalCount = (achievements || []).length;

  return (
    <div className="h-full flex flex-col pb-4">
      <header className="p-6 shrink-0 bg-gradient-to-b from-[#0a192f] to-transparent">
        <h1 className="text-3xl font-bold font-sans tracking-tight text-white mb-6">
          Conquistas
        </h1>

        <div className="bg-gradient-to-br from-[#112240] to-[#0a192f] p-8 rounded-3xl border border-white/5 relative overflow-hidden shadow-xl">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#64ffda]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex justify-between items-end mb-4">
              <div>
                <div className="text-[#64ffda] text-5xl font-bold tracking-tighter">{unlockedCount} <span className="text-2xl text-[#8892b0] font-light">/ {totalCount}</span></div>
                <div className="text-[#8892b0] text-xs uppercase tracking-widest font-bold mt-2">Insignias Coletadas</div>
              </div>
              <Trophy className="text-[#64ffda] opacity-30 drop-shadow-[0_0_15px_rgba(100,255,218,0.5)]" size={56} />
            </div>
            <div className="w-full bg-[#0a192f] h-3 rounded-full overflow-hidden border border-white/5 shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(unlockedCount / totalCount) * 100}%` }}
                className="bg-gradient-to-r from-[#64ffda]/50 to-[#64ffda] h-full shadow-[0_0_10px_rgba(100,255,218,0.5)]"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-6 custom-scrollbar">
        <div className="grid grid-cols-1 gap-4">
          {(achievements || []).map((ach) => {
            const isUnlocked = !!ach.unlockedAt;
            const progress = Math.min(100, (stats[ach.condition.type] / ach.condition.value) * 100);

            return (
              <div
                key={ach.id}
                className={`p-5 rounded-3xl border transition-all duration-300 group ${isUnlocked
                    ? "bg-gradient-to-br from-[#112240] to-[#0a192f] border-[#64ffda]/30 shadow-[0_0_30px_rgba(100,255,218,0.05)] [#64ffda]/50"
                    : "bg-white/5 border-white/5 opacity-80 "
                  }`}
              >
                <div className="flex gap-5">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-inner shrink-0 transition-transform group- ${isUnlocked ? "bg-[#64ffda]/10 border border-[#64ffda]/20" : "bg-[#0a192f] border border-white/5"
                    }`}>
                    {isUnlocked ? ach.icon : <Lock size={28} className="text-[#8892b0]" />}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className={`font-bold text-lg truncate ${isUnlocked ? "text-white" : "text-[#8892b0]"}`}>
                        {ach.title}
                      </h3>
                      {isUnlocked && <CheckCircle2 size={20} className="text-[#64ffda] shrink-0 drop-shadow-[0_0_5px_rgba(100,255,218,0.5)]" />}
                    </div>
                    <p className="text-sm text-[#8892b0] line-clamp-2 leading-relaxed">{ach.description}</p>

                    {!isUnlocked && (
                      <div className="mt-4">
                        <div className="flex justify-between text-[11px] text-[#8892b0] mb-2 font-mono uppercase tracking-wider font-bold">
                          <span>Progresso</span>
                          <span className="text-white">{stats[ach.condition.type]} / {ach.condition.value}</span>
                        </div>
                        <div className="w-full bg-[#0a192f] h-1.5 rounded-full overflow-hidden border border-white/5">
                          <div
                            className="bg-gradient-to-r from-[#233554] to-[#8892b0] h-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {isUnlocked && (
                      <div className="mt-3 text-[11px] text-[#64ffda]/80 font-mono uppercase tracking-wider font-bold bg-[#64ffda]/10 w-fit px-3 py-1 rounded-lg border border-[#64ffda]/20">
                        Desbloqueado em {format(ach.unlockedAt!, "dd/MM/yyyy")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-gradient-to-br from-[#112240] to-[#0a192f] p-5 rounded-3xl border border-white/5 text-xs text-[#8892b0] flex items-start gap-4 italic shadow-xl">
          <div className="bg-white/5 p-2 rounded-xl shrink-0">
            <Info size={18} className="text-[#8892b0]" />
          </div>
          <p className="leading-relaxed">Continue navegando, marcando pontos e registrando suas aventuras para desbloquear novas insignias e subir no ranking da comunidade Singrar.</p>
        </div>
      </div>
    </div>
  );
}

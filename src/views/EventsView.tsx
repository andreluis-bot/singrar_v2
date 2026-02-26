import React, { useState } from "react";
import { useStore } from "../store";
import { Users, Calendar, MapPin, Plus, Trash2, UserPlus, UserMinus, Info, Navigation } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";

export function EventsView() {
  const events = useStore((state) => state.events);
  const addEvent = useStore((state) => state.addEvent);
  const removeEvent = useStore((state) => state.removeEvent);
  const joinEvent = useStore((state) => state.joinEvent);
  const leaveEvent = useStore((state) => state.leaveEvent);
  const location = useStore((state) => state.location);
  const user = useStore((state) => state.user);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"jetski" | "boat" | "fishing" | "social">("social");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  const userEmail = user?.email || "offline_user@example.com";

  const handleAddEvent = () => {
    if (!newTitle || !location) {
      alert("Por favor, preencha o título e certifique-se de que a localização está ativa.");
      return;
    }

    addEvent({
      title: newTitle,
      description: newDesc,
      lat: location.lat,
      lng: location.lng,
      date: new Date(newDate).getTime(),
      type: newType,
      organizer: userEmail,
      attendees: [userEmail]
    });

    setShowAddModal(false);
    setNewTitle("");
    setNewDesc("");
    setNewType("social");
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "jetski": return "⚡";
      case "boat": return "⛵";
      case "fishing": return "🎣";
      default: return "🤝";
    }
  };

  return (
    <div className="h-full flex flex-col pb-4">
      <header className="p-6 shrink-0 bg-gradient-to-b from-[#0a192f] to-transparent">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold font-sans tracking-tight text-white">
            Eventos
          </h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-[#64ffda] to-emerald-400 text-[#0a192f] p-3 rounded-2xl shadow-lg [#64ffda]/20 transition-all "
          >
            <Plus size={24} strokeWidth={3} />
          </button>
        </div>

        <div className="bg-gradient-to-br from-[#112240] to-[#0a192f] p-5 rounded-3xl border border-white/5 text-sm text-[#8892b0] flex items-start gap-4 shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#64ffda]/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="bg-[#64ffda]/10 p-2 rounded-xl shrink-0">
            <Info size={20} className="text-[#64ffda]" />
          </div>
          <p className="leading-relaxed relative z-10">Encontre encontros de jetski, barcos e pescarias perto de você. Crie o seu próprio evento para reunir a comunidade!</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-6 custom-scrollbar">
        {(events || []).length === 0 ? (
          <div className="text-center py-12 text-[#8892b0]">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum evento programado.</p>
            <p className="text-xs mt-1">Seja o primeiro a criar um encontro!</p>
          </div>
        ) : (
          (events || []).sort((a, b) => a.date - b.date).map((event) => (
            <div key={event.id} className="bg-gradient-to-br from-[#112240] to-[#0a192f] rounded-3xl border border-white/5 overflow-hidden shadow-xl group /10 transition-all">
              <div className="p-5 border-b border-white/5 flex justify-between items-start relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="flex gap-4 relative z-10">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-white/5 group- transition-transform">
                    {getEventIcon(event.type)}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xl leading-tight mb-1">{event.title}</h3>
                    <div className="flex items-center gap-2 text-xs font-bold text-[#8892b0] uppercase tracking-wider bg-white/5 w-fit px-3 py-1 rounded-lg border border-white/5">
                      <Calendar size={14} className="text-[#64ffda]" />
                      {format(event.date, "dd/MM/yyyy HH:mm")}
                    </div>
                  </div>
                </div>
                {event.organizer === userEmail && (
                  <button
                    onClick={() => removeEvent(event.id)}
                    className="text-[#8892b0]  p-2 bg-white/5 rounded-xl /10 transition-colors relative z-10"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <div className="p-5">
                <p className="text-sm text-[#ccd6f6] mb-6 leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/5">{event.description}</p>

                <div className="flex items-center justify-between">
                  <div className="flex -space-x-3 overflow-hidden">
                    {event.attendees.slice(0, 5).map((_, i) => (
                      <div key={i} className="inline-flex h-10 w-10 rounded-full ring-4 ring-[#0a192f] bg-gradient-to-br from-[#233554] to-[#112240] items-center justify-center text-xs text-white font-bold shadow-lg">
                        U{i + 1}
                      </div>
                    ))}
                    {event.attendees.length > 5 && (
                      <div className="inline-flex h-10 w-10 rounded-full ring-4 ring-[#0a192f] bg-gradient-to-br from-[#112240] to-[#0a192f] items-center justify-center text-xs text-[#64ffda] font-bold shadow-lg border border-[#64ffda]/30">
                        +{event.attendees.length - 5}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {event.attendees.includes(userEmail) ? (
                      <button
                        onClick={() => leaveEvent(event.id, userEmail)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-400 rounded-xl text-sm font-bold /20 border border-red-500/20 transition-all "
                      >
                        <UserMinus size={16} /> Sair
                      </button>
                    ) : (
                      <button
                        onClick={() => joinEvent(event.id, userEmail)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#64ffda]/10 text-[#64ffda] rounded-xl text-sm font-bold [#64ffda]/20 border border-[#64ffda]/20 transition-all "
                      >
                        <UserPlus size={16} /> Participar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] flex items-center justify-center p-4 bg-[#0a192f]/80 backdrop-blur-sm pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-gradient-to-b from-[#112240] to-[#0a192f] w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
                  <Calendar size={24} />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Criar Encontro</h2>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-widest mb-2">Título do Evento</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Role de Jetski - Represa"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all placeholder:text-white/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-widest mb-3">Tipo</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["social", "jetski", "boat", "fishing"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setNewType(t)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all  active:scale-95 ${newType === t
                            ? "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                            : "bg-white/5 text-[#8892b0] border-white/5 /10 "
                          }`}
                      >
                        <span className="text-2xl drop-shadow-md">{getEventIcon(t)}</span>
                        <span className="uppercase tracking-wider text-[9px] font-bold">{t}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-widest mb-2">Data e Hora</label>
                  <input
                    type="datetime-local"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-widest mb-2">Descrição</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Detalhes do ponto de encontro, rádio, etc..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all resize-none placeholder:text-white/20 custom-scrollbar"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3.5 rounded-xl bg-white/5 text-white font-bold /10 transition-all border border-white/10 [1.02] active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddEvent}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black   transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] [0_0_30px_rgba(16,185,129,0.6)] [1.02] active:scale-[0.98] uppercase tracking-wider text-sm"
                >
                  Criar Evento
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

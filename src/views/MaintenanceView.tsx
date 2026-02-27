import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import {
    Settings2, Wrench, Clock, Plus, Trash2, Camera,
    AlertCircle, CheckCircle2, DollarSign, User as UserIcon,
    ChevronRight, ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { hapticMedium, hapticSuccess, hapticError, hapticLight } from '../hooks/useHaptics';

export function MaintenanceView() {
    const maintenanceRecords = useStore((s) => s.maintenanceRecords);
    const addMaintenanceRecord = useStore((s) => s.addMaintenanceRecord);
    const removeMaintenanceRecord = useStore((s) => s.removeMaintenanceRecord);
    const engineHours = useStore((s) => s.engineHours);
    const updateEngineHours = useStore((s) => s.updateEngineHours);

    const [showAddForm, setShowAddForm] = useState(false);
    const [showHoursModal, setShowHoursModal] = useState(false);
    const [newHours, setNewHours] = useState(engineHours.current.toString());

    const [formData, setFormData] = useState({
        type: 'oil_change' as const,
        title: '',
        description: '',
        engine_hours: engineHours.current,
        cost: 0,
        mechanic: '',
        next_due_hours: 0,
        next_due_date: undefined as number | undefined
    });

    const stats = useMemo(() => {
        const totalCost = (maintenanceRecords || []).reduce((acc, curr) => acc + (curr.cost || 0), 0);
        const lastService = (maintenanceRecords || []).sort((a, b) => b.createdAt - a.createdAt)[0];
        return { totalCost, lastService };
    }, [maintenanceRecords]);

    const handleSaveRecord = async () => {
        if (!formData.title) return;
        await addMaintenanceRecord(formData);
        setShowAddForm(false);
        setFormData({
            type: 'oil_change',
            title: '',
            description: '',
            engine_hours: engineHours.current,
            cost: 0,
            mechanic: '',
            next_due_hours: 0,
            next_due_date: undefined
        });
        await hapticSuccess();
    };

    const handleUpdateHours = async () => {
        const hours = parseFloat(newHours);
        if (!isNaN(hours)) {
            updateEngineHours(hours);
            setShowHoursModal(false);
            await hapticSuccess();
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0a192f] overflow-hidden">
            {!showAddForm ? (
                <>
                    <header className="p-6 shrink-0">
                        <h1 className="text-3xl font-bold text-white tracking-tight">Manutenção</h1>
                        <p className="text-[#8892b0] text-sm mt-1">Controle de revisões e motor</p>
                    </header>

                    <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-6 custom-scrollbar">
                        {/* Horímetro Card */}
                        <div
                            onPointerDown={() => setShowHoursModal(true)}
                            className="bg-gradient-to-br from-[#112240] to-[#0a192f] p-6 rounded-3xl border border-[#64ffda]/20 shadow-xl relative overflow-hidden group active:scale-95 transition-transform"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Clock size={80} />
                            </div>
                            <div className="relative z-10">
                                <p className="text-[#64ffda] text-[10px] font-black uppercase tracking-[0.2em]">Horímetro Atual</p>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <h2 className="text-5xl font-black text-white font-mono">{engineHours.current.toFixed(1)}</h2>
                                    <span className="text-[#8892b0] font-bold text-sm">horas</span>
                                </div>
                                <p className="text-[#8892b0] text-[10px] mt-4 flex items-center gap-1.5 uppercase font-bold tracking-widest">
                                    <Clock size={12} /> Última atualização em {format(engineHours.lastUpdated, 'dd/MM/yyyy')}
                                </p>
                            </div>
                        </div>

                        {/* Resumo Financeiro */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#112240] p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-[#8892b0] uppercase font-black tracking-widest mb-1">Investimento Total</p>
                                <p className="text-white font-bold text-lg">R$ {stats.totalCost.toLocaleString('pt-BR')}</p>
                            </div>
                            <div className="bg-[#112240] p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-[#8892b0] uppercase font-black tracking-widest mb-1">Último Serviço</p>
                                <p className="text-white font-bold text-lg">
                                    {stats.lastService ? format(stats.lastService.createdAt, 'dd/MM') : '--/--'}
                                </p>
                            </div>
                        </div>

                        {/* Lista de Registros */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-white font-bold tracking-tight">Histórico de Serviços</h3>
                                <span className="text-[10px] text-[#8892b0] font-black px-2 py-0.5 rounded-full bg-white/5 border border-white/5 uppercase">
                                    {(maintenanceRecords || []).length} Itens
                                </span>
                            </div>

                            {(maintenanceRecords || []).length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center text-center opacity-30">
                                    <Settings2 size={48} className="mb-4" />
                                    <p className="text-sm font-bold">Nenhum registro encontrado</p>
                                    <p className="text-[10px] mt-1">Toque em (+) para adicionar</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {maintenanceRecords.sort((a, b) => b.createdAt - a.createdAt).map((record) => (
                                        <div
                                            key={record.id}
                                            className="bg-[#112240]/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between group active:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#64ffda]">
                                                    <Wrench size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="text-white font-bold text-sm leading-tight">{record.title}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] text-[#8892b0]">{format(record.createdAt, 'dd/MM/yyyy')}</span>
                                                        <span className="w-1 h-1 bg-white/20 rounded-full" />
                                                        <span className="text-[10px] text-[#64ffda] font-mono">{record.engine_hours}h</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onPointerDown={async () => {
                                                    if (window.confirm('Excluir este registro?')) {
                                                        await removeMaintenanceRecord(record.id);
                                                        await hapticMedium();
                                                    }
                                                }}
                                                className="p-2 text-red-500/30 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Botão Flutuante Add */}
                    <button
                        onPointerDown={() => { setShowAddForm(true); hapticLight(); }}
                        className="fixed bottom-24 right-6 w-14 h-14 rounded-2xl bg-[#64ffda] text-[#0a192f] flex items-center justify-center shadow-[0_8px_24px_rgba(100,255,218,0.4)] active:scale-90 transition-transform z-50"
                    >
                        <Plus size={28} />
                    </button>
                </>
            ) : (
                /* Formulário de Adição */
                <div className="flex-1 flex flex-col bg-[#0a192f] overflow-hidden pt-safe">
                    <header className="px-6 py-4 flex items-center gap-4">
                        <button onPointerDown={() => setShowAddForm(false)} className="p-2 text-[#8892b0]"><ArrowLeft size={24} /></button>
                        <h2 className="text-xl font-bold text-white">Novo Registro</h2>
                    </header>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar pb-32">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-[#8892b0] font-black uppercase tracking-widest mb-1.5 block">Categoria</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['oil_change', 'filter', 'hull', 'engine', 'electrical', 'other'] as const).map((t) => (
                                        <button
                                            key={t}
                                            onPointerDown={() => setFormData({ ...formData, type: t })}
                                            className={`py-2 px-1 rounded-xl text-[9px] font-bold uppercase transition-all border ${formData.type === t ? 'bg-[#64ffda] text-[#0a192f] border-[#64ffda]' : 'bg-white/5 text-[#8892b0] border-white/5'
                                                }`}
                                        >
                                            {t.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] text-[#8892b0] font-black uppercase tracking-widest mb-1.5 block">Título do Serviço</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-[#112240] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#64ffda]/50"
                                    placeholder="Ex: Troca de óleo da rabeta"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-[#8892b0] font-black uppercase tracking-widest mb-1.5 block">Horas Motor</label>
                                    <input
                                        type="number"
                                        value={formData.engine_hours}
                                        onChange={(e) => setFormData({ ...formData, engine_hours: parseFloat(e.target.value) })}
                                        className="w-full bg-[#112240] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#64ffda]/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-[#8892b0] font-black uppercase tracking-widest mb-1.5 block">Custo (R$)</label>
                                    <input
                                        type="number"
                                        value={formData.cost}
                                        onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                                        className="w-full bg-[#112240] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#64ffda]/50"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] text-[#8892b0] font-black uppercase tracking-widest mb-1.5 block">Mecânico / Oficina</label>
                                <input
                                    type="text"
                                    value={formData.mechanic}
                                    onChange={(e) => setFormData({ ...formData, mechanic: e.target.value })}
                                    className="w-full bg-[#112240] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#64ffda]/50"
                                    placeholder="Nome do profissional"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[#8892b0] font-black uppercase tracking-widest mb-1.5 block">Observações</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-[#112240] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#64ffda]/50"
                                    placeholder="Detalhes técnicos..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-[#0a192f] border-t border-white/5 absolute bottom-0 left-0 right-0">
                        <button
                            onPointerDown={handleSaveRecord}
                            className="w-full py-4 rounded-2xl bg-[#64ffda] text-[#0a192f] font-black text-base shadow-xl active:scale-95 transition-transform"
                        >
                            SALVAR REGISTRO
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Horímetro */}
            <AnimatePresence>
                {showHoursModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm"
                            onPointerDown={() => setShowHoursModal(false)}
                        />
                        <motion.div
                            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                            className="fixed bottom-0 left-0 right-0 z-[1001] bg-[#112240] p-8 rounded-t-[40px] border-t border-white/10"
                        >
                            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-8" />
                            <h3 className="text-xl font-bold text-white text-center mb-1">Atualizar Horímetro</h3>
                            <p className="text-[#8892b0] text-[10px] text-center uppercase tracking-widest mb-8">Insira o valor lido no motor</p>

                            <div className="flex justify-center mb-8">
                                <input
                                    type="number"
                                    autoFocus
                                    value={newHours}
                                    onChange={(e) => setNewHours(e.target.value)}
                                    className="bg-transparent text-6xl font-black text-white text-center w-full focus:outline-none font-mono"
                                    placeholder="0.0"
                                />
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onPointerDown={() => setShowHoursModal(false)}
                                    className="flex-1 py-4 rounded-2xl bg-white/5 text-white font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onPointerDown={handleUpdateHours}
                                    className="flex-1 py-4 rounded-2xl bg-[#64ffda] text-[#0a192f] font-black"
                                >
                                    Salvar
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

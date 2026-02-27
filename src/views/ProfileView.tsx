import React, { useState } from 'react';
import { useStore } from '../store';
import { motion } from 'motion/react';
import { User, Anchor, Activity, Camera, Save, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function ProfileView() {
    const profile = useStore((s) => s.profile);
    const setProfile = useStore((s) => s.setProfile);
    const user = useStore((s) => s.user);
    const isOfflineMode = useStore((s) => s.isOfflineMode);
    const syncData = useStore((s) => s.syncData);

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        nickname: profile?.nickname || user?.email?.split('@')[0] || 'Convidado',
        vessel_name: profile?.vessel_name || '',
        vessel_type: profile?.vessel_type || 'Lancha',
        engine: profile?.engine || '',
        registration: profile?.registration || '',
        home_port: profile?.home_port || '',
        is_public: profile?.is_public ?? true,
    });

    const handleSave = async () => {
        setProfile(formData);
        if (!isOfflineMode && user) {
            // Aqui integraria com supabase na tabela profiles (se houver)
            // await supabase.from('profiles').upsert({ id: user.id, ...formData });
            await syncData();
        }
        setIsEditing(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        useStore.getState().setUser(null);
        useStore.getState().setOfflineMode(false);
    };

    return (
        <div className="h-full flex flex-col pb-4 overflow-y-auto custom-scrollbar">
            <header className="p-6 shrink-0 bg-gradient-to-b from-[#0a192f] to-transparent">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold font-sans tracking-tight text-white">Meu Perfil</h1>
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="text-[#64ffda] bg-[#64ffda]/10 px-4 py-2 rounded-xl text-sm font-bold border border-[#64ffda]/20"
                    >
                        {isEditing ? 'Cancelar' : 'Editar'}
                    </button>
                </div>
            </header>

            <div className="px-6 space-y-6">
                {/* Card Principal */}
                <div className="bg-gradient-to-br from-[#112240] to-[#0a192f] p-6 rounded-3xl border border-white/5 relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#64ffda]/10 rounded-full blur-3xl" />

                    <div className="flex flex-col items-center gap-4 relative z-10">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-[#0a192f] border-4 border-[#112240] flex items-center justify-center overflow-hidden shadow-xl">
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={40} className="text-[#8892b0]" />
                                )}
                            </div>
                            {isEditing && (
                                <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#64ffda] text-[#0a192f] flex items-center justify-center shadow-lg cursor-not-allowed opacity-50">
                                    <Camera size={14} />
                                </button>
                            )}
                        </div>

                        <div className="text-center">
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={formData.nickname}
                                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-center text-white focus:outline-none focus:border-[#64ffda] mb-2"
                                    placeholder="Seu Apelido"
                                />
                            ) : (
                                <h2 className="text-2xl font-bold text-white tracking-tight">{formData.nickname}</h2>
                            )}
                            <p className="text-sm text-[#8892b0]">{isOfflineMode ? 'Modo Offline' : user?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Dados da Embarcação */}
                <div className="bg-gradient-to-br from-[#112240] to-[#0a192f] p-6 rounded-3xl border border-white/5 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                        <Anchor size={20} className="text-[#64ffda]" />
                        <h3 className="text-white font-bold text-lg tracking-tight">Dados da Embarcação</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-widest mb-1.5">Nome</label>
                            <input
                                type="text"
                                value={formData.vessel_name}
                                onChange={(e) => setFormData({ ...formData, vessel_name: e.target.value })}
                                disabled={!isEditing}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-[#64ffda]"
                                placeholder="Ex: Vida Mansa I"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-widest mb-1.5">Tipo</label>
                                <select
                                    value={formData.vessel_type}
                                    onChange={(e) => setFormData({ ...formData, vessel_type: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full bg-[#112240] border border-white/10 rounded-xl px-4 py-3 text-sm text-white disabled:opacity-50 focus:outline-none focus:border-[#64ffda] appearance-none"
                                >
                                    <option value="Lancha">Lancha</option>
                                    <option value="Veleiro">Veleiro</option>
                                    <option value="Jetski">Jetski</option>
                                    <option value="Bote">Bote</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-widest mb-1.5">Motorização</label>
                                <input
                                    type="text"
                                    value={formData.engine}
                                    onChange={(e) => setFormData({ ...formData, engine: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white disabled:opacity-50 focus:outline-none focus:border-[#64ffda]"
                                    placeholder="Ex: 2x 300hp"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-widest mb-1.5">Inscrição (TIE)</label>
                                <input
                                    type="text"
                                    value={formData.registration}
                                    onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white disabled:opacity-50 focus:outline-none focus:border-[#64ffda]"
                                    placeholder="000...00"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-widest mb-1.5">Marina/Porto</label>
                                <input
                                    type="text"
                                    value={formData.home_port}
                                    onChange={(e) => setFormData({ ...formData, home_port: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white disabled:opacity-50 focus:outline-none focus:border-[#64ffda]"
                                    placeholder="Nome da Marina"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Visibilidade Pública */}
                <div className="bg-gradient-to-br from-[#112240] to-[#0a192f] p-4 rounded-3xl border border-white/5 flex items-center justify-between shadow-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#64ffda]/10 rounded-xl flex items-center justify-center text-[#64ffda]">
                            <Activity size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Perfil Público para Radar</p>
                            <p className="text-[10px] text-[#8892b0]">Outros verão suas infos no mapa</p>
                        </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.is_public}
                            onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                            disabled={!isEditing}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#64ffda] peer-disabled:opacity-50"></div>
                    </label>
                </div>

                {/* Botão de Salvar ou Logout */}
                {isEditing ? (
                    <button
                        onClick={handleSave}
                        className="w-full py-4 bg-gradient-to-r from-[#64ffda] to-teal-400 text-[#0a192f] font-bold rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(100,255,218,0.3)]"
                    >
                        <Save size={18} /> Salvar Alterações
                    </button>
                ) : (
                    <button
                        onClick={handleLogout}
                        className="w-full py-4 bg-red-500/10 text-red-400 border border-red-500/20 font-bold rounded-2xl flex items-center justify-center gap-2"
                    >
                        <LogOut size={18} /> Sair do App
                    </button>
                )}
            </div>
        </div>
    );
}

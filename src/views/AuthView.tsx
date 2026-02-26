import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store';
import { Mail, Lock, AlertCircle, Navigation, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { hapticLight } from '../hooks/useHaptics';

export function AuthView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const setOfflineMode = useStore((state) => state.setOfflineMode);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        alert('Cadastro realizado! Verifique seu e-mail para confirmar a conta.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || 'Ocorreu um erro durante a autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0a192f] flex flex-col items-center justify-center p-6 z-[1000] overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#00e5ff]/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#ff6b00]/20 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-gradient-to-br from-[#112240]/90 to-[#0a192f]/90 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(0,229,255,0.3)] overflow-hidden bg-[#0a192f] border border-white/10">
            <img
              src="/logo.png"
              alt="Singrar Logo"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<span class="text-3xl text-[#00e5ff] font-bold">S</span>';
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Singrar</h1>
          <p className="text-[10px] text-[#00e5ff] uppercase tracking-widest font-bold">Marine OS</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start gap-3">
            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="text-[#8892b0]" size={18} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0a192f] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-[#8892b0] focus:outline-none focus:border-[#00e5ff] transition-colors"
                placeholder="Seu e-mail"
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="text-[#8892b0]" size={18} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a192f] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-[#8892b0] focus:outline-none focus:border-[#00e5ff] transition-colors"
                placeholder="Sua senha"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-[#00e5ff] to-[#ff6b00] text-[#0a192f] font-bold rounded-xl shadow-[0_0_20px_rgba(0,229,255,0.3)] [1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isSignUp ? 'Criar Conta' : 'Entrar')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-[#8892b0]  transition-colors"
          >
            {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Cadastre-se'}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10">
          <button
            type="button"
            onPointerDown={async () => {
              await hapticLight();
              setOfflineMode(true);
            }}
            className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Navigation size={18} className="text-[#8892b0]" />
            Acessar sem Login
          </button>
          <p className="text-center text-[10px] text-[#8892b0] mt-3 uppercase tracking-wider">
            Seus dados serão salvos apenas neste dispositivo
          </p>
        </div>
      </motion.div>
    </div>
  );
}

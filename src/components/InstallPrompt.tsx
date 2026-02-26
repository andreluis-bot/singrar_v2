import React, { useState, useEffect } from 'react';
import { X, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Verifica se já está instalado (PWA)
    const isStandAlone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isStandAlone);

    if (isStandAlone) return;

    // Detecta iOS (iPhone/iPad)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      // Exibe o prompt no iOS após 3 segundos para não assustar o usuário logo de cara
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android / Chrome
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  if (isStandalone || !showPrompt) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-24 left-4 right-4 z-[200] bg-gradient-to-br from-[#112240] to-[#0a192f] p-5 rounded-3xl border border-[#00e5ff]/30 shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
      >
        <button onClick={() => setShowPrompt(false)} className="absolute top-3 right-3 text-[#8892b0]  bg-white/5 p-1.5 rounded-full transition-colors">
          <X size={16} />
        </button>
        
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-[0_0_15px_rgba(0,229,255,0.2)] bg-[#0a192f]">
            <img src="/logo.png" alt="Singrar" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-sm mb-1">Instalar Singrar</h3>
            <p className="text-[#8892b0] text-xs leading-relaxed mb-3">
              Instale o app para navegação offline, tela cheia e melhor performance.
            </p>
            
            {isIOS ? (
              <div className="bg-[#0a192f] p-3 rounded-xl border border-white/5 text-[11px] text-white flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span>1. Toque em</span>
                  <Share size={14} className="text-[#00e5ff]" />
                  <span>(Compartilhar)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>2. Selecione <strong>"Adicionar à Tela de Início"</strong></span>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleInstallClick}
                className="w-full py-2.5 bg-gradient-to-r from-[#00e5ff] to-[#ff6b00] text-[#0a192f] font-bold rounded-xl text-sm shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-transform active:scale-95"
              >
                Instalar Agora
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

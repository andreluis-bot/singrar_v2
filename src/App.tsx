/**
 * SeaTrack Pro — App Principal
 * 
 * Melhorias nesta versão:
 * - Navegação com spring animations estilo iOS nativo
 * - Safe areas corretas (iOS notch, Android punch-hole)
 * - Haptic feedback em todas interações críticas
 * - StatusBar controlada nativamente
 * - GPS via hook nativo (@capacitor/geolocation)
 * - Sem hover em touch (active states only)
 * - Direção de animação baseada no índice da tab (push/pop real)
 * - Bottom nav com velocímetro central
 * - Collision detection otimizada
 */

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from 'react';
import {
  Map,
  Compass,
  CloudRain,
  BookOpen,
  Settings,
  AlertTriangle,
  Menu,
  X,
  Navigation,
  Users,
  Trophy,
  Anchor,
  Waves,
  BellRing,
  Radio,
  Wind, // Added Wind
  Droplets, // Added Droplets
  User, // Added User for Profile
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

import { useStore, NavItem as NavItemType, OnlineUser } from './store';
import { RealtimeChannel } from '@supabase/supabase-js';
import { MapView } from './views/MapView';
import { WeatherView } from './views/WeatherView';
import { TidesView } from './views/TidesView';
import { LogbookView } from './views/LogbookView';
import { SettingsView } from './views/SettingsView';
import { EventsView } from './views/EventsView';
import { AchievementsView } from './views/AchievementsView';
import { ProfileView } from './views/ProfileView';
import { AuthView } from './views/AuthView';
import { InstallPrompt } from './components/InstallPrompt';
import { SkeletonScreen } from './components/SkeletonScreen';
import { CompassIndicator } from './components/CompassIndicator';
import { useNMEA } from './hooks/useNMEA';
import { useNativeGPS } from './hooks/useNativeGPS';
import { hapticLight, hapticMedium, hapticHeavy, hapticError, hapticSuccess } from './hooks/useHaptics';
import { supabase } from './lib/supabase';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

/* ============================================================
   TIPOS
   ============================================================ */
type Tab = 'map' | 'weather' | 'tides' | 'logbook' | 'settings' | 'events' | 'achievements' | 'profile';

/* ============================================================
   CONSTANTES
   ============================================================ */
const TAB_ORDER: Tab[] = ['map', 'weather', 'tides', 'logbook', 'events', 'achievements', 'profile', 'settings'];

const NAV_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  map: { icon: <Map size={22} />, label: 'Mapa' },
  weather: { icon: <CloudRain size={22} />, label: 'Tempo' },
  tides: { icon: <Waves size={22} />, label: 'Marés' },
  logbook: { icon: <BookOpen size={22} />, label: 'Diário' },
  settings: { icon: <Settings size={22} />, label: 'Config.' },
  events: { icon: <Users size={22} />, label: 'Eventos' },
  achievements: { icon: <Trophy size={22} />, label: 'Troféus' },
  profile: { icon: <User size={22} />, label: 'Perfil' },
};

/* ============================================================
   HELPERS
   ============================================================ */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// AudioContext singleton para não criar múltiplos
let audioCtx: AudioContext | null = null;
function playAlarmSound(frequency = 880, duration = 0.3) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) { console.error("Audio error:", e); }
}

/* ============================================================
   COMPONENTE: NavItem (bottom tab)
   ============================================================ */
const NavItem = memo(function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onPointerDown={onClick}
      className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 relative min-w-[44px] min-h-[44px] select-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <motion.div
        animate={active ? { scale: 1.15, y: -2 } : { scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={active ? 'text-[#64ffda]' : 'text-[#8892b0]'}
      >
        {icon}
      </motion.div>
      <span
        className={`text-[9px] font-bold uppercase tracking-wider transition-colors duration-200 ${active ? 'text-[#64ffda]' : 'text-[#4a5568]'
          }`}
      >
        {label}
      </span>
      {active && (
        <motion.div
          layoutId="tab-indicator"
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#64ffda]"
          style={{ boxShadow: '0 0 6px #64ffda' }}
        />
      )}
    </button>
  );
});

/* ============================================================
   COMPONENTE: DrawerItem
   ============================================================ */
const DrawerItem = memo(function DrawerItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onPointerDown={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-semibold transition-colors select-none ${active
        ? 'bg-[#64ffda]/10 text-[#64ffda] border border-[#64ffda]/20'
        : 'text-[#8892b0] hover:bg-white/5 hover:text-white border border-transparent'
        }`}
    >
      <span className={active ? 'text-[#64ffda]' : 'text-[#8892b0]'}>{icon}</span>
      {label}
    </button>
  );
});

/* ============================================================
   COMPONENTE: EmergencyOverlay
   ============================================================ */
const EmergencyOverlay = memo(function EmergencyOverlay({
  visible,
  countdown,
  onDismiss,
}: {
  visible: boolean;
  countdown: number | null;
  onDismiss: () => void;
}) {
  const [lastTap, setLastTap] = useState(0);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      onDismiss();
    }
    setLastTap(now);
  };

  return (
    <AnimatePresence>
      {(visible || countdown !== null) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 z-[200] bg-red-600"
          style={{ pointerEvents: 'none' }}
        />
      )}
      {(visible || countdown !== null) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[201] flex items-center justify-center p-6"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-[#0a192f] border-2 border-red-500 rounded-[40px] p-8 w-full max-w-sm text-center shadow-[0_0_60px_rgba(239,68,68,0.6)]"
          >
            <motion.div
              animate={{ scale: [1, 1.3, 1], filter: ['drop-shadow(0 0 5px rgba(239,68,68,0.5))', 'drop-shadow(0 0 20px rgba(239,68,68,1))', 'drop-shadow(0 0 5px rgba(239,68,68,0.5))'] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="text-red-500 mb-6 flex justify-center"
            >
              <AlertTriangle size={72} />
            </motion.div>

            {countdown !== null ? (
              <>
                <h2 className="text-3xl font-black text-red-500 mb-2 uppercase tracking-tighter">Colisão Iminente</h2>
                <p className="text-[#8892b0] mb-6 text-sm">Alerta de proximidade radar!</p>
                <div className="text-8xl font-black text-red-500 font-mono mb-8 tabular-nums">{countdown}</div>
                <button
                  onPointerDown={onDismiss}
                  className="w-full bg-white/5 border border-white/10 text-white/50 py-4 rounded-2xl font-bold uppercase tracking-widest text-xs"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-black text-red-500 mb-2 uppercase tracking-tighter">SOS EM CURSO</h2>
                <p className="text-[#8892b0] mb-8 text-sm leading-relaxed">Transmitindo posição GPS para todas as embarcações na área e serviços de resgate.</p>

                <div className="space-y-3">
                  <button
                    onPointerDown={() => {
                      hapticHeavy();
                    }}
                    onDoubleClick={onDismiss}
                    onClick={handleDoubleTap}
                    className="w-full bg-red-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
                  >
                    Toque duplo para Parar
                  </button>
                  <p className="text-[10px] text-red-500/50 font-bold uppercase tracking-widest">Procedimento de Segurança</p>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

/* ============================================================
   APP PRINCIPAL
   ============================================================ */
export default function App() {
  const prefersReducedMotion = useReducedMotion();

  /* --- Store --- */
  const user = useStore((s) => s.user);
  const isOfflineMode = useStore((s) => s.isOfflineMode);
  const emergency = useStore((s) => s.emergency);
  const setEmergency = useStore((s) => s.setEmergency);
  const collisionCountdown = useStore((s) => s.collisionCountdown);
  const setCollisionCountdown = useStore((s) => s.setCollisionCountdown);
  const weatherAlert = useStore((s) => s.weatherAlert);
  const location = useStore((s) => s.location);
  const speedUnit = useStore((s) => s.speedUnit);
  const setSpeedUnit = useStore((s) => s.setSpeedUnit);
  const navItems = useStore((s) => s.navItems);
  const connectedUsers = useStore((s) => s.onlineUsers) ?? {};
  const radarEnabled = useStore((s) => s.settings?.radarEnabled);
  const anchorAlarm = useStore((s) => s.anchorAlarm);
  const setAnchorAlarm = useStore((s) => s.setAnchorAlarm);
  const setOnlineUsers = useStore((s) => s.setOnlineUsers);
  const checkAchievements = useStore((s) => s.checkAchievements);
  const tracksCount = useStore((s) => (s.tracks || []).length);
  const waypointsCount = useStore((s) => (s.waypoints || []).length);
  const logEntriesCount = useStore((s) => (s.logEntries || []).length);
  const eventsCount = useStore((s) => (s.events || []).length);

  /* --- UI State --- */
  const [activeTab, setActiveTabRaw] = useState<Tab>('map');
  const [prevTab, setPrevTab] = useState<Tab>('map');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(!user && !isOfflineMode);

  // Mostrar Auth Modal sempre que o usuário for null e não estiver em modo offline explícito
  useEffect(() => {
    if (!user && !isOfflineMode) {
      setShowAuthModal(true);
    } else {
      setShowAuthModal(false);
    }
  }, [user, isOfflineMode]);

  // Direção da animação (1=push forward, -1=pop back)
  const slideDirection = useMemo(() => {
    const prevIdx = TAB_ORDER.indexOf(prevTab);
    const nextIdx = TAB_ORDER.indexOf(activeTab);
    return nextIdx >= prevIdx ? 1 : -1;
  }, [activeTab, prevTab]);

  /* --- Navegação com haptic --- */
  const setActiveTab = useCallback(
    async (tab: Tab) => {
      if (tab === activeTab) return;
      await hapticLight();
      setPrevTab(activeTab);
      setActiveTabRaw(tab);
    },
    [activeTab]
  );

  const toggleSpeedUnit = useCallback(async () => {
    await hapticLight();
    setSpeedUnit(speedUnit === 'kt' ? 'kmh' : speedUnit === 'kmh' ? 'mph' : 'kt');
  }, [speedUnit, setSpeedUnit]);

  /* --- Velocidade formatada --- */
  const displaySpeed = useMemo(() => {
    const spd = location?.speed ?? 0;
    if (speedUnit === 'kt') return spd.toFixed(1);
    if (speedUnit === 'kmh') return (spd * 1.852).toFixed(1);
    return (spd * 1.151).toFixed(1);
  }, [location?.speed, speedUnit]);

  /* --- Hooks --- */
  useNMEA();
  useNativeGPS({ enabled: true, enableHighAccuracy: true });

  /* --- Inicialização Nativa --- */
  useEffect(() => {
    const init = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#0a192f' });
          await StatusBar.setOverlaysWebView({ overlay: false });
        } catch (e) { /* browser */ }
      }

      // Pequeno delay para garantir que assets carregaram
      await new Promise((r) => setTimeout(r, 300));

      try {
        await SplashScreen.hide({ fadeOutDuration: 400 });
      } catch { /* browser */ }

      setIsAppReady(true);
    };

    init();
  }, []);

  // Auth listener agora apenas atualiza o estado, não bloqueia o render
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      useStore.getState().setUser(session?.user ?? null);
      if (session?.user) useStore.getState().syncData();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      useStore.getState().setUser(session?.user ?? null);
      if (session?.user) useStore.getState().syncData();
    });

    return () => subscription.unsubscribe();
  }, []);

  /* --- Radar Realtime --- */
  const radarChannelRef = useRef<RealtimeChannel | null>(null);
  useEffect(() => {
    if (!user || !radarEnabled || isOfflineMode) {
      radarChannelRef.current?.unsubscribe();
      radarChannelRef.current = null;
      return;
    }

    const channel = supabase.channel('radar', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: Record<string, any> = {};
        for (const [key, arr] of Object.entries(state)) {
          if (key !== user.id && Array.isArray(arr) && arr[0]) {
            users[key] = arr[0];
          }
        }
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && location) {
          await channel.track({
            id: user.id,
            lat: location.lat,
            lng: location.lng,
            heading: location.heading,
            speed: location.speed,
            updatedAt: Date.now(),
          });
        }
      });

    radarChannelRef.current = channel;
    return () => {
      channel.unsubscribe();
      radarChannelRef.current = null;
    };
  }, [user, radarEnabled, isOfflineMode]); // eslint-disable-line

  /* --- Atualizar presença quando localização muda com Throttle --- */
  const lastPresenceUpdate = useRef<number>(0);
  /* --- Alarme de Âncora (Global) --- */
  useEffect(() => {
    if (!anchorAlarm.active || !location) return;

    const dist = Math.sqrt(
      (location.lat - anchorAlarm.lat) ** 2 + (location.lng - anchorAlarm.lng) ** 2
    ) * 111000;

    if (dist > anchorAlarm.radius && !anchorAlarm.triggered) {
      setAnchorAlarm({ triggered: true, acknowledged: false });
      hapticError();
    }
  }, [location, anchorAlarm, setAnchorAlarm]);

  // Loop de som do Alarme de Âncora
  useEffect(() => {
    let interval: any;
    if (anchorAlarm.active && anchorAlarm.triggered && !anchorAlarm.acknowledged) {
      playAlarmSound();
      interval = setInterval(() => {
        playAlarmSound();
        hapticHeavy();
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [anchorAlarm.active, anchorAlarm.triggered, anchorAlarm.acknowledged]);

  /* --- Atualizar presença quando localização muda com Throttle --- */
  useEffect(() => {
    if (!location || !radarChannelRef.current || !user || isOfflineMode || !radarEnabled) return;

    const now = Date.now();
    if (now - lastPresenceUpdate.current < 5000) return;
    lastPresenceUpdate.current = now;

    radarChannelRef.current.track({
      id: user?.id || 'guest-' + Math.random(),
      email: user?.email || 'Convidado',
      lat: location.lat,
      lng: location.lng,
      speed: location.speed,
      heading: location.heading,
      sos: emergency,
      updatedAt: Date.now(),
    });
  }, [radarEnabled, isOfflineMode, user?.id, user?.email, emergency, location]);

  /* --- Collision Detection (otimizada com Refs) --- */
  const locationRef = useRef(location);
  const usersRef = useRef(connectedUsers);
  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { usersRef.current = connectedUsers; }, [connectedUsers]);

  useEffect(() => {
    if (!radarEnabled || isOfflineMode || emergency || collisionCountdown !== null) return;

    const id = setInterval(() => {
      const currentLoc = locationRef.current;
      if (!currentLoc) return;

      const users = Object.values(usersRef.current) as OnlineUser[];
      const hasImminent = users.some(
        (u) =>
          u.id !== user?.id &&
          getDistance(currentLoc.lat, currentLoc.lng, u.lat, u.lng) < 50 &&
          (u.speed || 0) > 1
      );
      if (hasImminent) {
        setCollisionCountdown(30);
        playAlarmSound();
        hapticError();
      }
    }, 3000);

    return () => clearInterval(id);
  }, [radarEnabled, isOfflineMode, emergency, collisionCountdown, user?.id, setCollisionCountdown]);

  /* --- Collision countdown --- */
  useEffect(() => {
    if (collisionCountdown === null) return;
    if (collisionCountdown <= 0) {
      setEmergency(true);
      setCollisionCountdown(null);
      hapticError();
      return;
    }
    const id = setTimeout(() => setCollisionCountdown(collisionCountdown - 1), 1000);
    return () => clearTimeout(id);
  }, [collisionCountdown, setCollisionCountdown, setEmergency]);

  /* --- Weather Alert --- */
  useEffect(() => {
    if (weatherAlert !== null) {
      playAlarmSound();
      hapticWarning();
    }
  }, [weatherAlert]);

  /* --- Achievements --- */
  useEffect(() => {
    checkAchievements();
  }, [tracksCount, waypointsCount, logEntriesCount, eventsCount, checkAchievements]);

  /* --- Acelerômetro (colisão física) --- */
  useEffect(() => {
    const handleMotion = (e: DeviceMotionEvent) => {
      if (collisionCountdown !== null || emergency) return;
      const acc = e.acceleration;
      if (!acc) return;
      const total = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      if (total > 25) {
        setCollisionCountdown(30);
        hapticError();
      }
    };
    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [collisionCountdown, emergency, setCollisionCountdown]);

  /* --- Funções --- */
  // SOS Loop (Sound + Haptics)
  useEffect(() => {
    let interval: any;
    if (emergency) {
      const playSOS = async () => {
        // Morse SOS: ... --- ...
        const dot = 200;
        const dash = 600;
        const gap = 200;

        const sequence = [
          dot, gap, dot, gap, dot, gap, // S
          dash, gap, dash, gap, dash, gap, // O
          dot, gap, dot, gap, dot // S
        ];

        for (const duration of sequence) {
          if (!useStore.getState().emergency) break;
          playAlarmSound(duration > 300 ? 600 : 300); // Diferencia pitch
          hapticMedium();
          await new Promise(r => setTimeout(r, duration));
        }
      };

      playSOS();
      interval = setInterval(playSOS, 5000);
    }
    return () => clearInterval(interval);
  }, [emergency]);

  const handleDismissEmergency = useCallback(() => {
    setEmergency(false);
    setCollisionCountdown(null);
  }, [setEmergency, setCollisionCountdown]);

  /* ============================================================
     ANIMAÇÃO DE TRANSIÇÃO DE TABS — estilo iOS nativo
     ============================================================ */
  const pageVariants = prefersReducedMotion
    ? {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    }
    : {
      initial: (dir: number) => ({
        x: dir > 0 ? '100%' : '-100%',
        opacity: 0,
      }),
      animate: {
        x: 0,
        opacity: 1,
        transition: {
          type: 'spring' as const,
          stiffness: 380,
          damping: 38,
          mass: 0.8,
        },
      },
      exit: (dir: number) => ({
        x: dir > 0 ? '-40%' : '40%',
        opacity: 0,
        transition: {
          duration: 0.22,
          ease: [0.36, 0, 0.66, -0.1],
        },
      }),
    };

  /* ============================================================
     RENDER — Loading
     ============================================================ */
  if (!isAppReady) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center bg-[#0a192f]"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="relative"
        >
          <motion.img
            src="/logo.png"
            alt="SeaTrack Logo"
            className="w-32 h-32 object-contain"
            animate={{
              filter: ["drop-shadow(0 0 0px #64ffda00)", "drop-shadow(0 0 20px #64ffda66)", "drop-shadow(0 0 0px #64ffda00)"]
            }}
            transition={{ repeat: Infinity, duration: 3 }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-8 flex flex-col items-center"
        >
          <h1 className="text-xl font-black tracking-[0.3em] text-white uppercase mb-2">SeaTrack Pro</h1>
          <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden relative">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#64ffda] to-[#00e5ff]"
              animate={{ left: ["-100%", "100%"] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              style={{ width: "50%" }}
            />
          </div>
          <p className="mt-4 text-[#8892b0] text-[10px] font-bold tracking-widest uppercase opacity-50">Localizando Satélites...</p>
        </motion.div>
      </div>
    );
  }

  /* ============================================================
     RENDER — Auth
     ============================================================  // O SplashScreen será escondido sempre independentemente de ter user ou não
  
  /* ============================================================
     RENDER — App
     ============================================================ */
  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0a192f' }}
    >
      {/* Safe area top — StatusBar iOS/Android */}
      <div style={{ height: 'env(safe-area-inset-top, 0px)', background: '#0a192f', flexShrink: 0 }} />

      {/* ---- HEADER ---- */}
      <header
        className="shrink-0 relative z-[20] flex items-center justify-between px-4 pb-3 pt-safe bg-[#0a192f]/80 backdrop-blur-xl border-b border-white/5 shadow-2xl"
      >
        {/* Menu button */}
        <button
          onPointerDown={async () => {
            await hapticLight();
            setIsMenuOpen(true);
          }}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-[#8892b0] active:bg-white/10 active:text-white transition-colors select-none"
        >
          <Menu size={22} />
        </button>

        {/* App title and Compass */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <CompassIndicator />
          <div className="flex flex-col items-center">
            <img src="/logo.png" alt="Logo" className="h-6 w-auto object-contain" />
            <span className="text-[8px] font-black tracking-[0.2em] text-[#64ffda] uppercase mt-0.5">
              SeaTrack
            </span>
            {isOfflineMode && (
              <span className="text-[7px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 mt-0.5 rounded font-bold">
                OFFLINE
              </span>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="flex items-center gap-2">
          {weatherAlert && (
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="text-amber-400"
            >
              <BellRing size={20} />
            </motion.div>
          )}

          {radarEnabled && (
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className={Object.keys(connectedUsers).length > 0 ? 'text-[#64ffda]' : 'text-[#8892b0]'}
            >
              <Radio size={18} />
            </motion.div>
          )}
        </div>
      </header>

      {/* ---- MAIN CONTENT ---- */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="popLayout" custom={slideDirection}>
          <motion.div
            key={activeTab}
            custom={slideDirection}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 will-animate"
            style={{ willChange: 'transform, opacity' }}
          >
            {activeTab === 'map' && <MapView radarEnabled={radarEnabled} connectedUsers={connectedUsers} />}
            {activeTab === 'weather' && <WeatherView />}
            {activeTab === 'tides' && <TidesView />}
            {activeTab === 'logbook' && <LogbookView />}
            {activeTab === 'events' && <EventsView />}
            {activeTab === 'achievements' && <AchievementsView />}
            {activeTab === 'profile' && <ProfileView />}
            {activeTab === 'settings' && <SettingsView />}
          </motion.div>
        </AnimatePresence>

        {/* MENU LATERAL */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 z-[400]"
                onPointerDown={() => setIsMenuOpen(false)}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute top-0 left-0 bottom-0 w-4/5 max-w-sm z-[401] flex flex-col pt-safe pb-safe"
                style={{ background: '#0a192f', borderRight: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="p-6 shrink-0 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-[#64ffda]">
                      <Anchor size={24} />
                    </div>
                    <div>
                      <h2 className="text-white font-bold">{user ? "Comandante" : "Convidado"}</h2>
                      <p className="text-[#8892b0] text-sm">
                        {isOfflineMode ? 'Modo Offline' : (user ? 'SeaTrack Pro' : 'Modo Visitante')}
                      </p>
                    </div>
                  </div>
                  {!user && !isOfflineMode && (
                    <button
                      onPointerDown={() => setShowAuthModal(true)}
                      className="p-2 rounded-xl bg-[#64ffda]/10 text-[#64ffda] text-xs font-bold"
                    >
                      Entrar
                    </button>
                  )}
                </div>
                {/* Drawer items */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-1">
                  <DrawerItem
                    icon={<Map size={20} />}
                    label="Mapa de Navegação"
                    active={activeTab === 'map'}
                    onClick={() => { setActiveTab('map'); setIsMenuOpen(false); }}
                  />
                  <DrawerItem
                    icon={<CloudRain size={20} />}
                    label="Meteorologia"
                    active={activeTab === 'weather'}
                    onClick={() => { setActiveTab('weather'); setIsMenuOpen(false); }}
                  />
                  <DrawerItem
                    icon={<Waves size={20} />}
                    label="Marés e Previsões"
                    active={activeTab === 'tides'}
                    onClick={() => { setActiveTab('tides'); setIsMenuOpen(false); }}
                  />

                  <div className="pt-2 pb-1 px-2">
                    <p className="text-[10px] text-[#4a5568] font-bold uppercase tracking-widest">
                      Comunidade
                    </p>
                  </div>

                  <DrawerItem
                    icon={<Users size={20} />}
                    label="Eventos Náuticos"
                    active={activeTab === 'events'}
                    onClick={() => { setActiveTab('events'); setIsMenuOpen(false); }}
                  />
                  <DrawerItem
                    icon={<Trophy size={20} />}
                    label="Conquistas"
                    active={activeTab === 'achievements'}
                    onClick={() => { setActiveTab('achievements'); setIsMenuOpen(false); }}
                  />
                  <DrawerItem
                    icon={<User size={20} />}
                    label="Meu Perfil"
                    active={activeTab === 'profile'}
                    onClick={() => { setActiveTab('profile'); setIsMenuOpen(false); }}
                  />
                  <DrawerItem
                    icon={<BookOpen size={20} />}
                    label="Diário de Bordo"
                    active={activeTab === 'logbook'}
                    onClick={() => { setActiveTab('logbook'); setIsMenuOpen(false); }}
                  />

                  <div className="mt-auto pt-4 border-t border-white/8">
                    <DrawerItem
                      icon={<Settings size={20} />}
                      label="Configurações"
                      active={activeTab === 'settings'}
                      onClick={() => { setActiveTab('settings'); setIsMenuOpen(false); }}
                    />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ---- EMERGENCY OVERLAY ---- */}
        <EmergencyOverlay
          visible={emergency}
          countdown={collisionCountdown}
          onDismiss={handleDismissEmergency}
        />
      </main>

      {/* ---- BOTTOM NAVIGATION ---- */}
      <nav
        className="shrink-0 relative z-[30]"
        style={{
          background: 'rgba(10, 25, 47, 0.85)',
          backdropFilter: 'blur(30px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {/* Tab 1 */}
          {navItems[0] && NAV_CONFIG[navItems[0]] && (
            <NavItem
              icon={NAV_CONFIG[navItems[0]].icon}
              label={NAV_CONFIG[navItems[0]].label}
              active={activeTab === navItems[0]}
              onClick={() => setActiveTab(navItems[0] as Tab)}
            />
          )}

          {/* Tab 2 */}
          {navItems[1] && NAV_CONFIG[navItems[1]] && (
            <NavItem
              icon={NAV_CONFIG[navItems[1]].icon}
              label={NAV_CONFIG[navItems[1]].label}
              active={activeTab === navItems[1]}
              onClick={() => setActiveTab(navItems[1] as Tab)}
            />
          )}

          {/* ---- VELOCÍMETRO CENTRAL ---- */}
          <button
            onPointerDown={() => {
              if (activeTab !== 'map') {
                setActiveTab('map');
              } else {
                toggleSpeedUnit();
              }
            }}
            className="relative flex flex-col items-center justify-center select-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <motion.div
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 600, damping: 30 }}
              className={`
                -mt-8 w-[68px] h-[68px] rounded-full flex flex-col items-center justify-center
                border-4 border-[#0a192f] shadow-2xl z-10
                ${activeTab === 'map'
                  ? 'bg-gradient-to-br from-[#00e5ff] via-[#64ffda] to-[#ff6b00]'
                  : 'bg-gradient-to-b from-[#112240] to-[#0a192f]'
                }
              `}
              style={{
                boxShadow: activeTab === 'map'
                  ? '0 0 24px rgba(100,255,218,0.5), 0 8px 24px rgba(0,0,0,0.4)'
                  : '0 4px 20px rgba(0,0,0,0.4)',
              }}
            >
              <span
                className={`text-xl font-black font-mono leading-none ${activeTab === 'map' ? 'text-[#0a192f]' : 'text-[#64ffda]'
                  }`}
              >
                {displaySpeed}
              </span>
              <span
                className={`text-[8px] uppercase font-bold mt-0.5 ${activeTab === 'map' ? 'text-[#0a192f]/70' : 'text-[#8892b0]'
                  }`}
              >
                {speedUnit === 'kt' ? 'Nós' : speedUnit === 'kmh' ? 'km/h' : 'mph'}
              </span>
            </motion.div>

            {activeTab === 'map' && (
              <span className="text-[9px] text-[#64ffda] font-bold uppercase tracking-wider mt-0.5">
                Mapa
              </span>
            )}
          </button>

          {/* Tab 3 */}
          {navItems[2] && NAV_CONFIG[navItems[2]] && (
            <NavItem
              icon={NAV_CONFIG[navItems[2]].icon}
              label={NAV_CONFIG[navItems[2]].label}
              active={activeTab === navItems[2]}
              onClick={() => setActiveTab(navItems[2] as Tab)}
            />
          )}

          {/* Settings sempre fixo no último slot */}
          <NavItem
            icon={<Settings size={22} />}
            label="Config."
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </div>
      </nav>

      {/* AUTH MODAL (Convidado -> Login) */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute inset-0 z-[1000] bg-[#0a192f] overflow-hidden"
          >
            {/* Header especial pro auth modal caso seja acessado pelo app pra poder fechar */}
            <div className="absolute top-safe pt-4 right-4 z-[1001]">
              <button
                onPointerDown={() => setShowAuthModal(false)}
                className="w-10 h-10 rounded-full bg-white/10 flex flex-col justify-center items-center text-white/50 backdrop-blur-md"
              >
                <X size={20} />
              </button>
            </div>
            <AuthView />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- ANCHOR ALARM MODAL ---- */}
      <AnimatePresence>
        {anchorAlarm.active && anchorAlarm.triggered && !anchorAlarm.acknowledged && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-red-600/20 backdrop-blur-md px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-[#0a192f] border-2 border-red-500 rounded-[32px] p-8 w-full max-w-sm text-center shadow-[0_0_50px_rgba(239,68,68,0.4)]"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-red-500 flex justify-center mb-6"
              >
                <Anchor size={64} style={{ filter: 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.5))' }} />
              </motion.div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Âncora Garrando!</h2>
              <p className="text-[#8892b0] text-sm mb-8 leading-relaxed">Sua embarcação saiu do raio de segurança definido. Verifique imediatamente!</p>

              <button
                onPointerDown={() => {
                  hapticSuccess();
                  setAnchorAlarm({ acknowledged: true });
                }}
                className="w-full bg-red-500 hover:bg-red-400 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-lg uppercase tracking-widest"
              >
                Estou Ciente
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <InstallPrompt />
    </div>
  );
}

// Suprimir warning de hapticWarning not defined
function hapticWarning() {
  navigator.vibrate?.([30, 30, 30]);
}

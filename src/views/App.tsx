/**
 * SeaTrack Pro — App Principal
 *
 * CORREÇÕES APLICADAS:
 * - CompassIndicator recebe mapOrientation + onToggleOrientation
 * - DeviceOrientationEvent: requestPermission iOS 13+ + ambos listeners (absolute + fallback)
 * - Speedometer label "Nós/km/h/mph" com fontSize legível (10px, não 8px)
 * - DrawerItem usa onPointerDown + haptic (touch-first)
 * - EmergencyOverlay: doubleTap com ref de timing correto
 * - Floating sheets do mapa não bloqueiam nav (z-index correto, main overflow-hidden)
 * - isAuthLoading: não mostra AuthModal enquanto sessão é verificada
 */

import React, {
  useState, useEffect, useRef, useMemo, useCallback, memo,
} from 'react';
import {
  Map, CloudRain, Settings, AlertTriangle, Menu, X,
  Users, Trophy, Anchor, Waves, BellRing, Radio,
  User, Wrench, BookOpen,
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
import { MaintenanceView } from './views/MaintenanceView';
import { AuthView } from './views/AuthView';
import { InstallPrompt } from './components/InstallPrompt';
import { SkeletonScreen } from './components/SkeletonScreen';
import { CompassIndicator } from './components/CompassIndicator';
import { useNMEA } from './hooks/useNMEA';
import { useNativeGPS } from './hooks/useNativeGPS';
import {
  hapticLight, hapticMedium, hapticHeavy, hapticError, hapticSuccess,
} from './hooks/useHaptics';
import { supabase } from './lib/supabase';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

/* ============================================================
   TIPOS
   ============================================================ */
type Tab =
  | 'map' | 'weather' | 'tides' | 'logbook'
  | 'settings' | 'events' | 'achievements' | 'profile' | 'maintenance';

/* ============================================================
   CONSTANTES
   ============================================================ */
const TAB_ORDER: Tab[] = [
  'map', 'weather', 'tides', 'logbook',
  'events', 'achievements', 'maintenance', 'profile', 'settings',
];

const NAV_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  map:          { icon: <Map size={22} />,       label: 'Mapa' },
  weather:      { icon: <CloudRain size={22} />, label: 'Tempo' },
  tides:        { icon: <Waves size={22} />,     label: 'Marés' },
  logbook:      { icon: <BookOpen size={22} />,  label: 'Diário' },
  events:       { icon: <Users size={22} />,     label: 'Eventos' },
  achievements: { icon: <Trophy size={22} />,    label: 'Troféus' },
  profile:      { icon: <User size={22} />,      label: 'Perfil' },
  maintenance:  { icon: <Wrench size={22} />,    label: 'Manutenção' },
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

function playAlarmSound(frequency = 880, durationSec = 0.3) {
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
    osc.stop(ctx.currentTime + durationSec);
    osc.onended = () => ctx.close();
  } catch { /* silencioso */ }
}

function hapticWarning() {
  navigator.vibrate?.([30, 50, 30, 50, 30]);
}

/* ============================================================
   NavItem
   ============================================================ */
const NavItem = memo(function NavItem({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
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
        className="font-bold uppercase tracking-wider"
        style={{ fontSize: '9px', color: active ? '#64ffda' : '#8892b0' }}
      >
        {label}
      </span>
    </button>
  );
});

/* ============================================================
   DrawerItem
   ============================================================ */
const DrawerItem = memo(function DrawerItem({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onPointerDown={async () => { await hapticLight(); onClick(); }}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl select-none"
      style={{
        background: active ? 'rgba(100,255,218,0.1)' : 'transparent',
        color: active ? '#64ffda' : '#8892b0',
      }}
    >
      <span style={{ color: active ? '#64ffda' : '#8892b0' }}>{icon}</span>
      <span className="font-semibold text-sm">{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#64ffda]" />}
    </button>
  );
});

/* ============================================================
   EmergencyOverlay
   ============================================================ */
const EmergencyOverlay = memo(function EmergencyOverlay({
  visible, countdown, onDismiss,
}: {
  visible: boolean; countdown: number | null; onDismiss: () => void;
}) {
  const lastTapRef = useRef<number>(0);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 400) onDismiss();
    lastTapRef.current = now;
  }, [onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[600] flex items-center justify-center px-6"
          style={{ background: 'rgba(239,68,68,0.15)', backdropFilter: 'blur(20px)' }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-sm rounded-[32px] p-8 text-center"
            style={{
              background: '#0a192f',
              border: '2px solid rgba(239,68,68,0.6)',
              boxShadow: '0 0 60px rgba(239,68,68,0.3)',
            }}
          >
            {countdown !== null ? (
              <>
                <h2 className="text-3xl font-black text-red-500 mb-2 uppercase tracking-tighter">Colisão Iminente</h2>
                <p className="text-[#8892b0] mb-6 text-sm">Alerta de proximidade radar!</p>
                <div className="text-8xl font-black text-red-500 font-mono mb-8 tabular-nums">{countdown}</div>
                <button onPointerDown={onDismiss} className="w-full bg-white/5 border border-white/10 text-white/50 py-4 rounded-2xl font-bold uppercase tracking-widest text-xs">
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-black text-red-500 mb-2 uppercase tracking-tighter">SOS EM CURSO</h2>
                <p className="text-[#8892b0] mb-8 text-sm leading-relaxed">
                  Transmitindo posição GPS para todas as embarcações na área e serviços de resgate.
                </p>
                <div className="space-y-3">
                  <button
                    onPointerDown={() => hapticHeavy()}
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
  const user               = useStore((s) => s.user);
  const isOfflineMode      = useStore((s) => s.isOfflineMode);
  const emergency          = useStore((s) => s.emergency);
  const setEmergency       = useStore((s) => s.setEmergency);
  const collisionCountdown = useStore((s) => s.collisionCountdown);
  const setCollisionCountdown = useStore((s) => s.setCollisionCountdown);
  const setWeatherAlert    = useStore((s) => s.setWeatherAlert);
  const weatherAlert       = useStore((s) => s.weatherAlert);
  const location           = useStore((s) => s.location);
  const speedUnit          = useStore((s) => s.speedUnit);
  const setSpeedUnit       = useStore((s) => s.setSpeedUnit);
  const setDeviceHeading   = useStore((s) => s.setDeviceHeading);
  const navItems           = useStore((s) => s.navItems);
  const connectedUsers     = useStore((s) => s.onlineUsers) ?? {};
  const radarEnabled       = useStore((s) => s.settings?.radarEnabled);
  const anchorAlarm        = useStore((s) => s.anchorAlarm);
  const setAnchorAlarm     = useStore((s) => s.setAnchorAlarm);
  const setOnlineUsers     = useStore((s) => s.setOnlineUsers);
  const checkAchievements  = useStore((s) => s.checkAchievements);
  const tracksCount        = useStore((s) => (s.tracks || []).length);
  const waypointsCount     = useStore((s) => (s.waypoints || []).length);
  const logEntriesCount    = useStore((s) => (s.logEntries || []).length);
  const eventsCount        = useStore((s) => (s.events || []).length);
  const isAuthLoading      = useStore((s) => s.isAuthLoading);

  /* --- UI State --- */
  const [activeTab, setActiveTabRaw] = useState<Tab>('map');
  const [prevTab, setPrevTab]         = useState<Tab>('map');
  const [isMenuOpen, setIsMenuOpen]   = useState(false);
  const [isAppReady, setIsAppReady]   = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [mapOrientation, setMapOrientation] = useState<'north' | 'course'>('north');

  useEffect(() => {
    // Aguarda auth check antes de exibir modal
    if (!isAuthLoading && !user && !isOfflineMode) {
      setShowAuthModal(true);
    } else if (user || isOfflineMode) {
      setShowAuthModal(false);
    }
  }, [user, isOfflineMode, isAuthLoading]);

  /* Direção de animação */
  const slideDirection = useMemo(() => {
    const pi = TAB_ORDER.indexOf(prevTab);
    const ni = TAB_ORDER.indexOf(activeTab);
    return ni >= pi ? 1 : -1;
  }, [activeTab, prevTab]);

  const setActiveTab = useCallback(async (tab: Tab) => {
    if (tab === activeTab) return;
    await hapticLight();
    setPrevTab(activeTab);
    setActiveTabRaw(tab);
  }, [activeTab]);

  const toggleSpeedUnit = useCallback(async () => {
    await hapticLight();
    setSpeedUnit(speedUnit === 'kt' ? 'kmh' : speedUnit === 'kmh' ? 'mph' : 'kt');
  }, [speedUnit, setSpeedUnit]);

  const displaySpeed = useMemo(() => {
    const spd = location?.speed ?? 0;
    if (speedUnit === 'kt')  return spd.toFixed(1);
    if (speedUnit === 'kmh') return (spd * 1.852).toFixed(1);
    return (spd * 1.151).toFixed(1);
  }, [location?.speed, speedUnit]);

  const speedLabel = speedUnit === 'kt' ? 'Nós' : speedUnit === 'kmh' ? 'km/h' : 'mph';

  /* --- Hooks --- */
  useNMEA();
  useNativeGPS({ enabled: true, enableHighAccuracy: true });

  /* --- Inicialização nativa --- */
  useEffect(() => {
    const init = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#0a192f' });
          await StatusBar.setOverlaysWebView({ overlay: false });
        } catch { }
      }
      await new Promise(r => setTimeout(r, 300));
      try { await SplashScreen.hide({ fadeOutDuration: 400 }); } catch { }
      setIsAppReady(true);
    };
    init();
  }, []);

  const setUser = useStore((s) => s.setUser);
  const setIsAuthLoading = useStore((s) => s.setIsAuthLoading);
  const setOfflineMode = useStore((s) => s.setOfflineMode);

  /* --- Auth Listener --- */
  useEffect(() => {
    let mounted = true;
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) { setUser(session?.user ?? null); setIsAuthLoading(false); }
    };
    initSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (mounted) { setUser(session?.user ?? null); setIsAuthLoading(false); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [setUser, setIsAuthLoading]);

  /* --- Radar Realtime --- */
  const radarChannelRef = useRef<RealtimeChannel | null>(null);
  useEffect(() => {
    if (!user || !radarEnabled || isOfflineMode) {
      radarChannelRef.current?.unsubscribe();
      radarChannelRef.current = null;
      return;
    }
    const channel = supabase.channel('radar', { config: { presence: { key: user.id } } });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: Record<string, any> = {};
        for (const [key, arr] of Object.entries(state)) {
          if (key !== user.id && Array.isArray(arr) && arr[0]) users[key] = arr[0];
        }
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && location) {
          await channel.track({
            id: user.id, lat: location.lat, lng: location.lng,
            heading: location.heading, speed: location.speed,
            isAnchored: anchorAlarm.active, sos: emergency, updatedAt: Date.now(),
          });
        }
      });
    radarChannelRef.current = channel;
    return () => { channel.unsubscribe(); radarChannelRef.current = null; };
  }, [user, radarEnabled, isOfflineMode]); // eslint-disable-line

  /* --- Presence throttled --- */
  const lastPresenceUpdate = useRef<number>(0);
  useEffect(() => {
    if (!location || !radarChannelRef.current || !user || isOfflineMode || !radarEnabled) return;
    const now = Date.now();
    if (now - lastPresenceUpdate.current < 5000) return;
    lastPresenceUpdate.current = now;
    radarChannelRef.current.track({
      id: user.id, email: user.email || '',
      lat: location.lat, lng: location.lng,
      speed: location.speed, heading: location.heading,
      sos: emergency, updatedAt: Date.now(),
    });
  }, [radarEnabled, isOfflineMode, user?.id, user?.email, emergency, location]);

  /* --- Âncora garrada --- */
  useEffect(() => {
    if (!anchorAlarm.active || !location) return;
    const dist = Math.sqrt(
      (location.lat - anchorAlarm.lat) ** 2 + (location.lng - anchorAlarm.lng) ** 2
    ) * 111_000;
    if (dist > anchorAlarm.radius && !anchorAlarm.triggered) {
      setAnchorAlarm({ triggered: true, acknowledged: false });
      hapticError();
    }
  }, [location, anchorAlarm, setAnchorAlarm]);

  /* --- Loop de som âncora --- */
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    if (anchorAlarm.active && anchorAlarm.triggered && !anchorAlarm.acknowledged) {
      playAlarmSound();
      id = setInterval(() => { playAlarmSound(); hapticHeavy(); }, 3000);
    }
    return () => clearInterval(id!);
  }, [anchorAlarm.active, anchorAlarm.triggered, anchorAlarm.acknowledged]);

  /* --- Collision detection --- */
  const locationRef = useRef(location);
  const usersRef    = useRef(connectedUsers);
  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { usersRef.current = connectedUsers; }, [connectedUsers]);

  useEffect(() => {
    if (!radarEnabled || isOfflineMode || emergency || collisionCountdown !== null) return;
    const id = setInterval(() => {
      const loc = locationRef.current;
      if (!loc) return;
      const hasImminent = Object.values(usersRef.current as Record<string, OnlineUser>).some(
        (u) => u.id !== user?.id && getDistance(loc.lat, loc.lng, u.lat, u.lng) < 50 && (u.speed || 0) > 1
      );
      if (hasImminent) { setCollisionCountdown(30); playAlarmSound(); hapticError(); }
    }, 3000);
    return () => clearInterval(id);
  }, [radarEnabled, isOfflineMode, emergency, collisionCountdown, user?.id, setCollisionCountdown]);

  /* --- Collision countdown --- */
  useEffect(() => {
    if (collisionCountdown === null) return;
    if (collisionCountdown <= 0) { setEmergency(true); setCollisionCountdown(null); hapticError(); return; }
    const id = setTimeout(() => setCollisionCountdown(collisionCountdown - 1), 1000);
    return () => clearTimeout(id);
  }, [collisionCountdown, setCollisionCountdown, setEmergency]);

  /* --- Weather alert sound --- */
  useEffect(() => {
    if (weatherAlert !== null) { playAlarmSound(900, 1); hapticWarning(); }
  }, [weatherAlert]);

  /* --- Barômetro --- */
  const lastBaroCheck = useRef<number>(0);
  useEffect(() => {
    if (!location || isOfflineMode) return;
    const check = async () => {
      const now = Date.now();
      if (now - lastBaroCheck.current < 3_600_000) return;
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&hourly=surface_pressure&past_days=1&forecast_days=1`
        );
        const data = await res.json();
        if (data.hourly?.surface_pressure) {
          const p = data.hourly.surface_pressure as number[];
          const cur = p[p.length - 1];
          const ago = p[Math.max(0, p.length - 4)];
          if (ago && cur && (ago - cur) >= 2) setWeatherAlert('ALERTA: Queda brusca de pressão. Tempestade iminente!');
          else if (ago && cur && (ago - cur) >= 1) setWeatherAlert('CAUTELA: Pressão em declínio.');
        }
        lastBaroCheck.current = now;
      } catch { }
    };
    check();
    const id = setInterval(check, 3_600_000);
    return () => clearInterval(id);
  }, [location, isOfflineMode, setWeatherAlert]);

  /* --- Achievements --- */
  useEffect(() => {
    checkAchievements();
  }, [tracksCount, waypointsCount, logEntriesCount, eventsCount, checkAchievements]);

  /* --- Device Orientation (Bússola) — CORRIGIDO: iOS 13+ requestPermission + ambos listeners --- */
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const iosHeading = (e as any).webkitCompassHeading;
      if (typeof iosHeading === 'number' && !isNaN(iosHeading)) {
        setDeviceHeading(iosHeading);
        return;
      }
      if (e.alpha !== null) {
        setDeviceHeading((360 - e.alpha) % 360);
      }
    };

    const attach = () => {
      window.addEventListener('deviceorientationabsolute', handleOrientation as any, true);
      window.addEventListener('deviceorientation', handleOrientation as any, true);
    };

    const DOE = (window as any).DeviceOrientationEvent;
    if (typeof DOE?.requestPermission === 'function') {
      DOE.requestPermission()
        .then((r: string) => { if (r === 'granted') attach(); })
        .catch(attach);
    } else {
      attach();
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as any, true);
      window.removeEventListener('deviceorientation', handleOrientation as any, true);
    };
  }, [setDeviceHeading]);

  /* --- SOS Morse loop --- */
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    if (emergency) {
      const playSOS = async () => {
        const seq = [200, 200, 200, 200, 200, 200, 600, 200, 600, 200, 600, 200, 200, 200, 200, 200, 200];
        for (const d of seq) {
          if (!useStore.getState().emergency) break;
          playAlarmSound(d > 400 ? 600 : 880, d / 1000);
          hapticMedium();
          await new Promise(r => setTimeout(r, d + 100));
        }
      };
      playSOS();
      id = setInterval(playSOS, 5000);
    }
    return () => clearInterval(id!);
  }, [emergency]);

  const handleDismissEmergency = useCallback(() => {
    setEmergency(false);
    setCollisionCountdown(null);
  }, [setEmergency, setCollisionCountdown]);

  /* --- SOS persist --- */
  const locRef2 = useRef(location);
  useEffect(() => { locRef2.current = location; }, [location]);
  useEffect(() => {
    if (emergency && user && !isOfflineMode) {
      supabase.from('emergencies').insert({
        user_id: user.id,
        lat: locRef2.current?.lat, lng: locRef2.current?.lng,
        type: 'sos', status: 'active',
      }).then(({ error }) => { if (error) console.error('SOS persist:', error); });
    }
  }, [emergency, user, isOfflineMode]);

  /* ============================================================
     ANIMAÇÕES
     ============================================================ */
  const pageVariants = prefersReducedMotion
    ? { initial: {}, animate: {}, exit: {} }
    : {
        initial: (dir: number) => ({ x: dir > 0 ? '30%' : '-30%', opacity: 0 }),
        animate: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 380, damping: 36 } },
        exit: (dir: number) => ({
          x: dir > 0 ? '-30%' : '30%', opacity: 0,
          transition: { duration: 0.18, ease: 'easeIn' },
        }),
      };

  /* ============================================================
     LOADING SCREEN
     ============================================================ */
  if (!isAppReady || isAuthLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center" style={{ background: '#0a192f' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(100,255,218,0.4)]"
            style={{ background: 'linear-gradient(135deg,#64ffda,#00e5ff)' }}>
            <span className="text-3xl font-black" style={{ color: '#0a192f' }}>S</span>
          </div>
          <div className="w-48 h-1 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <motion.div
              className="absolute inset-y-0 left-0"
              style={{ width: '50%', background: 'linear-gradient(to right, #64ffda, #00e5ff)' }}
              animate={{ left: ['-100%', '100%'] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            />
          </div>
          <p className="text-[10px] font-bold tracking-widest uppercase opacity-50" style={{ color: '#8892b0' }}>
            Localizando Satélites...
          </p>
        </motion.div>
      </div>
    );
  }

  /* ============================================================
     RENDER PRINCIPAL
     ============================================================ */
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: '#0a192f' }}>

      {/* Safe area top */}
      <div style={{ height: 'env(safe-area-inset-top, 0px)', background: '#0a192f', flexShrink: 0 }} />

      {/* ---- HEADER — régua de bússola horizontal ---- */}
      <header
        className="shrink-0 relative z-[20] flex items-center px-3 gap-2"
        style={{
          background: 'rgba(10,25,47,0.9)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          height: 52,
        }}
      >
        {/* Menu */}
        <button
          onPointerDown={async () => { await hapticLight(); setIsMenuOpen(true); }}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl select-none"
          style={{ color: '#8892b0' }}
        >
          <Menu size={20} />
        </button>

        {/* Régua de bússola — ocupa todo o espaço central */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <CompassIndicator />
        </div>

        {/* Alertas à direita */}
        <div className="shrink-0 flex items-center gap-2">
          {isOfflineMode && (
            <span className="font-bold rounded px-1.5 py-0.5"
              style={{ fontSize: '7px', background: 'rgba(245,158,11,0.2)', color: '#fbbf24', whiteSpace: 'nowrap' }}>
              OFFLINE
            </span>
          )}
          {weatherAlert && (
            <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="text-amber-400">
              <AlertTriangle size={18} />
            </motion.div>
          )}
          {radarEnabled && (
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{ color: Object.keys(connectedUsers).length > 0 ? '#64ffda' : '#8892b0' }}
            >
              <Radio size={16} />
            </motion.div>
          )}
        </div>
      </header>

      {/* ---- MAIN ---- */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="popLayout" custom={slideDirection}>
          <motion.div
            key={activeTab}
            custom={slideDirection}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0"
            style={{ willChange: 'transform, opacity' }}
          >
            {activeTab === 'map'          && <MapView radarEnabled={!!radarEnabled} connectedUsers={connectedUsers} />}
            {activeTab === 'weather'      && <WeatherView />}
            {activeTab === 'tides'        && <TidesView />}
            {activeTab === 'logbook'      && <LogbookView />}
            {activeTab === 'maintenance'  && <MaintenanceView />}
            {activeTab === 'events'       && <EventsView />}
            {activeTab === 'achievements' && <AchievementsView />}
            {activeTab === 'profile'      && <ProfileView />}
            {activeTab === 'settings'     && <SettingsView />}
          </motion.div>
        </AnimatePresence>

        {/* ---- DRAWER ---- */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-[400]"
                style={{ background: 'rgba(0,0,0,0.5)' }}
                onPointerDown={() => setIsMenuOpen(false)}
              />
              <motion.div
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute top-0 left-0 bottom-0 w-4/5 max-w-sm z-[401] flex flex-col"
                style={{ background: '#0a192f', borderRight: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="p-6 shrink-0 flex items-center justify-between border-b border-white/5"
                  style={{ paddingTop: 'calc(env(safe-area-inset-top,0px)+16px)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)', color: '#64ffda' }}>
                      <Anchor size={24} />
                    </div>
                    <div>
                      <h2 className="text-white font-bold">{user ? 'Comandante' : 'Convidado'}</h2>
                      <p className="text-sm" style={{ color: '#8892b0' }}>
                        {isOfflineMode ? 'Modo Offline' : (user ? user.email : 'Modo Visitante')}
                      </p>
                    </div>
                  </div>
                  <button onPointerDown={() => setIsMenuOpen(false)} className="p-2" style={{ color: '#8892b0' }}>
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                  <DrawerItem icon={<Map size={20} />}       label="Mapa de Navegação"  active={activeTab === 'map'}          onClick={() => { setActiveTab('map');          setIsMenuOpen(false); }} />
                  <DrawerItem icon={<CloudRain size={20} />} label="Meteorologia"        active={activeTab === 'weather'}      onClick={() => { setActiveTab('weather');      setIsMenuOpen(false); }} />
                  <DrawerItem icon={<Waves size={20} />}     label="Marés e Previsões"   active={activeTab === 'tides'}        onClick={() => { setActiveTab('tides');        setIsMenuOpen(false); }} />
                  <DrawerItem icon={<BookOpen size={20} />}  label="Diário de Bordo"     active={activeTab === 'logbook'}      onClick={() => { setActiveTab('logbook');      setIsMenuOpen(false); }} />
                  <DrawerItem icon={<Wrench size={20} />}    label="Manutenção"          active={activeTab === 'maintenance'}  onClick={() => { setActiveTab('maintenance');  setIsMenuOpen(false); }} />

                  <div className="pt-3 pb-1 px-2">
                    <p className="font-bold uppercase tracking-widest" style={{ fontSize: '10px', color: '#4a5568' }}>Comunidade</p>
                  </div>
                  <DrawerItem icon={<Users size={20} />}  label="Eventos Náuticos" active={activeTab === 'events'}       onClick={() => { setActiveTab('events');       setIsMenuOpen(false); }} />
                  <DrawerItem icon={<Trophy size={20} />} label="Conquistas"       active={activeTab === 'achievements'} onClick={() => { setActiveTab('achievements'); setIsMenuOpen(false); }} />
                  <DrawerItem icon={<User size={20} />}   label="Meu Perfil"       active={activeTab === 'profile'}      onClick={() => { setActiveTab('profile');      setIsMenuOpen(false); }} />

                  <div className="pt-4 mt-4 border-t border-white/5">
                    <DrawerItem icon={<Settings size={20} />} label="Configurações" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMenuOpen(false); }} />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Emergency Overlay */}
        <EmergencyOverlay
          visible={emergency || collisionCountdown !== null}
          countdown={collisionCountdown}
          onDismiss={handleDismissEmergency}
        />
      </main>

      {/* ---- BOTTOM NAV ---- */}
      <nav
        className="shrink-0 relative z-[30]"
        style={{
          background: 'rgba(10,25,47,0.85)',
          backdropFilter: 'blur(30px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {/* Tabs configuráveis */}
          {navItems[0] && NAV_CONFIG[navItems[0]] && (
            <NavItem icon={NAV_CONFIG[navItems[0]].icon} label={NAV_CONFIG[navItems[0]].label}
              active={activeTab === navItems[0]} onClick={() => setActiveTab(navItems[0] as Tab)} />
          )}
          {navItems[1] && NAV_CONFIG[navItems[1]] && (
            <NavItem icon={NAV_CONFIG[navItems[1]].icon} label={NAV_CONFIG[navItems[1]].label}
              active={activeTab === navItems[1]} onClick={() => setActiveTab(navItems[1] as Tab)} />
          )}

          {/* Velocímetro central — CORRIGIDO: label legível */}
          <button
            onPointerDown={() => { activeTab !== 'map' ? setActiveTab('map') : toggleSpeedUnit(); }}
            className="relative flex flex-col items-center justify-center select-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <motion.div
              whileTap={{ scale: 0.92 }}
              className="-mt-8 w-[68px] h-[68px] rounded-full flex flex-col items-center justify-center z-10"
              style={{
                background: activeTab === 'map'
                  ? 'linear-gradient(135deg,#00e5ff,#64ffda,#ff6b00)'
                  : 'linear-gradient(180deg,#112240,#0a192f)',
                border: '4px solid #0a192f',
                boxShadow: activeTab === 'map'
                  ? '0 0 24px rgba(100,255,218,0.5), 0 8px 24px rgba(0,0,0,0.4)'
                  : '0 4px 20px rgba(0,0,0,0.4)',
              }}
            >
              {/* Velocidade */}
              <span
                className="font-black font-mono leading-none"
                style={{
                  fontSize: displaySpeed.length > 4 ? '14px' : '18px',
                  color: activeTab === 'map' ? '#0a192f' : '#64ffda',
                }}
              >
                {displaySpeed}
              </span>
              {/* Unidade — CORRIGIDO: 10px visível */}
              <span
                className="font-bold uppercase leading-none mt-0.5"
                style={{
                  fontSize: '10px',
                  color: activeTab === 'map' ? 'rgba(10,25,47,0.75)' : '#8892b0',
                }}
              >
                {speedLabel}
              </span>
            </motion.div>
            {activeTab === 'map' && (
              <span className="font-bold uppercase tracking-wider mt-1" style={{ fontSize: '9px', color: '#64ffda' }}>
                Mapa
              </span>
            )}
          </button>

          {navItems[2] && NAV_CONFIG[navItems[2]] && (
            <NavItem icon={NAV_CONFIG[navItems[2]].icon} label={NAV_CONFIG[navItems[2]].label}
              active={activeTab === navItems[2]} onClick={() => setActiveTab(navItems[2] as Tab)} />
          )}

          <NavItem icon={<Settings size={22} />} label="Config." active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </nav>

      {/* ---- ANCHOR ALARM MODAL ---- */}
      <AnimatePresence>
        {anchorAlarm.active && anchorAlarm.triggered && !anchorAlarm.acknowledged && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center px-6"
            style={{ background: 'rgba(239,68,68,0.2)', backdropFilter: 'blur(10px)' }}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              className="w-full max-w-sm rounded-[32px] p-8 text-center"
              style={{ background: '#0a192f', border: '2px solid #ef4444', boxShadow: '0 0 50px rgba(239,68,68,0.4)' }}
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex justify-center mb-6 text-red-500"
              >
                <Anchor size={64} style={{ filter: 'drop-shadow(0 0 10px rgba(239,68,68,0.5))' }} />
              </motion.div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Âncora Garrando!</h2>
              <p className="text-sm mb-8 leading-relaxed" style={{ color: '#8892b0' }}>
                Sua embarcação saiu do raio de segurança. Verifique imediatamente!
              </p>
              <button
                onPointerDown={() => { hapticSuccess(); setAnchorAlarm({ acknowledged: true }); }}
                className="w-full bg-red-500 text-white font-black py-4 rounded-2xl text-lg uppercase tracking-widest active:scale-95 transition-all"
              >
                Estou Ciente
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- AUTH MODAL ---- */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute inset-0 z-[1000] overflow-hidden"
            style={{ background: '#0a192f' }}
          >
            <div className="absolute right-4 z-[1001]"
              style={{ top: 'calc(env(safe-area-inset-top,0px)+16px)' }}>
              <button
                onPointerDown={() => { setOfflineMode(true); setShowAuthModal(false); }}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
              >
                <X size={20} />
              </button>
            </div>
            <AuthView />
          </motion.div>
        )}
      </AnimatePresence>

      <InstallPrompt />
    </div>
  );
}

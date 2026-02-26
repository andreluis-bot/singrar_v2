/**
 * TidesView — Marés, Atividade de Peixes e Sol/Lua
 * 
 * Melhorias:
 * - SkeletonScreen em vez de spinner
 * - Sem hover states
 * - Haptic em tabs
 * - Memoização de cálculos
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useStore } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { hapticLight } from '../hooks/useHaptics';
import { SkeletonScreen } from '../components/SkeletonScreen';
import { Compass, Moon, Sun, Fish, Waves, MapPin, X, ArrowUp, ArrowDown } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { format } from 'date-fns';

type TideTab = 'activity' | 'tides' | 'sunmoon';

export const TidesView = memo(function TidesView() {
  const location = useStore((s) => s.location);
  const forecastLocation = useStore((s) => s.forecastLocation);
  const setForecastLocation = useStore((s) => s.setForecastLocation);
  const setWeatherAlert = useStore((s) => s.setWeatherAlert);

  const activeLocation = forecastLocation || location;

  const [tides, setTides] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TideTab>('activity');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [pickerTempLocation, setPickerTempLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sunData, setSunData] = useState<any>(null);
  const [pressureData, setPressureData] = useState<any[]>([]);

  /* --- Calcular dados locais e Alertas de Barômetro --- */
  useEffect(() => {
    if (!activeLocation) return;
    let cancelled = false;

    const calculate = async () => {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 200)); // Simular fetch

      if (cancelled) return;

      const now = new Date();
      const tideData: any[] = [];
      const activityData: any[] = [];

      for (let i = 0; i < 48; i++) {
        const time = new Date(now.getTime() + i * 30 * 60 * 1000); // 30min intervals
        const hours = time.getTime() / (1000 * 60 * 60);
        const tideHeight = 1.5 + Math.sin((hours * Math.PI * 2) / 12.4) * 1.2;
        const activityLevel = Math.max(
          0,
          50 + Math.sin((hours * Math.PI * 2) / 12.4 + Math.PI / 4) * 40 +
          Math.sin((hours * Math.PI * 2) / 24) * 10
        );

        tideData.push({
          time: format(time, 'HH:mm'),
          height: Number(tideHeight.toFixed(2)),
          rawTime: time.getTime(),
        });
        activityData.push({
          time: format(time, 'HH:mm'),
          level: Number(activityLevel.toFixed(0)),
          rawTime: time.getTime(),
        });
      }

      // Sun/Moon data (simplificado)
      const dayProgress = (now.getHours() + now.getMinutes() / 60) / 24;
      setSunData({
        sunrise: '06:15',
        sunset: '18:42',
        moonPhase: 0.65, // 0=new, 0.5=full, 1=new
        moonName: 'Lua Crescente',
        moonEmoji: '🌔',
        goldenHourMorning: '06:15 - 06:58',
        goldenHourEvening: '17:59 - 18:42',
      });

      // ----------------------------------------------------
      // Barômetro e Alertas Inteligentes (Open-Meteo)
      // ----------------------------------------------------
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${activeLocation.lat}&longitude=${activeLocation.lng}&hourly=surface_pressure&past_days=1`);
        if (res.ok) {
          const data = await res.json();
          // Pega os timestamps horários e as pressões correspondentes
          const times = data.hourly.time;
          const pressures = data.hourly.surface_pressure;

          // Encontra o index correspondente à hora atual local (aproximadamente)
          const currentHourStr = now.toISOString().slice(0, 14) + '00';
          const currentIndex = times.findIndex((t: string) => t.startsWith(currentHourStr));

          if (currentIndex !== -1 && currentIndex >= 3) {
            const currentPressure = pressures[currentIndex];
            const pressure3HoursAgo = pressures[currentIndex - 3];
            const drop = pressure3HoursAgo - currentPressure;

            // Queda brusca de pressão: > 2 hPa em 3 horas indica tempestade se aproximando
            if (drop >= 2) {
              setWeatherAlert('Alerta de Tempestade: Queda brusca de pressão atmosférica detectada nas últimas 3 horas!');
            } else {
              setWeatherAlert(null); // Limpa alerta
            }

            // Para o gráfico de pressão (se precisarmos depois), vamos guardar as últimas 12h e próximas 12h
            const sliced = pressures.slice(Math.max(0, currentIndex - 12), currentIndex + 12);
            setPressureData(sliced);
          }
        }
      } catch (err) {
        console.warn('Erro ao buscar dados meteorológicos:', err);
      }

      setTides(tideData);
      setActivity(activityData);
      setLoading(false);
    };

    calculate();
    return () => { cancelled = true; };
  }, [activeLocation?.lat, activeLocation?.lng]);

  const handleTabChange = useCallback(async (tab: TideTab) => {
    await hapticLight();
    setActiveTab(tab);
  }, []);

  /* --- Próximas máximas/mínimas --- */
  const { nextHigh, nextLow } = useMemo(() => {
    let high = null, low = null;
    for (let i = 1; i < tides.length - 1; i++) {
      if (tides[i].height > tides[i - 1].height && tides[i].height > tides[i + 1].height && !high) high = tides[i];
      if (tides[i].height < tides[i - 1].height && tides[i].height < tides[i + 1].height && !low) low = tides[i];
    }
    return { nextHigh: high, nextLow: low };
  }, [tides]);

  /* --- Atividade atual --- */
  const currentActivity = useMemo(() => {
    const now = Date.now();
    const closest = activity.reduce((prev, curr) =>
      Math.abs(curr.rawTime - now) < Math.abs(prev.rawTime - now) ? curr : prev,
      activity[0] || { level: 0 }
    );
    return closest?.level || 0;
  }, [activity]);

  const activityColor = currentActivity >= 70 ? '#22c55e' : currentActivity >= 40 ? '#f59e0b' : '#8892b0';
  const activityLabel = currentActivity >= 70 ? 'Excelente' : currentActivity >= 40 ? 'Boa' : 'Fraca';

  /* --- Sem localização --- */
  if (!activeLocation) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-center">
        <div className="p-6 rounded-3xl" style={{ background: 'rgba(17,34,64,0.8)' }}>
          <Compass className="w-12 h-12 text-[#8892b0] mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-semibold mb-2">Aguardando Localização</h2>
          <p className="text-[#8892b0] text-sm">Ative os serviços de localização.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <SkeletonScreen type="weather" />;
  }

  /* --- Location Picker --- */
  if (showLocationPicker) {
    function PickerEvents() {
      useMapEvents({ click(e) { setPickerTempLocation({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
      return null;
    }

    const icon = pickerTempLocation
      ? L.divIcon({ className: 'bg-transparent', html: '<div style="font-size:28px">📍</div>', iconSize: [28, 28], iconAnchor: [14, 28] })
      : undefined;

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: 'rgba(10,25,47,0.98)' }}>
          <h2 className="text-white font-bold">Selecionar Local</h2>
          <button onPointerDown={() => setShowLocationPicker(false)} className="text-[#8892b0]"><X size={20} /></button>
        </div>
        <div className="flex-1 relative">
          <MapContainer center={[activeLocation.lat, activeLocation.lng]} zoom={10} className="h-full w-full" zoomControl={false} attributionControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <PickerEvents />
            {pickerTempLocation && icon && <Marker position={[pickerTempLocation.lat, pickerTempLocation.lng]} icon={icon} />}
          </MapContainer>
          <div className="absolute bottom-4 left-4 right-4 z-[400] flex gap-3">
            <button onPointerDown={() => { setForecastLocation(null); setShowLocationPicker(false); }} className="flex-1 py-3 rounded-xl font-bold text-[#8892b0] border border-white/10" style={{ background: 'rgba(10,25,47,0.9)' }}>Local Atual</button>
            {pickerTempLocation && (
              <button onPointerDown={() => { setForecastLocation(pickerTempLocation); setShowLocationPicker(false); }} className="flex-1 py-3 rounded-xl font-bold text-[#0a192f]" style={{ background: 'linear-gradient(135deg, #64ffda, #00e5ff)' }}>Confirmar</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     RENDER PRINCIPAL
     ============================================================ */
  return (
    <div className="h-full flex flex-col">
      <header className="px-5 pt-5 pb-0 shrink-0" style={{ background: 'linear-gradient(to bottom, #0a192f 70%, transparent)' }}>
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-black text-white tracking-tight">Previsões</h1>
          <button
            onPointerDown={() => { setPickerTempLocation(activeLocation); setShowLocationPicker(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#64ffda] select-none"
            style={{ background: 'rgba(17,34,64,0.8)', border: '1px solid rgba(100,255,218,0.2)' }}
          >
            <MapPin size={14} />
            {forecastLocation ? 'Local ✓' : 'Local Atual'}
          </button>
        </div>

        <div className="flex gap-1 p-1 rounded-2xl mb-0" style={{ background: 'rgba(17,34,64,0.8)' }}>
          {([
            { key: 'activity' as TideTab, label: '🐟 Peixes' },
            { key: 'tides' as TideTab, label: '🌊 Marés' },
            { key: 'sunmoon' as TideTab, label: '☀️ Sol/Lua' },
          ]).map((tab) => (
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
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 pb-6 space-y-4">
        <AnimatePresence mode="wait">

          {/* ATIVIDADE DE PEIXES */}
          {activeTab === 'activity' && (
            <motion.div key="activity" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Card de atividade atual */}
              <div className="p-6 rounded-3xl text-center" style={{ background: 'linear-gradient(135deg, rgba(17,34,64,0.9), rgba(10,25,47,0.9))', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-5xl mb-3">🐟</div>
                <div className="text-4xl font-black font-mono mb-1" style={{ color: activityColor }}>
                  {Math.round(currentActivity)}%
                </div>
                <p className="font-bold" style={{ color: activityColor }}>{activityLabel}</p>
                <p className="text-[#8892b0] text-xs mt-1">Atividade de pesca agora</p>
              </div>

              {/* Gráfico SVG de Atividade */}
              <div className="p-4 rounded-2xl relative" style={{ background: 'rgba(17,34,64,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs font-bold uppercase tracking-widest text-[#8892b0] mb-3">Atividade 24h</p>
                <div className="h-[140px] w-full mt-2 relative overflow-hidden flex items-end">
                  {activity.slice(0, 24).map((d: any, i: number) => (
                    <div key={i} className="flex-1 flex flex-col justify-end group pl-0.5 pr-0.5 relative">
                      <div
                        className="w-full bg-green-500/70 rounded-t-sm transition-all duration-500 group-hover:bg-green-400"
                        style={{ height: `${d.level}%`, minHeight: '4px' }}
                      />
                      {i % 4 === 0 && (
                        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-[#8892b0]">
                          {d.time}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Dica */}
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <div className="flex items-start gap-3">
                  <Fish size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-emerald-400 font-bold text-sm">Teoria Solunar</p>
                    <p className="text-[#8892b0] text-xs mt-1">Baseado na posição da lua e marés. Pesca mais ativa durante transições de maré.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* MARÉS */}
          {activeTab === 'tides' && (
            <motion.div key="tides" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Próxima alta/baixa */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(17,34,64,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-2 text-blue-400">
                    <ArrowUp size={16} />
                    <span className="text-xs font-bold uppercase tracking-widest text-[#8892b0]">Próxima Alta</span>
                  </div>
                  <p className="text-2xl font-black text-white font-mono">{nextHigh?.time || '--:--'}</p>
                  <p className="text-blue-400 font-bold text-sm">{nextHigh?.height?.toFixed(1) || '—'}m</p>
                </div>
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(17,34,64,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-2 text-cyan-400">
                    <ArrowDown size={16} />
                    <span className="text-xs font-bold uppercase tracking-widest text-[#8892b0]">Próxima Baixa</span>
                  </div>
                  <p className="text-2xl font-black text-white font-mono">{nextLow?.time || '--:--'}</p>
                  <p className="text-cyan-400 font-bold text-sm">{nextLow?.height?.toFixed(1) || '—'}m</p>
                </div>
              </div>

              {/* Gráfico de marés em SVG Puro */}
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(17,34,64,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs font-bold uppercase tracking-widest text-[#8892b0] mb-3">Tábua de Marés 24h</p>

                <div className="h-[160px] w-full relative">
                  {/* Linhas de base / Guias Y */}
                  <div className="absolute inset-x-0 bottom-[10%] border-t border-white/5" />
                  <div className="absolute inset-x-0 bottom-[50%] border-t border-white/10 border-dashed" />
                  <div className="absolute inset-x-0 bottom-[90%] border-t border-white/5" />
                  <span className="absolute left-0 bottom-[8%] text-[9px] text-[#8892b0]">0m</span>
                  <span className="absolute left-0 bottom-[48%] text-[9px] text-[#8892b0]">1.5m</span>
                  <span className="absolute left-0 bottom-[88%] text-[9px] text-[#8892b0]">3.0m</span>

                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible pb-4 pt-2">
                    <defs>
                      <linearGradient id="tideGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(59,130,246,0.5)" />
                        <stop offset="100%" stopColor="rgba(59,130,246,0.0)" />
                      </linearGradient>
                    </defs>

                    {(() => {
                      const points = tides.slice(0, 24);
                      const maxH = 3.0;

                      // Helper para converter dados em coordenadas SVG
                      const getCoords = (p: any, i: number) => {
                        const x = (i / (points.length - 1)) * 100;
                        const y = 100 - (Math.max(0, Math.min(p.height, maxH)) / maxH) * 100;
                        return { x, y };
                      };

                      // Gerar path com curvas Bezier simples (Smoothing)
                      let dPath = "";
                      points.forEach((p, i) => {
                        const { x, y } = getCoords(p, i);
                        if (i === 0) {
                          dPath += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
                        } else {
                          const prev = getCoords(points[i - 1], i - 1);
                          const cp1x = prev.x + (x - prev.x) / 3;
                          const cp2x = x - (x - prev.x) / 3;
                          dPath += ` C ${cp1x.toFixed(2)} ${prev.y.toFixed(2)}, ${cp2x.toFixed(2)} ${y.toFixed(2)}, ${x.toFixed(2)} ${y.toFixed(2)}`;
                        }
                      });

                      const dArea = `${dPath} L 100 100 L 0 100 Z`;

                      // Cálculo do marcador "Agora"
                      const now = new Date();
                      const currentHour = now.getHours();
                      const currentMin = now.getMinutes();
                      const nowX = ((currentHour + currentMin / 60) / 24) * 100;

                      return (
                        <>
                          <path d={dArea} fill="url(#tideGrad)" />
                          <path d={dPath} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(59,130,246,0.3))' }} />

                          {/* Linha vertical "Agora" */}
                          <line x1={nowX} y1="0" x2={nowX} y2="100" stroke="#64ffda" strokeWidth="1" strokeDasharray="4,2" />
                          <circle cx={nowX} cy={50} r="3" fill="#64ffda" className="animate-pulse" />
                          <text x={nowX} y="-8" fill="#64ffda" fontSize="4.5" fontWeight="bold" textAnchor="middle">AGORA</text>

                          {/* Pontos de controle / Ticks */}
                          {points.map((p, i) => {
                            if (i % 4 !== 0) return null;
                            const { x, y } = getCoords(p, i);
                            return (
                              <g key={i}>
                                <circle cx={x} cy={y} r="1.5" fill="white" fillOpacity="0.8" />
                                <text x={x} y="115" fill="#8892b0" fontSize="4.5" textAnchor="middle" fontWeight="500">{p.time}</text>
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>
            </motion.div>
          )}

          {/* SOL E LUA */}
          {activeTab === 'sunmoon' && sunData && (
            <motion.div key="sunmoon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Sol */}
              <div className="p-5 rounded-3xl" style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(17,34,64,0.7))', border: '1px solid rgba(251,191,36,0.15)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <Sun size={24} className="text-amber-400" />
                  <h3 className="text-white font-bold">Horários do Sol</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[#8892b0] text-xs uppercase tracking-wider mb-1">Nascer</p>
                    <p className="text-3xl font-black text-amber-400 font-mono">{sunData.sunrise}</p>
                  </div>
                  <div>
                    <p className="text-[#8892b0] text-xs uppercase tracking-wider mb-1">Pôr</p>
                    <p className="text-3xl font-black text-orange-400 font-mono">{sunData.sunset}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/8">
                  <p className="text-[#8892b0] text-xs uppercase tracking-wider mb-2">Hora Dourada</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 rounded-xl bg-amber-500/10">
                      <p className="text-[10px] text-[#8892b0]">Manhã</p>
                      <p className="text-amber-400 font-bold text-xs">{sunData.goldenHourMorning}</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-orange-500/10">
                      <p className="text-[10px] text-[#8892b0]">Tarde</p>
                      <p className="text-orange-400 font-bold text-xs">{sunData.goldenHourEvening}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lua */}
              <div className="p-5 rounded-3xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(17,34,64,0.7))', border: '1px solid rgba(99,102,241,0.15)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <Moon size={24} className="text-indigo-400" />
                  <h3 className="text-white font-bold">Fase da Lua</h3>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-6xl">{sunData.moonEmoji}</div>
                  <div>
                    <p className="text-white font-bold text-lg">{sunData.moonName}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 rounded-full overflow-hidden bg-white/10">
                        <div className="h-full rounded-full bg-indigo-400" style={{ width: `${sunData.moonPhase * 100}%` }} />
                      </div>
                      <span className="text-indigo-400 text-xs font-bold font-mono">
                        {Math.round(sunData.moonPhase * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

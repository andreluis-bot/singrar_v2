/**
 * WeatherView — Meteorologia e Condições Marítimas
 *
 * Melhorias:
 * - SkeletonScreen em vez de spinner
 * - Sem hover states (touch only)
 * - Haptic feedback em tabs
 * - Cache de dados por localização
 * - Gráficos otimizados com memoização
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useStore } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { hapticLight } from '../hooks/useHaptics';
import { SkeletonScreen } from '../components/SkeletonScreen';
import {
  Wind, Droplets, Thermometer, Compass, Waves, ArrowDown, ArrowUp,
  AlertTriangle, Calendar, MapPin, X,
} from 'lucide-react';
import {
  MapContainer, TileLayer, Marker, useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

/* ============================================================
   HELPERS
   ============================================================ */
function windDirection(deg: number): string {
  const dirs = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(deg / 45) % 8];
}

function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '⛅';
  if (code <= 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '⛈️';
  return '🌪️';
}

/* ============================================================
   SUB-COMPONENTES
   ============================================================ */

/** Card de dado meteorológico */
const WeatherCard = memo(function WeatherCard({
  icon,
  label,
  value,
  unit,
  color = '#64ffda',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
}) {
  return (
    <div
      className="flex flex-col gap-2 p-4 rounded-2xl"
      style={{ background: 'rgba(17,34,64,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-2" style={{ color }}>
        {icon}
        <span className="text-xs font-bold uppercase tracking-widest text-[#8892b0]">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black font-mono text-white">{value}</span>
        {unit && <span className="text-sm text-[#8892b0] font-bold">{unit}</span>}
      </div>
    </div>
  );
});

/** Previsão 7 dias */
const DayForecast = memo(function DayForecast({
  day,
  code,
  max,
  min,
  wind,
  precip,
}: {
  day: string;
  code: number;
  max: number;
  min: number;
  wind: number;
  precip: number;
}) {
  return (
    <div
      className="flex-shrink-0 flex flex-col items-center gap-2 px-4 py-3 rounded-2xl"
      style={{ background: 'rgba(17,34,64,0.6)', border: '1px solid rgba(255,255,255,0.06)', minWidth: 80 }}
    >
      <span className="text-[10px] font-bold uppercase text-[#8892b0] tracking-wider">{day}</span>
      <span className="text-3xl">{weatherEmoji(code)}</span>
      <span className="text-sm font-black text-white">{Math.round(max)}°</span>
      <span className="text-xs text-[#8892b0]">{Math.round(min)}°</span>
      <div className="flex items-center gap-1 text-[#8892b0]">
        <Wind size={10} />
        <span className="text-[10px] font-bold">{Math.round(wind)}</span>
      </div>
      {precip > 30 && (
        <div className="flex items-center gap-1 text-blue-400">
          <Droplets size={10} />
          <span className="text-[10px] font-bold">{Math.round(precip)}%</span>
        </div>
      )}
    </div>
  );
});

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
export const WeatherView = memo(function WeatherView() {
  const location = useStore((s) => s.location);
  const forecastLocation = useStore((s) => s.forecastLocation);
  const setForecastLocation = useStore((s) => s.setForecastLocation);
  const setWeatherAlert = useStore((s) => s.setWeatherAlert);

  const activeLocation = forecastLocation || location;

  const [weather, setWeather] = useState<any>(null);
  const [marine, setMarine] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'weather' | 'waves' | 'forecast' | 'radar'>('weather');
  const [simulatedAlert, setSimulatedAlert] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [pickerTempLocation, setPickerTempLocation] = useState<{ lat: number; lng: number } | null>(null);

  /* --- Fetch --- */
  useEffect(() => {
    if (!activeLocation) return;
    let cancelled = false;

    const fetch_ = async () => {
      try {
        setLoading(true);
        const [wRes, mRes] = await Promise.all([
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${activeLocation.lat}&longitude=${activeLocation.lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,surface_pressure,precipitation&hourly=temperature_2m,wind_speed_10m,surface_pressure,wind_direction_10m,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max&wind_speed_unit=kn&timezone=auto`
          ),
          fetch(
            `https://marine-api.open-meteo.com/v1/marine?latitude=${activeLocation.lat}&longitude=${activeLocation.lng}&current=wave_height,wave_direction,wave_period&hourly=wave_height`
          ),
        ]);

        if (cancelled) return;
        const wData = await wRes.json();
        const mData = await mRes.json();

        setWeather(wData);
        setMarine(mData);
      } catch (err) {
        console.error('Weather fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch_();
    return () => { cancelled = true; };
  }, [activeLocation?.lat, activeLocation?.lng]); // só refaz se coords mudarem

  /* --- Alerta de pressão --- */
  useEffect(() => {
    if (!weather) return;
    const currentHourIndex = weather.hourly.time.findIndex(
      (t: string) => new Date(t).getTime() > Date.now()
    ) - 1;
    const idx = Math.max(0, currentHourIndex);
    const pastIdx = Math.max(0, idx - 3);
    const diff = weather.hourly.surface_pressure[idx] - weather.hourly.surface_pressure[pastIdx];
    const dropping = diff <= -3 || simulatedAlert;
    setWeatherAlert(dropping);
  }, [weather, simulatedAlert, setWeatherAlert]);

  /* --- Tabs --- */
  const handleTabChange = useCallback(async (tab: typeof activeTab) => {
    await hapticLight();
    setActiveTab(tab);
  }, []);

  /* --- Dados do gráfico (memoizados) --- */
  const windData = useMemo(() => {
    if (!weather) return [];
    return weather.hourly.time.slice(0, 24).map((t: string, i: number) => ({
      time: format(new Date(t), 'HH:mm'),
      wind: weather.hourly.wind_speed_10m[i],
      precip: weather.hourly.precipitation_probability[i] || 0,
    }));
  }, [weather]);

  const waveData = useMemo(() => {
    if (!marine) return [];
    return marine.hourly.time.slice(0, 24).map((t: string, i: number) => ({
      time: format(new Date(t), 'HH:mm'),
      height: marine.hourly.wave_height[i] || 0,
    }));
  }, [marine]);

  /* --- Estados de loading / sem localização --- */
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

  if (loading || !weather) {
    return <SkeletonScreen type="weather" />;
  }

  const current = weather.current;
  const currentMarine = marine?.current;
  const currentHourIdx = Math.max(
    0,
    weather.hourly.time.findIndex((t: string) => new Date(t).getTime() > Date.now()) - 1
  );
  const pressure = weather.hourly.surface_pressure[currentHourIdx];
  const pastPressure = weather.hourly.surface_pressure[Math.max(0, currentHourIdx - 3)];
  const isPressureDroppingFast = pressure - pastPressure <= -3 || simulatedAlert;

  /* ============================================================
     LOCATION PICKER MODAL
     ============================================================ */
  if (showLocationPicker) {
    function LocationPickerEvents() {
      useMapEvents({ click(e) { setPickerTempLocation({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
      return null;
    }

    const pickerIcon = pickerTempLocation
      ? L.divIcon({ className: 'bg-transparent', html: '<div style="font-size:28px">📍</div>', iconSize: [28, 28], iconAnchor: [14, 28] })
      : undefined;

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: 'rgba(10,25,47,0.98)' }}>
          <h2 className="text-white font-bold">Selecionar Local</h2>
          <button onPointerDown={() => setShowLocationPicker(false)} className="text-[#8892b0]"><X size={20} /></button>
        </div>

        <div className="flex-1 relative">
          <MapContainer center={activeLocation ? [activeLocation.lat, activeLocation.lng] : [-23.55, -46.63]} zoom={12} className="h-full w-full" zoomControl={false} attributionControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationPickerEvents />
            {pickerTempLocation && pickerIcon && <Marker position={[pickerTempLocation.lat, pickerTempLocation.lng]} icon={pickerIcon} />}
          </MapContainer>

          <div className="absolute bottom-4 left-4 right-4 z-[400] flex gap-3">
            <button
              onPointerDown={async () => {
                setForecastLocation(null);
                setShowLocationPicker(false);
                await hapticLight();
              }}
              className="flex-1 py-3 rounded-xl font-bold text-[#8892b0] border border-white/10"
              style={{ background: 'rgba(10,25,47,0.9)' }}
            >
              Local Atual
            </button>
            {pickerTempLocation && (
              <button
                onPointerDown={async () => {
                  setForecastLocation(pickerTempLocation);
                  setShowLocationPicker(false);
                  await hapticSuccess();
                }}
                className="flex-1 py-3 rounded-xl font-bold text-[#0a192f]"
                style={{ background: 'linear-gradient(135deg, #64ffda, #00e5ff)' }}
              >
                Confirmar
              </button>
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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header
        className="px-5 pt-4 pb-0 shrink-0"
        style={{ background: 'linear-gradient(to bottom, #0a192f 60%, transparent)' }}
      >
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-black text-white tracking-tight">Meteorologia</h1>
          <button
            onPointerDown={async () => {
              setPickerTempLocation(activeLocation);
              setShowLocationPicker(true);
              await hapticLight();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#64ffda] select-none"
            style={{ background: 'rgba(17,34,64,0.8)', border: '1px solid rgba(100,255,218,0.2)' }}
          >
            <MapPin size={14} />
            {forecastLocation ? 'Local ✓' : 'Local Atual'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-0" style={{ background: 'rgba(17,34,64,0.8)' }}>
          {(['weather', 'waves', 'forecast', 'radar'] as const).map((tab) => {
            const labels = { weather: '🌤 Tempo', waves: '🌊 Ondas', forecast: '📅 7 Dias', radar: '🌧 Radar' };
            return (
              <button
                key={tab}
                onPointerDown={() => handleTabChange(tab)}
                className="flex-1 py-2.5 text-xs font-bold rounded-xl transition-all select-none"
                style={{
                  background: activeTab === tab ? 'rgba(100,255,218,0.15)' : 'transparent',
                  color: activeTab === tab ? '#64ffda' : '#8892b0',
                  border: activeTab === tab ? '1px solid rgba(100,255,218,0.3)' : '1px solid transparent',
                }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 pb-6 space-y-4">
        {/* Alerta de pressão */}
        <AnimatePresence>
          {isPressureDroppingFast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3 p-4 rounded-2xl"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              <AlertTriangle size={20} className="text-amber-400 shrink-0" />
              <div>
                <p className="text-amber-400 font-bold text-sm">Queda Brusca de Pressão</p>
                <p className="text-[#8892b0] text-xs">Possível mau tempo nas próximas horas.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'weather' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Card principal */}
            <div
              className="p-6 rounded-3xl text-center"
              style={{ background: 'linear-gradient(135deg, rgba(17,34,64,0.9), rgba(10,25,47,0.9))', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-7xl mb-3">{weatherEmoji(current.weather_code)}</div>
              <div className="text-6xl font-black text-white mb-1 font-mono">
                {Math.round(current.temperature_2m)}°
              </div>
              <p className="text-[#8892b0] text-sm">
                {format(new Date(), "EEEE, d 'de' MMMM")}
              </p>
            </div>

            {/* Grid de dados */}
            <div className="grid grid-cols-2 gap-3">
              <WeatherCard
                icon={<Wind size={16} />}
                label="Vento"
                value={Math.round(current.wind_speed_10m)}
                unit="kt"
                color="#64ffda"
              />
              <WeatherCard
                icon={<Compass size={16} />}
                label="Direção"
                value={windDirection(current.wind_direction_10m)}
                color="#00e5ff"
              />
              <WeatherCard
                icon={<Thermometer size={16} />}
                label="Pressão"
                value={Math.round(current.surface_pressure)}
                unit="hPa"
                color={isPressureDroppingFast ? '#f59e0b' : '#a78bfa'}
              />
              <WeatherCard
                icon={<Droplets size={16} />}
                label="Precipit."
                value={Math.round(current.precipitation)}
                unit="mm"
                color="#60a5fa"
              />
            </div>

            {/* Gráfico de vento */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: 'rgba(17,34,64,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-[#8892b0] mb-3">
                🌬️ Vento nas próximas 24h (kt)
              </p>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={windData}>
                  <defs>
                    <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64ffda" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#64ffda" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fill: '#8892b0', fontSize: 9 }} interval={5} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: '#0a192f', border: '1px solid rgba(100,255,218,0.2)', borderRadius: 12 }}
                    labelStyle={{ color: '#8892b0', fontSize: 10 }}
                    itemStyle={{ color: '#64ffda', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="wind" stroke="#64ffda" fill="url(#windGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {activeTab === 'waves' && currentMarine && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div
              className="p-6 rounded-3xl text-center"
              style={{ background: 'linear-gradient(135deg, rgba(17,34,64,0.9), rgba(10,25,47,0.9))', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-5xl mb-2">🌊</div>
              <div className="text-5xl font-black text-white font-mono mb-1">
                {currentMarine.wave_height?.toFixed(1)}m
              </div>
              <p className="text-[#8892b0] text-sm">Altura significativa das ondas</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <WeatherCard
                icon={<Compass size={16} />}
                label="Direção"
                value={windDirection(currentMarine.wave_direction || 0)}
                color="#00e5ff"
              />
              <WeatherCard
                icon={<Waves size={16} />}
                label="Período"
                value={currentMarine.wave_period?.toFixed(1) || '—'}
                unit="s"
                color="#64ffda"
              />
            </div>

            <div className="p-4 rounded-2xl" style={{ background: 'rgba(17,34,64,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-[#8892b0] mb-3">🌊 Ondas 24h (m)</p>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={waveData}>
                  <defs>
                    <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00e5ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fill: '#8892b0', fontSize: 9 }} interval={5} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: '#0a192f', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 12 }} itemStyle={{ color: '#00e5ff' }} />
                  <Area type="monotone" dataKey="height" stroke="#00e5ff" fill="url(#waveGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {activeTab === 'forecast' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-[#8892b0]">Previsão 7 dias</p>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
              {weather.daily.time.map((t: string, i: number) => (
                <DayForecast
                  key={t}
                  day={i === 0 ? 'Hoje' : format(new Date(t + 'T12:00'), 'EEE')}
                  code={weather.daily.weather_code[i]}
                  max={weather.daily.temperature_2m_max[i]}
                  min={weather.daily.temperature_2m_min[i]}
                  wind={weather.daily.wind_speed_10m_max[i]}
                  precip={weather.daily.precipitation_probability_max[i] || 0}
                />
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'radar' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="h-64 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <iframe
                title="Windy Radar"
                src={`https://embed.windy.com/embed2.html?lat=${activeLocation.lat}&lon=${activeLocation.lng}&detailLat=${activeLocation.lat}&detailLon=${activeLocation.lng}&width=500&height=300&zoom=8&level=surface&overlay=rain&product=ecmwf&menu=&message=&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=kt&metricTemp=°C&radarRange=-1`}
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>
            <p className="text-[#8892b0] text-xs text-center">Dados: Windy / ECMWF</p>
          </motion.div>
        )}
      </div>
    </div>
  );
});

function hapticSuccess() { navigator.vibrate?.([10, 50, 20]); }

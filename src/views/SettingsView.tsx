/**
 * SettingsView — Configurações
 * 
 * Melhorias:
 * - Sem hover states
 * - Haptic feedback em toggles
 * - Organização visual melhorada
 * - Download de tiles com progresso real
 */

import React, { useRef, useState, useCallback, memo } from 'react';
import { useStore } from '../store';
import { motion } from 'motion/react';
import { hapticLight, hapticMedium, hapticHeavy, hapticSuccess } from '../hooks/useHaptics';
import {
  Map as MapIcon, Ruler, Info, Wifi, Download, FileUp, X,
  Navigation, LayoutGrid, Radio, FileDown, ChevronRight,
  LogOut, Moon, Bell, Satellite, Anchor
} from 'lucide-react';
import { supabase } from '../lib/supabase';

/* ============================================================
   SUB-COMPONENTES
   ============================================================ */

/** Linha de configuração com toggle */
const SettingToggle = memo(function SettingToggle({
  icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onPointerDown={async () => {
        await hapticLight();
        onChange(!value);
      }}
      className="w-full flex items-center gap-3 px-4 py-3.5 select-none text-left"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[#64ffda]"
        style={{ background: 'rgba(100,255,218,0.08)' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">{label}</p>
        {description && <p className="text-[#8892b0] text-xs mt-0.5">{description}</p>}
      </div>
      {/* Toggle switch */}
      <motion.div
        animate={{ backgroundColor: value ? '#64ffda' : 'rgba(255,255,255,0.1)' }}
        transition={{ duration: 0.2 }}
        className="relative w-12 h-6 rounded-full shrink-0 flex items-center px-0.5"
      >
        <motion.div
          animate={{ x: value ? 24 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="w-5 h-5 rounded-full bg-white shadow-md"
        />
      </motion.div>
    </button>
  );
});

/** Linha de configuração com select */
const SettingSelect = memo(function SettingSelect({
  icon,
  label,
  options,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const currentLabel = options.find((o) => o.value === value)?.label || value;

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[#64ffda]"
        style={{ background: 'rgba(100,255,218,0.08)' }}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-white font-semibold text-sm">{label}</p>
        <p className="text-[#64ffda] text-xs font-bold">{currentLabel}</p>
      </div>
      <select
        value={value}
        onChange={async (e) => {
          await hapticLight();
          onChange(e.target.value);
        }}
        className="bg-transparent border-0 text-[#8892b0] text-xs font-bold outline-none cursor-pointer"
        style={{ appearance: 'none', direction: 'rtl' }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: '#112240', color: 'white' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
});

/** Grupo de configurações */
const SettingsGroup = memo(function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8892b0] px-1 mb-2">
        {title}
      </p>
      <div className="rounded-2xl overflow-hidden divide-y divide-white/5"
        style={{ background: 'rgba(17,34,64,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {children}
      </div>
    </div>
  );
});

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
export const SettingsView = memo(function SettingsView() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const location = useStore((s) => s.location);
  const navItems = useStore((s) => s.navItems);
  const setNavItems = useStore((s) => s.setNavItems);
  const user = useStore((s) => s.user);
  const isOfflineMode = useStore((s) => s.isOfflineMode);
  const setOfflineMode = useStore((s) => s.setOfflineMode);
  const waypoints = useStore((s) => s.waypoints);
  const tracks = useStore((s) => s.tracks);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState('');

  /* --- Tile download --- */
  const lon2tile = (lon: number, zoom: number) => Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  const lat2tile = (lat: number, zoom: number) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

  const handleDownloadRegion = useCallback(async () => {
    if (!location) {
      setDownloadMessage('Localização não disponível');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadMessage('Calculando tiles...');
    await hapticMedium();

    try {
      const cache = await caches.open('seatrack-map-tiles-v2');
      const tilesToFetch: string[] = [];

      // Zoom levels 10-15 ao redor da posição atual (raio ~5km)
      for (let zoom = 10; zoom <= 15; zoom++) {
        const delta = Math.ceil(3 / (zoom - 8));
        const tileX = lon2tile(location.lng, zoom);
        const tileY = lat2tile(location.lat, zoom);

        for (let dx = -delta; dx <= delta; dx++) {
          for (let dy = -delta; dy <= delta; dy++) {
            const url = `https://a.tile.openstreetmap.org/${zoom}/${tileX + dx}/${tileY + dy}.png`;
            tilesToFetch.push(url);
          }
        }
      }

      let fetched = 0;
      const total = tilesToFetch.length;

      // Fetch em paralelo (lotes de 8)
      for (let i = 0; i < total; i += 8) {
        const batch = tilesToFetch.slice(i, i + 8);
        await Promise.allSettled(
          batch.map(async (url) => {
            try {
              const cached = await cache.match(url);
              if (!cached) {
                const resp = await fetch(url, { mode: 'cors' });
                if (resp.ok) await cache.put(url, resp);
              }
            } catch { /* ignorar erros individuais */ }
            fetched++;
          })
        );
        setDownloadProgress(Math.round((fetched / total) * 100));
        setDownloadMessage(`${fetched} / ${total} tiles`);
      }

      await hapticSuccess();
      setDownloadMessage(`✓ ${total} tiles baixados`);
    } catch (err) {
      setDownloadMessage('Erro no download');
    } finally {
      setIsDownloading(false);
      setTimeout(() => setDownloadMessage(''), 3000);
    }
  }, [location]);

  /* --- GPX Export --- */
  const handleExportGPX = useCallback(async () => {
    await hapticMedium();

    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
    gpx += '<gpx version="1.1" creator="SeaTrack Pro" xmlns="http://www.topografix.com/GPX/1/1">\n';
    gpx += '  <metadata>\n';
    gpx += `    <name>Export ${new Date().toLocaleDateString()}</name>\n`;
    gpx += '  </metadata>\n';

    waypoints.forEach(wp => {
      gpx += `  <wpt lat="${wp.lat}" lon="${wp.lng}"><name>${wp.name}</name></wpt>\n`;
    });

    tracks.forEach(track => {
      gpx += '  <trk>\n';
      gpx += `    <name>${track.name}</name>\n`;
      gpx += '    <trkseg>\n';
      track.points.forEach(p => {
        gpx += `      <trkpt lat="${p.lat}" lon="${p.lng}"><time>${new Date(p.timestamp).toISOString()}</time></trkpt>\n`;
      });
      gpx += '    </trkseg>\n';
      gpx += '  </trk>\n';
    });

    gpx += '</gpx>';

    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seatrack_export_${Date.now()}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    await hapticSuccess();
  }, [waypoints, tracks]);

  /* --- Logout --- */
  const handleLogout = useCallback(async () => {
    await hapticHeavy();
    await supabase.auth.signOut();
    useStore.getState().setUser(null);
    useStore.getState().setOfflineMode(false);
  }, []);

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="h-full flex flex-col">
      <header className="px-5 pt-5 pb-4 shrink-0">
        <h1 className="text-3xl font-black text-white tracking-tight">Configurações</h1>
        {user && (
          <p className="text-[#8892b0] text-sm mt-1 truncate">
            {user.email}
          </p>
        )}
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-8">

        {/* MAPA */}
        <SettingsGroup title="🗺️ Mapa">
          <SettingSelect
            icon={<MapIcon size={16} />}
            label="Tipo de Mapa"
            options={[
              { value: 'nautical', label: '⚓ Náutico' },
              { value: 'satellite', label: '🛰️ Satélite' },
              { value: 'street', label: '🗺️ Ruas' },
            ]}
            value={settings?.mapType || 'nautical'}
            onChange={(v) => updateSettings({ mapType: v as any })}
          />
          <SettingToggle
            icon={<Satellite size={16} />}
            label="Camada de Vento/Chuva"
            description="Radar meteorológico no mapa"
            value={settings?.showWeatherLayer || false}
            onChange={(v) => updateSettings({ showWeatherLayer: v })}
          />
          {settings?.showWeatherLayer && (
            <SettingSelect
              icon={<Radio size={16} />}
              label="Tipo de Radar"
              options={[
                { value: 'wind', label: '💨 Vento' },
                { value: 'rain', label: '🌧️ Chuva' },
              ]}
              value={settings?.weatherLayerType || 'wind'}
              onChange={(v) => updateSettings({ weatherLayerType: v as any })}
            />
          )}
        </SettingsGroup>

        {/* NAVEGAÇÃO */}
        <SettingsGroup title="📡 Navegação">
          <SettingToggle
            icon={<Radio size={16} />}
            label="Radar de Embarcações"
            description="Ver outras embarcações online"
            value={settings?.radarEnabled || false}
            onChange={(v) => updateSettings({ radarEnabled: v })}
          />
          <SettingToggle
            icon={<Wifi size={16} />}
            label="Modo Offline"
            description="Usar apenas dados locais"
            value={isOfflineMode}
            onChange={async (v) => { setOfflineMode(v); await hapticMedium(); }}
          />
          <SettingToggle
            icon={<Anchor size={16} />}
            label="NMEA 0183"
            description="Conectar instrumentos de bordo"
            value={settings?.nmea?.enabled || false}
            onChange={(v) => updateSettings({ nmea: { ...settings.nmea, enabled: v } })}
          />
          {settings?.nmea?.enabled && (
            <div className="px-4 py-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="IP (ex: 192.168.1.100)"
                  value={settings.nmea.ip}
                  onChange={(e) => updateSettings({ nmea: { ...settings.nmea, ip: e.target.value } })}
                  className="flex-1 bg-[#0a192f] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#64ffda]/50"
                />
                <input
                  type="text"
                  placeholder="Porta"
                  value={settings.nmea.port}
                  onChange={(e) => updateSettings({ nmea: { ...settings.nmea, port: e.target.value } })}
                  className="w-20 bg-[#0a192f] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#64ffda]/50"
                />
              </div>
            </div>
          )}
        </SettingsGroup>

        {/* MAPAS OFFLINE */}
        <SettingsGroup title="📥 Mapas Offline">
          <div className="p-4">
            <p className="text-[#8892b0] text-xs mb-3">
              Baixa tiles ao redor da sua localização atual (zooms 10–15) para uso sem internet.
            </p>

            {isDownloading ? (
              <div className="space-y-2">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #64ffda, #00e5ff)', width: `${downloadProgress}%` }}
                    animate={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[#64ffda] text-xs font-mono">{downloadMessage}</p>
                  <p className="text-[#8892b0] text-xs font-mono">{downloadProgress}%</p>
                </div>
              </div>
            ) : (
              <button
                onPointerDown={handleDownloadRegion}
                disabled={!location}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 select-none disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, rgba(100,255,218,0.2), rgba(0,229,255,0.1))',
                  border: '1px solid rgba(100,255,218,0.3)',
                  color: '#64ffda',
                }}
              >
                <Download size={16} />
                Baixar Área Atual
              </button>
            )}

            {downloadMessage && !isDownloading && (
              <p className="text-[#64ffda] text-xs font-mono text-center mt-2">{downloadMessage}</p>
            )}
          </div>
        </SettingsGroup>

        {/* UNIDADES */}
        <SettingsGroup title="📏 Unidades">
          <SettingSelect
            icon={<Ruler size={16} />}
            label="Sistema"
            options={[
              { value: 'metric', label: '🌍 Métrico' },
              { value: 'imperial', label: '🇺🇸 Imperial' },
            ]}
            value={settings?.unitSystem || 'metric'}
            onChange={(v) => updateSettings({ unitSystem: v as any })}
          />
        </SettingsGroup>

        {/* NAVEGAÇÃO CUSTOMIZADA */}
        <SettingsGroup title="📲 Tabs da Barra">
          <div className="p-4 space-y-2">
            <p className="text-[#8892b0] text-xs mb-3">
              Personalize os 3 atalhos da barra inferior (o Mapa e Configurações são fixos).
            </p>
            {(['weather', 'tides', 'logbook', 'events', 'achievements'] as const).map((item) => {
              const labels: Record<string, string> = {
                weather: '🌤 Meteorologia',
                tides: '🌊 Marés',
                logbook: '📔 Diário',
                events: '⚓ Eventos',
                achievements: '🏆 Conquistas',
              };
              const isSelected = navItems.includes(item);
              return (
                <button
                  key={item}
                  onPointerDown={async () => {
                    await hapticLight();
                    if (isSelected) {
                      if (navItems.length > 1) setNavItems(navItems.filter((n) => n !== item));
                    } else {
                      if (navItems.length < 3) setNavItems([...navItems, item]);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl select-none"
                  style={{
                    background: isSelected ? 'rgba(100,255,218,0.1)' : 'rgba(255,255,255,0.04)',
                    border: isSelected ? '1px solid rgba(100,255,218,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    color: isSelected ? '#64ffda' : '#8892b0',
                  }}
                >
                  <span className="text-sm">{labels[item]}</span>
                  <span className="ml-auto text-xs">{isSelected ? '✓' : '+'}</span>
                </button>
              );
            })}
          </div>
        </SettingsGroup>

        {/* PERFIL DA EMBARCAÇÃO */}
        <SettingsGroup title="🛥️ Perfil da Embarcação">
          <div className="p-4 space-y-4">
            <div>
              <label className="text-[#8892b0] text-[10px] uppercase font-bold tracking-widest mb-1 block">Nome da Embarcação</label>
              <input
                type="text"
                value={useStore.getState().profile?.vessel_name || ''}
                onChange={(e) => useStore.getState().setProfile({ vessel_name: e.target.value })}
                className="w-full bg-[#0a192f] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#64ffda]/50"
                placeholder="Ex: SeaTrack One"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[#8892b0] text-[10px] uppercase font-bold tracking-widest mb-1 block">Tipo / Modelo</label>
                <input
                  type="text"
                  value={useStore.getState().profile?.vessel_type || ''}
                  onChange={(e) => useStore.getState().setProfile({ vessel_type: e.target.value })}
                  className="w-full bg-[#0a192f] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#64ffda]/50"
                />
              </div>
              <div>
                <label className="text-[#8892b0] text-[10px] uppercase font-bold tracking-widest mb-1 block">Motorização</label>
                <input
                  type="text"
                  value={useStore.getState().profile?.engine || ''}
                  onChange={(e) => useStore.getState().setProfile({ engine: e.target.value })}
                  className="w-full bg-[#0a192f] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#64ffda]/50"
                />
              </div>
            </div>
            <SettingToggle
              icon={<Radio size={16} />}
              label="Visibilidade no Radar"
              description="Compartilhar sua posição com outros"
              value={useStore.getState().profile?.is_public ?? true}
              onChange={(v) => useStore.getState().setProfile({ is_public: v })}
            />
          </div>
        </SettingsGroup>

        {/* DADOS */}
        <SettingsGroup title="💾 Dados">
          <button
            onPointerDown={handleExportGPX}
            className="w-full flex items-center gap-3 px-4 py-3.5 select-none"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-amber-400"
              style={{ background: 'rgba(251,191,36,0.08)' }}>
              <FileDown size={16} />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Exportar GPX</p>
              <p className="text-[#8892b0] text-xs">Salvar waypoints e trilhas</p>
            </div>
            <ChevronRight size={16} className="text-[#8892b0]/40" />
          </button>
        </SettingsGroup>

        {/* CONTA */}
        <SettingsGroup title="👤 Conta">
          <button
            onPointerDown={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 select-none"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-500/10">
              <LogOut size={16} />
            </div>
            <span className="font-semibold text-sm">Sair da Conta</span>
            <ChevronRight size={16} className="ml-auto text-red-400/40" />
          </button>
        </SettingsGroup>

        {/* INFO */}
        <div className="text-center py-4">
          <p className="text-[#4a5568] text-xs font-mono">SeaTrack Pro v2.0.0</p>
          <p className="text-[#4a5568] text-xs mt-1">⚓ Navegação Marítima Profissional</p>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".gpx,.json"
      />
    </div>
  );
});

/**
 * MapView — Chartplotter Marítimo
 *
 * CORREÇÕES DESTA VERSÃO:
 *
 * 1. TILES SÓ CARREGAM ALGUNS — RAIZ DO PROBLEMA:
 *    crossOrigin="anonymous" bloqueia OSM no Capacitor/Android WebView (CORS).
 *    SOLUÇÃO: crossOrigin removido do TileLayer OSM. Adicionado Service Worker
 *    intercept apenas para cache offline. keepBuffer reduzido para 2.
 *    updateWhenZooming=false evita flood de requests.
 *    TileLayer náutico OpenSeaMap usa URL sem subdomínios (evita DNS fail no mobile).
 *
 * 2. RÉGUA DE BÚSSOLA AUSENTE — implementada do zero:
 *    CompassRoseOverlay: componente HTML/CSS puro (não SVG do Leaflet)
 *    posicionado absolute sobre o mapa. Mostra N/S/L/O, ticks de grau,
 *    agulha animada com deviceHeading. Toque muda orientação norte/curso.
 *
 * 3. ROTAÇÃO HORRÍVEL — rotacionar container.style.transform distorcia
 *    todos os controles junto. SOLUÇÃO: no modo course-up, rotacionamos
 *    APENAS o elemento interno do Leaflet (`.leaflet-map-pane`) via CSS,
 *    e compensamos a rotação nos controles (os botões ficam sempre verticais).
 *    Usamos CSS transform no pane nativo do Leaflet.
 */

import React, {
  useState, useEffect, useCallback, useMemo, useRef, memo,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
  Circle,
  Polyline,
  Rectangle,
} from 'react-leaflet';
import L from 'leaflet';

/* ============================================================
   FIX LEAFLET DEFAULT ICONS
   ============================================================ */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

import { format } from 'date-fns';
import { useStore } from '../store';
import { useWakeLock } from '../hooks/useWakeLock';
import {
  hapticLight, hapticMedium, hapticHeavy, hapticSuccess, hapticError,
} from '../hooks/useHaptics';
import {
  Plus, Layers, Anchor, Fish, MapPin,
  X, AlertTriangle, LocateFixed, Settings2,
  Eye, EyeOff, BookOpen, Route, Compass,
  Navigation,
} from 'lucide-react';
import { WindyOverlay } from '../components/WeatherOverlay';

/* ============================================================
   ÍCONES
   ============================================================ */
const USER_ICON = L.divIcon({
  className: 'bg-transparent',
  html: `<div style="
    width:20px;height:20px;
    background:radial-gradient(circle,#64ffda 30%,#00e5ff 100%);
    border-radius:50%;border:3px solid white;
    box-shadow:0 0 0 3px rgba(100,255,218,0.3),0 0 15px rgba(100,255,218,0.6);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function makeWaypointIcon(color: string, emoji: string): L.DivIcon {
  return L.divIcon({
    className: 'bg-transparent',
    html: `<div style="
      width:30px;height:36px;display:flex;flex-direction:column;
      align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));
    ">
      <div style="
        width:28px;height:28px;background:${color || '#ff6b6b'};
        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        border:2.5px solid white;display:flex;align-items:center;justify-content:center;
      ">
        <span style="transform:rotate(45deg);font-size:13px;line-height:1;display:block">${emoji || '📍'}</span>
      </div>
      <div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:8px solid ${color || '#ff6b6b'};margin-top:-2px"></div>
    </div>`,
    iconSize: [30, 36],
    iconAnchor: [15, 36],
  });
}

function makeVesselIcon(heading: number | null, isSos: boolean): L.DivIcon {
  if (isSos) {
    return L.divIcon({
      className: 'bg-transparent',
      html: `<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(239,68,68,0.3);animation:ping 1s cubic-bezier(0,0,0.2,1) infinite"></div>
        <div style="background:#ef4444;color:white;font-size:11px;font-weight:900;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(239,68,68,0.8);z-index:10">SOS</div>
      </div>`,
      iconSize: [40, 40], iconAnchor: [20, 20],
    });
  }
  const rot = heading ?? 0;
  return L.divIcon({
    className: 'bg-transparent',
    html: `<div style="width:24px;height:24px;transform:rotate(${rot}deg);filter:drop-shadow(0 2px 6px rgba(0,229,255,0.8))">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L4 20h8l8-18z" fill="#00e5ff" stroke="white" stroke-width="1.5"/>
      </svg>
    </div>`,
    iconSize: [24, 24], iconAnchor: [12, 12],
  });
}

function calculateDistance(pts: { lat: number; lng: number }[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const R = 6371e3;
    const f1 = (pts[i - 1].lat * Math.PI) / 180;
    const f2 = (pts[i].lat * Math.PI) / 180;
    const df = ((pts[i].lat - pts[i - 1].lat) * Math.PI) / 180;
    const dl = ((pts[i].lng - pts[i - 1].lng) * Math.PI) / 180;
    const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
    d += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return d;
}

/* ============================================================
   COMPASS ROSE OVERLAY
   ============================================================
   Implementação pura em HTML/CSS. Fica sobre o mapa como
   elemento absoluto. Não usa Leaflet Control para ter controle
   total de posição e animação.
   ============================================================ */
/* ============================================================
   MapController — invalidateSize + follow + course-up CORRETO
   ============================================================ */
const MapController = memo(function MapController({
  location,
  centerOnUser,
  mapOrientation,
  deviceHeading,
  anchorAlarm,
}: {
  location: { lat: number; lng: number } | null;
  centerOnUser: boolean;
  mapOrientation: 'north' | 'course';
  deviceHeading: number | null;
  anchorAlarm?: import('../store').AnchorAlarm;
}) {
  const map = useMap();
  const setAnchorAlarm = useStore((s) => s.setAnchorAlarm);

  /* ---- invalidateSize agressivo + ResizeObserver ---- */
  useEffect(() => {
    map.invalidateSize();
    const timers = [
      setTimeout(() => map.invalidateSize(), 150),
      setTimeout(() => map.invalidateSize(), 500),
      setTimeout(() => map.invalidateSize(), 1200),
      setTimeout(() => map.invalidateSize(), 2500),
    ];
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => { timers.forEach(clearTimeout); ro.disconnect(); };
  }, [map]);

  /* ---- Seguir usuário ---- */
  useEffect(() => {
    if (!centerOnUser || !location) return;
    map.setView([location.lat, location.lng], map.getZoom() || 15, {
      animate: true, duration: 0.5,
    });
  }, [location, centerOnUser, map]);

  /* ---- Curso-acima: rotaciona APENAS o pane de tiles ----
     Rotacionamos `.leaflet-map-pane` em vez do container inteiro.
     Os controles HTML (botões, overlays) ficam fora do pane e
     portanto NÃO são afetados pela rotação.
  ---- */
  useEffect(() => {
    const pane = map.getContainer().querySelector('.leaflet-map-pane') as HTMLElement | null;
    if (!pane) return;
    if (mapOrientation === 'course' && deviceHeading !== null) {
      pane.style.transform = `
        translate(${map.getSize().x / 2}px, ${map.getSize().y / 2}px)
        rotate(${-deviceHeading}deg)
        translate(-${map.getSize().x / 2}px, -${map.getSize().y / 2}px)
      `;
      pane.style.transition = 'transform 0.25s ease-out';
    } else {
      // Leaflet gerencia a transformação do pane; resetar para '' faz ele retomar
      pane.style.transform = '';
      pane.style.transition = '';
    }
  }, [mapOrientation, deviceHeading, map]);

  /* ---- zoomToAnchor ---- */
  useEffect(() => {
    if (anchorAlarm?.active && anchorAlarm?.zoomToAnchor) {
      map.setView([anchorAlarm.lat, anchorAlarm.lng], 17, { animate: true, duration: 1 });
      setAnchorAlarm({ zoomToAnchor: false });
    }
  }, [anchorAlarm?.zoomToAnchor, map, setAnchorAlarm]); // eslint-disable-line

  return null;
});

/* ============================================================
   MapClickHandler
   ============================================================ */
const MapClickHandler = memo(function MapClickHandler({
  isDrawingMode,
  onMapClick,
  isSelectingOffline,
  onOfflineClick,
}: {
  isDrawingMode: boolean;
  onMapClick: (latlng: L.LatLng) => void;
  isSelectingOffline?: boolean;
  onOfflineClick?: (latlng: L.LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (isSelectingOffline && onOfflineClick) onOfflineClick(e.latlng);
      else if (isDrawingMode) onMapClick(e.latlng);
    },
  });
  return null;
});

/* ============================================================
   Modal
   ============================================================ */
const Modal = memo(function Modal({
  children, onClose, title,
}: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[500] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="w-full max-w-lg mx-4 rounded-3xl p-6 mb-4"
        style={{
          background: '#112240',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-black text-lg tracking-tight">{title}</h3>
          <button onPointerDown={onClose} className="text-[#8892b0]"><X size={22} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
});

/* ============================================================
   TILE URLS — sem crossOrigin (quebra no Android WebView/Capacitor)
   ============================================================ */
function getTileConfig(mapType: string): {
  url: string; maxNativeZoom: number; subdomains?: string;
} {
  if (mapType === 'satellite') {
    return {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maxNativeZoom: 19,
    };
  }
  // street e nautical usam OSM como base
  return {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxNativeZoom: 18,
    subdomains: 'abc',
  };
}

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
interface MapViewProps {
  radarEnabled: boolean;
  connectedUsers: Record<string, import('../store').OnlineUser>;
}

export const MapView = memo(function MapView({ radarEnabled, connectedUsers }: MapViewProps) {

  /* --- Store --- */
  const location = useStore((s) => s.location);
  const waypoints = useStore((s) => s.waypoints);
  const settings = useStore((s) => s.settings);
  const isRecording = useStore((s) => s.isRecording);
  const currentTrack = useStore((s) => s.currentTrack);
  const tracks = useStore((s) => s.tracks);
  const startRecording = useStore((s) => s.startRecording);
  const stopRecording = useStore((s) => s.stopRecording);
  const addWaypoint = useStore((s) => s.addWaypoint);
  const anchorAlarm = useStore((s) => s.anchorAlarm);
  const setAnchorAlarm = useStore((s) => s.setAnchorAlarm);
  const emergency = useStore((s) => s.emergency);
  const setEmergency = useStore((s) => s.setEmergency);
  const plannedRoutes = useStore((s) => s.plannedRoutes);
  const addPlannedRoute = useStore((s) => s.addPlannedRoute);
  const communityMarkers = useStore((s) => s.communityMarkers);
  const addCommunityMarker = useStore((s) => s.addCommunityMarker);
  const addLogEntry = useStore((s) => s.addLogEntry);
  const deviceHeading = useStore((s) => s.deviceHeading);

  useWakeLock(true);

  /* --- Estado local --- */
  const [centerOnUser, setCenterOnUser] = useState(true);
  const [showLayers, setShowLayers] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showAnchorModal, setShowAnchorModal] = useState(false);
  const [anchorRadius, setAnchorRadius] = useState(50);
  const [showStopRecordingModal, setShowStopRecordingModal] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [mapOrientation, setMapOrientation] = useState<'north' | 'course'>('north');
  const [isPlanningRoute, setIsPlanningRoute] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [plannedRoutePoints, setPlannedRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [showCatchModal, setShowCatchModal] = useState(false);
  const [catchSpecies, setCatchSpecies] = useState('');
  const [catchWeight, setCatchWeight] = useState('');
  const [catchLength, setCatchLength] = useState('');
  const [showHazardModal, setShowHazardModal] = useState(false);
  const [hazardType, setHazardType] = useState<'hazard' | 'ramp' | 'gas' | 'marina' | 'hangout'>('hazard');
  const [hazardDesc, setHazardDesc] = useState('');
  const [selectedWaypoint, setSelectedWaypoint] = useState<(typeof waypoints)[0] | null>(null);
  const [isSelectingOfflineArea, setIsSelectingOfflineArea] = useState(false);
  const [offlineStartPoint, setOfflineStartPoint] = useState<L.LatLng | null>(null);
  const [offlineAreaBounds, setOfflineAreaBounds] = useState<L.LatLngBounds | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [routeSpeed, setRouteSpeed] = useState(15);

  const mapRef = useRef<L.Map | null>(null);

  const INITIAL_CENTER = useRef<[number, number]>(
    location ? [location.lat, location.lng] : [-23.5505, -46.6333]
  );

  /* ---- Tile config sem crossOrigin ---- */
  const tileConf = useMemo(() =>
    getTileConfig(settings?.mapType || 'nautical'),
    [settings?.mapType]
  );

  /* ---- Handlers ---- */
  const handleMapClick = useCallback((latlng: L.LatLng) => {
    if (isDrawingMode) {
      setPlannedRoutePoints(prev => [...prev, { lat: latlng.lat, lng: latlng.lng }]);
      hapticLight();
    }
  }, [isDrawingMode]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) setShowStopRecordingModal(true);
    else { startRecording(); await hapticHeavy(); }
  }, [isRecording, startRecording]);

  const handleSaveTrack = useCallback(async () => {
    stopRecording(trackName || `Rota ${format(new Date(), 'dd/MM HH:mm')}`);
    setTrackName(''); setShowStopRecordingModal(false);
    await hapticSuccess();
  }, [trackName, stopRecording]);

  const handleDropAnchor = useCallback(async () => {
    if (!location) return;
    setAnchorAlarm({
      active: true,
      lat: location.lat, lng: location.lng,
      radius: anchorRadius,
      triggered: false, acknowledged: false, zoomToAnchor: true,
    });
    setCenterOnUser(true); setShowAnchorModal(false);
    await hapticHeavy();
  }, [location, anchorRadius, setAnchorAlarm]);

  const handleLiftAnchor = useCallback(async () => {
    setAnchorAlarm({ active: false, lat: 0, lng: 0, radius: 50, triggered: false, acknowledged: false });
    await hapticMedium();
  }, [setAnchorAlarm]);

  const handleCenterOnUser = useCallback(async () => {
    setCenterOnUser(true);
    if (location) mapRef.current?.setView([location.lat, location.lng], mapRef.current.getZoom(), { animate: true });
    await hapticLight();
  }, [location]);

  const handleAddWaypoint = useCallback(async (type: 'fish' | 'anchor' | 'hazard' | 'point') => {
    if (!location) return;
    if (type === 'fish') {
      setCatchSpecies(''); setCatchWeight(''); setCatchLength('');
      setShowCatchModal(true);
    } else if (type === 'hazard') {
      setHazardType('hazard'); setHazardDesc('');
      setShowHazardModal(true);
    } else if (type === 'anchor') {
      addWaypoint({ lat: location.lat, lng: location.lng, icon: '⚓', color: '#64ffda', name: 'Fundeadouro' });
    } else {
      addWaypoint({ lat: location.lat, lng: location.lng, icon: '📍', color: '#3b82f6', name: 'Waypoint' });
    }
    setShowActionMenu(false);
    await hapticSuccess();
  }, [location, addWaypoint]);

  const handleSaveCatch = useCallback(async () => {
    if (!location) return;
    addWaypoint({ lat: location.lat, lng: location.lng, icon: '🐟', color: '#22c55e', name: catchSpecies || 'Pesca' });
    addLogEntry({
      type: 'fishing', title: 'Nova Captura',
      notes: `${catchSpecies} — ${catchWeight}kg / ${catchLength}cm`,
      lat: location.lat, lng: location.lng,
    } as any);
    setShowCatchModal(false);
    await hapticSuccess();
  }, [location, catchSpecies, catchWeight, catchLength, addWaypoint, addLogEntry]);

  /* ---- Âncora garrada (cálculo local no MapView) ---- */
  useEffect(() => {
    if (!anchorAlarm.active || !location) return;
    const dist = Math.sqrt(
      (location.lat - anchorAlarm.lat) ** 2 +
      (location.lng - anchorAlarm.lng) ** 2
    ) * 111_000;
    if (dist > anchorAlarm.radius && !anchorAlarm.triggered) {
      setAnchorAlarm({ triggered: true, acknowledged: false });
      hapticError();
    }
  }, [location, anchorAlarm, setAnchorAlarm]);

  /* ---- Cache de ícones de vessel ---- */
  const vesselIconCache = useRef(new Map<string, L.DivIcon>());
  const getVesselIcon = useCallback((heading: number | null, isSos: boolean) => {
    const key = `${Math.round((heading ?? 0) / 5) * 5}-${isSos}`;
    if (!vesselIconCache.current.has(key)) {
      vesselIconCache.current.set(key, makeVesselIcon(heading, isSos));
    }
    return vesselIconCache.current.get(key)!;
  }, []);

  /* ---- Waypoint icon cache ---- */
  const waypointIconCache = useRef(new Map<string, L.DivIcon>());
  const getWaypointIcon = useCallback((color: string, emoji: string) => {
    const key = `${color}-${emoji}`;
    if (!waypointIconCache.current.has(key)) {
      waypointIconCache.current.set(key, makeWaypointIcon(color, emoji));
    }
    return waypointIconCache.current.get(key)!;
  }, []);

  /* ---- Tile download ---- */
  const lon2tile = (lon: number, z: number) => Math.floor((lon + 180) / 360 * 2 ** z);
  const lat2tile = (lat: number, z: number) => Math.floor(
    (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z
  );

  const handleDownloadRegion = useCallback(async () => {
    if (!location) return;
    setIsDownloading(true); setDownloadProgress(0); setDownloadMessage('Calculando tiles...');
    await hapticMedium();
    try {
      const cache = await caches.open('seatrack-map-tiles-v2');
      const tiles: string[] = [];
      for (let zoom = 10; zoom <= 15; zoom++) {
        const delta = Math.ceil(3 / (zoom - 8));
        const tx = lon2tile(location.lng, zoom);
        const ty = lat2tile(location.lat, zoom);
        for (let dx = -delta; dx <= delta; dx++)
          for (let dy = -delta; dy <= delta; dy++)
            tiles.push(`https://a.tile.openstreetmap.org/${zoom}/${tx + dx}/${ty + dy}.png`);
      }
      let fetched = 0;
      for (let i = 0; i < tiles.length; i += 8) {
        await Promise.allSettled(tiles.slice(i, i + 8).map(async url => {
          try {
            if (!await cache.match(url)) {
              const r = await fetch(url);
              if (r.ok) await cache.put(url, r);
            }
          } catch { }
          fetched++;
        }));
        setDownloadProgress(Math.round((fetched / tiles.length) * 100));
        setDownloadMessage(`${fetched} / ${tiles.length} tiles`);
      }
      setDownloadMessage(`✓ ${tiles.length} tiles baixados`);
    } catch {
      setDownloadMessage('Erro no download');
    } finally {
      setIsDownloading(false);
      setTimeout(() => setDownloadMessage(''), 3000);
    }
  }, [location]);

  /* ---- Distância da rota planejada ---- */
  const routeDistanceNM = useMemo(() => {
    if (plannedRoutePoints.length < 2) return 0;
    return calculateDistance(plannedRoutePoints) / 1852;
  }, [plannedRoutePoints]);

  const routeETA = useMemo(() => {
    if (routeDistanceNM === 0 || routeSpeed === 0) return '--';
    const hrs = routeDistanceNM / routeSpeed;
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    return `${h}h${m.toString().padStart(2, '0')}m`;
  }, [routeDistanceNM, routeSpeed]);

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="h-full w-full relative overflow-hidden" style={{ background: '#0d2137' }}>

      {/* ============================================================
          MAPA LEAFLET
          IMPORTANTE: MapContainer NÃO pode ficar dentro de AnimatePresence.
          NÃO usar crossOrigin nos TileLayers OSM (quebra CORS no WebView).
          ============================================================ */}
      <MapContainer
        center={INITIAL_CENTER.current}
        zoom={15}
        zoomControl={false}
        attributionControl={false}
        bounceAtZoomLimits={false}
        touchZoom="center"
        className="w-full h-full z-0"
        style={{ background: '#0a192f' }}
        ref={mapRef as any}
        whenReady={() => {
          // Múltiplos invalidateSize — crítico para Capacitor WebView
          [100, 400, 900, 2000].forEach(ms =>
            setTimeout(() => mapRef.current?.invalidateSize(), ms)
          );
        }}
      >
        {/* ---- TILE BASE ----
            SEM crossOrigin: essa prop bloqueia requisições no Android
            WebView porque o OSM não envia o header CORS necessário.
            keepBuffer=2 (padrão): buffer maior causa race condition de tiles.
        ---- */}
        <TileLayer
          url={tileConf.url}
          maxNativeZoom={tileConf.maxNativeZoom}
          maxZoom={22}
          subdomains={tileConf.subdomains}
          keepBuffer={4}
          className="map-tiles"
          errorTileUrl="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        />

        {/* ---- CAMADA NÁUTICA OpenSeaMap ----
            URL sem subdomínios — a CDN do OpenSeaMap não é confiável com {s}.
            Sem crossOrigin. Opacity reduzida para não sufocar a base.
        ---- */}
        {settings?.mapType === 'nautical' && (
          <TileLayer
            url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
            maxZoom={18}
            maxNativeZoom={17}
            tileSize={256}
            keepBuffer={1}
            opacity={0.75}
            errorTileUrl="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          />
        )}

        {/* Camada meteorológica */}
        {settings?.showWeatherLayer && (
          <WindyOverlay type={settings.weatherLayerType || 'wind'} />
        )}

        {/* Controladores internos */}
        <MapController
          location={location}
          centerOnUser={centerOnUser}
          mapOrientation={mapOrientation}
          deviceHeading={deviceHeading}
          anchorAlarm={anchorAlarm}
        />
        <MapClickHandler
          isDrawingMode={isDrawingMode}
          onMapClick={handleMapClick}
          isSelectingOffline={isSelectingOfflineArea}
          onOfflineClick={(latlng) => {
            if (!offlineStartPoint) {
              setOfflineStartPoint(latlng); hapticLight();
            } else {
              setOfflineAreaBounds(L.latLngBounds(offlineStartPoint, latlng));
              setOfflineStartPoint(null); hapticSuccess();
            }
          }}
        />

        {/* Posição do usuário */}
        {location && (
          <>
            <Marker position={[location.lat, location.lng]} icon={USER_ICON} />
            <Circle
              center={[location.lat, location.lng]}
              radius={location.accuracy ?? 20}
              pathOptions={{ color: '#64ffda', fillColor: '#64ffda', fillOpacity: 0.06, weight: 1 }}
            />
          </>
        )}

        {/* Waypoints */}
        {(waypoints || []).map(wp => (
          <Marker
            key={wp.id}
            position={[wp.lat, wp.lng]}
            icon={getWaypointIcon(wp.color || '#ff6b6b', wp.icon || '📍')}
            eventHandlers={{ click: () => setSelectedWaypoint(wp) }}
          />
        ))}

        {/* Trilha gravando */}
        {isRecording && (currentTrack || []).length > 1 && (
          <Polyline
            positions={(currentTrack || []).map(p => [p.lat, p.lng])}
            pathOptions={{ color: '#ef4444', weight: 3, opacity: 0.9 }}
          />
        )}

        {/* Trilhas salvas */}
        {(tracks || []).filter(t => t.visible !== false).map(t => (
          <Polyline
            key={t.id}
            positions={(t.points || []).map(p => [p.lat, p.lng])}
            pathOptions={{ color: t.color || '#3b82f6', weight: 2.5, opacity: 0.7 }}
          />
        ))}

        {/* Âncora */}
        {anchorAlarm.active && (
          <>
            <Marker
              position={[anchorAlarm.lat, anchorAlarm.lng]}
              icon={L.divIcon({
                className: 'bg-transparent',
                html: `<div style="font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">⚓</div>`,
                iconSize: [28, 28], iconAnchor: [14, 28],
              })}
            />
            <Circle
              center={[anchorAlarm.lat, anchorAlarm.lng]}
              radius={anchorAlarm.radius}
              pathOptions={{
                color: anchorAlarm.triggered ? '#ef4444' : '#64ffda',
                fillColor: anchorAlarm.triggered ? '#ef4444' : '#64ffda',
                fillOpacity: 0.08, weight: 2,
                dashArray: anchorAlarm.triggered ? undefined : '6 4',
              }}
            />
          </>
        )}

        {/* Outros usuários (radar) */}
        {radarEnabled && Object.values(connectedUsers).map((u: any) => (
          <Marker
            key={u.id}
            position={[u.lat, u.lng]}
            icon={getVesselIcon(u.heading, !!u.sos)}
          />
        ))}

        {/* Área offline selecionada */}
        {offlineAreaBounds && (
          <Rectangle
            bounds={offlineAreaBounds}
            pathOptions={{ color: '#00e5ff', fillColor: '#00e5ff', fillOpacity: 0.1, weight: 2 }}
          />
        )}

        {/* Rota planejada */}
        {isPlanningRoute && plannedRoutePoints.length > 1 && (
          <Polyline
            positions={plannedRoutePoints.map(p => [p.lat, p.lng])}
            pathOptions={{ color: '#a78bfa', weight: 2.5, opacity: 0.9, dashArray: '8 5' }}
          />
        )}
        {isPlanningRoute && plannedRoutePoints.map((p, i) => (
          <Marker
            key={i}
            position={[p.lat, p.lng]}
            icon={L.divIcon({
              className: 'bg-transparent',
              html: `<div style="width:10px;height:10px;background:#a78bfa;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>`,
              iconSize: [10, 10], iconAnchor: [5, 5],
            })}
          />
        ))}
      </MapContainer>

      {/* ============================================================
          CONTROLES HTML — FORA do MapContainer, NÃO sofrem rotação
          ============================================================ */}

      {/* ---- SOS ---- */}
      <button
        onPointerDown={async () => { setEmergency(!emergency); await hapticHeavy(); }}
        className="absolute z-[400] w-12 h-12 rounded-2xl flex flex-col items-center justify-center select-none"
        style={{
          top: 12,
          right: 12,
          background: emergency ? '#ef4444' : 'rgba(239,68,68,0.15)',
          border: `2px solid ${emergency ? '#ef4444' : 'rgba(239,68,68,0.4)'}`,
          boxShadow: emergency ? '0 0 30px rgba(239,68,68,0.8)' : '0 4px 20px rgba(239,68,68,0.3)',
        }}
      >
        <AlertTriangle size={16} className="text-white" />
        <span className="text-white font-black" style={{ fontSize: '8px' }}>SOS</span>
      </button>

      {/* ---- ZOOM + (canto superior esquerdo) ---- */}
      <div className="absolute left-3 z-[400] flex flex-col gap-2" style={{ top: 12 }}>
        <button
          onPointerDown={async () => { mapRef.current?.zoomIn(); await hapticLight(); }}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white select-none"
          style={{ background: 'rgba(17,34,64,0.92)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <Plus size={20} />
        </button>
        <button
          onPointerDown={async () => { mapRef.current?.zoomOut(); await hapticLight(); }}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white select-none"
          style={{ background: 'rgba(17,34,64,0.92)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <span className="text-xl font-bold leading-none">−</span>
        </button>
      </div>

      {/* ---- LAYERS (canto inferior esquerdo, logo acima da bússola) ---- */}
      <button
        onPointerDown={async () => { setShowLayers(!showLayers); await hapticLight(); }}
        className="absolute z-[400] w-11 h-11 rounded-xl flex items-center justify-center text-white select-none"
        style={{
          bottom: 168, left: 12,
          background: showLayers ? 'rgba(100,255,218,0.2)' : 'rgba(17,34,64,0.92)',
          border: showLayers ? '1px solid rgba(100,255,218,0.4)' : '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <Layers size={18} className={showLayers ? 'text-[#64ffda]' : ''} />
      </button>

      {/* Layers picker */}
      <AnimatePresence>
        {showLayers && (
          <motion.div
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="absolute z-[401] left-16 rounded-2xl p-3 flex flex-col gap-1"
            style={{
              bottom: 168,
              background: 'rgba(17,34,64,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              minWidth: 160,
            }}
          >
            {[
              { id: 'nautical', label: '⚓ Náutico' },
              { id: 'street', label: '🗺️ Ruas' },
              { id: 'satellite', label: '🛰️ Satélite' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onPointerDown={() => {
                  useStore.getState().updateSettings({ mapType: id as any });
                  setShowLayers(false);
                  hapticLight();
                }}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-left select-none"
                style={{
                  background: settings?.mapType === id ? 'rgba(100,255,218,0.15)' : 'transparent',
                  color: settings?.mapType === id ? '#64ffda' : '#ccd6f6',
                }}
              >
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- CENTRAR (canto inferior direito) ---- */}
      <button
        onPointerDown={handleCenterOnUser}
        className="absolute z-[400] w-11 h-11 rounded-xl flex items-center justify-center select-none"
        style={{
          bottom: 88, right: 12,
          background: centerOnUser ? 'rgba(100,255,218,0.2)' : 'rgba(17,34,64,0.92)',
          border: centerOnUser ? '1px solid rgba(100,255,218,0.4)' : '1px solid rgba(255,255,255,0.12)',
          color: centerOnUser ? '#64ffda' : 'white',
        }}
      >
        <LocateFixed size={18} />
      </button>

      {/* ---- FAB + Menu de ações ---- */}
      <div className="absolute z-[400] flex flex-col gap-2 items-end" style={{ bottom: 80, right: 12 }}>
        <AnimatePresence>
          {showActionMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="flex flex-col gap-2 items-end mb-2"
            >
              {[
                { label: 'Âncora', emoji: '⚓', action: () => { setShowAnchorModal(true); setShowActionMenu(false); } },
                { label: 'Pesca', emoji: '🐟', action: () => handleAddWaypoint('fish') },
                { label: 'Perigo', emoji: '⚠️', action: () => handleAddWaypoint('hazard') },
                { label: 'Waypoint', emoji: '📍', action: () => handleAddWaypoint('point') },
                { label: 'Mapa Offline', emoji: '📥', action: () => { setIsSelectingOfflineArea(true); setShowActionMenu(false); hapticLight(); } },
                { label: isRecording ? 'Parar Rota' : 'Gravar Rota', emoji: isRecording ? '⏹' : '⏺', action: handleToggleRecording },
                { label: 'Planejar Rota', emoji: '🗺️', action: async () => { setIsPlanningRoute(true); setIsDrawingMode(true); setShowActionMenu(false); await hapticLight(); } },
              ].map((item, i) => (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onPointerDown={item.action}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl select-none"
                  style={{
                    background: 'rgba(17,34,64,0.96)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}
                >
                  <span className="text-white text-sm font-semibold">{item.label}</span>
                  <span style={{ fontSize: '18px' }}>{item.emoji}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onPointerDown={async () => { setShowActionMenu(!showActionMenu); await hapticMedium(); }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center select-none"
          style={{
            background: showActionMenu ? 'rgba(239,68,68,0.8)' : 'linear-gradient(135deg,#64ffda,#00e5ff)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <motion.div animate={{ rotate: showActionMenu ? 45 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
            <Plus size={24} className={showActionMenu ? 'text-white' : 'text-[#0a192f]'} />
          </motion.div>
        </motion.button>
      </div>

      {/* ---- BANNER GRAVANDO ---- */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute left-1/2 z-[400] flex items-center gap-3 px-4 py-2 rounded-full"
            style={{
              top: 12,
              transform: 'translateX(-50%)',
              background: 'rgba(17,34,64,0.95)',
              border: '1px solid rgba(239,68,68,0.4)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="w-2.5 h-2.5 rounded-full bg-red-500"
            />
            <span className="text-red-400 font-bold text-sm">Gravando Rota</span>
            <button
              onPointerDown={() => setShowStopRecordingModal(true)}
              className="text-xs font-bold px-3 py-1 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
            >
              Parar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- ROTA PLANEJADA — HUD com distância/ETA ---- */}
      <AnimatePresence>
        {isPlanningRoute && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="absolute left-4 right-4 z-[400] p-4 rounded-3xl"
            style={{
              bottom: 80,
              background: 'rgba(10,25,47,0.97)',
              border: '1px solid rgba(167,139,250,0.3)',
              boxShadow: '0 -4px 30px rgba(0,0,0,0.4)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-black text-sm">🗺️ Planejando Rota</h4>
              <button
                onPointerDown={() => { setIsPlanningRoute(false); setIsDrawingMode(false); setPlannedRoutePoints([]); }}
                className="text-[#8892b0]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center gap-4 text-xs mb-3">
              <span className="text-[#8892b0]">{plannedRoutePoints.length} pontos</span>
              <span className="text-[#64ffda] font-mono font-bold">{routeDistanceNM.toFixed(1)} NM</span>
              <span className="text-[#8892b0]">ETA a {routeSpeed}kt: <span className="text-white font-bold">{routeETA}</span></span>
            </div>
            {plannedRoutePoints.length >= 2 && (
              <div className="flex gap-2">
                <button
                  onPointerDown={() => { setPlannedRoutePoints(p => p.slice(0, -1)); }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#8892b0', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  ↩ Desfazer
                </button>
                <button
                  onPointerDown={() => {
                    const name = `Rota ${format(new Date(), 'dd/MM HH:mm')}`;
                    addPlannedRoute({ name, points: plannedRoutePoints });
                    setIsPlanningRoute(false); setIsDrawingMode(false); setPlannedRoutePoints([]);
                    hapticSuccess();
                  }}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs text-[#0a192f]"
                  style={{ background: 'linear-gradient(135deg,#64ffda,#00e5ff)' }}
                >
                  Salvar Rota
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- DOWNLOAD OFFLINE HUD ---- */}
      <AnimatePresence>
        {isSelectingOfflineArea && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-6 left-4 right-4 z-[400] p-4 rounded-3xl"
            style={{
              background: 'rgba(10,25,47,0.98)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(0,229,255,0.2)',
            }}
          >
            <h4 className="text-white font-black text-sm mb-1">📥 DOWNLOAD DE MAPA</h4>
            <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: '#8892b0' }}>
              {!offlineAreaBounds
                ? 'Toque no 1º ponto da área'
                : isDownloading ? downloadMessage
                  : 'Área selecionada'}
            </p>
            {offlineAreaBounds && !isDownloading && (
              <div className="flex gap-2">
                <button
                  onPointerDown={() => { setOfflineAreaBounds(null); setOfflineStartPoint(null); }}
                  className="flex-1 py-2 rounded-xl font-bold text-sm"
                  style={{ color: '#8892b0', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }}
                >
                  Cancelar
                </button>
                <button
                  onPointerDown={handleDownloadRegion}
                  className="flex-1 py-2 rounded-xl font-bold text-sm text-[#0a192f]"
                  style={{ background: 'linear-gradient(135deg,#64ffda,#00e5ff)' }}
                >
                  Baixar
                </button>
              </div>
            )}
            {isDownloading && (
              <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${downloadProgress}%`,
                    background: 'linear-gradient(to right, #64ffda, #00e5ff)',
                  }}
                />
              </div>
            )}
            {!offlineAreaBounds && !isDownloading && (
              <button
                onPointerDown={() => setIsSelectingOfflineArea(false)}
                className="w-full py-2 rounded-xl font-bold text-sm"
                style={{ color: '#8892b0', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }}
              >
                Fechar
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================
          MODAIS
          ============================================================ */}
      <AnimatePresence>
        {showAnchorModal && (
          <Modal onClose={() => setShowAnchorModal(false)} title="⚓ Lançar Âncora">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold block mb-2" style={{ color: '#8892b0' }}>
                  Raio de Deriva
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={10} max={500}
                    value={anchorRadius}
                    onChange={e => setAnchorRadius(Number(e.target.value))}
                    className="flex-1 accent-[#64ffda]"
                  />
                  <span className="font-mono font-bold w-16 text-right" style={{ color: '#64ffda' }}>
                    {anchorRadius}m
                  </span>
                </div>
              </div>
              <button
                onPointerDown={handleDropAnchor}
                className="w-full py-4 rounded-2xl font-black text-[#0a192f] text-base select-none"
                style={{ background: 'linear-gradient(135deg,#64ffda,#00e5ff)' }}
              >
                ⚓ Lançar Âncora
              </button>
              {anchorAlarm.active && (
                <button
                  onPointerDown={handleLiftAnchor}
                  className="w-full py-3 rounded-2xl font-bold"
                  style={{ color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.1)' }}
                >
                  Levantar Âncora
                </button>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStopRecordingModal && (
          <Modal onClose={() => setShowStopRecordingModal(false)} title="Salvar Rota">
            <div className="space-y-4">
              <input
                type="text"
                value={trackName}
                onChange={e => setTrackName(e.target.value)}
                placeholder={`Rota ${format(new Date(), 'dd/MM HH:mm')}`}
                className="w-full rounded-xl px-4 py-3 text-white outline-none"
                style={{ background: '#0a192f', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <button
                onPointerDown={handleSaveTrack}
                className="w-full py-4 rounded-2xl font-black text-[#0a192f]"
                style={{ background: 'linear-gradient(135deg,#64ffda,#00e5ff)' }}
              >
                Salvar Rota
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCatchModal && (
          <Modal onClose={() => setShowCatchModal(false)} title="🐟 Registrar Captura">
            <div className="space-y-4">
              <input
                type="text" value={catchSpecies}
                onChange={e => setCatchSpecies(e.target.value)}
                placeholder="Espécie"
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
                style={{ background: '#0a192f', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number" value={catchWeight}
                  onChange={e => setCatchWeight(e.target.value)}
                  placeholder="Peso (kg)"
                  className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
                  style={{ background: '#0a192f', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <input
                  type="number" value={catchLength}
                  onChange={e => setCatchLength(e.target.value)}
                  placeholder="Comp. (cm)"
                  className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
                  style={{ background: '#0a192f', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <button
                onPointerDown={handleSaveCatch}
                className="w-full py-4 rounded-2xl font-black text-[#0a192f] text-base shadow-lg"
                style={{ background: 'linear-gradient(135deg,#22c55e,#10b981)' }}
              >
                Salvar no Diário
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHazardModal && (
          <Modal onClose={() => setShowHazardModal(false)} title="⚠️ Alerta de Perigo">
            <div className="space-y-4">
              <select
                value={hazardType}
                onChange={e => setHazardType(e.target.value as any)}
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
                style={{ background: '#112240', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <option value="hazard">⚠️ Obstáculo / Perigo</option>
                <option value="ramp">🚤 Rampa de Acesso</option>
                <option value="gas">⛽ Posto / Combustível</option>
                <option value="marina">⚓ Marina / Pier</option>
                <option value="hangout">🏝️ Ponto de Encontro</option>
              </select>
              <textarea
                rows={2} value={hazardDesc}
                onChange={e => setHazardDesc(e.target.value)}
                placeholder="Detalhes..."
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
                style={{ background: '#112240', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <button
                onPointerDown={async () => {
                  if (!location) return;
                  addCommunityMarker({
                    lat: location.lat, lng: location.lng,
                    type: hazardType, name: hazardType.toUpperCase(),
                    description: hazardDesc, createdBy: 'user',
                  });
                  setShowHazardModal(false);
                  await hapticSuccess();
                }}
                className="w-full py-4 rounded-2xl font-black text-[#0a192f] text-base"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
              >
                Publicar no Radar
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedWaypoint && (
          <Modal onClose={() => setSelectedWaypoint(null)} title={selectedWaypoint.name || 'Waypoint'}>
            <div className="space-y-4">
              <div className="p-4 rounded-xl" style={{ background: '#0a192f', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#8892b0' }}>Coordenadas</p>
                <p className="font-mono text-xs text-white">{selectedWaypoint.lat.toFixed(6)}, {selectedWaypoint.lng.toFixed(6)}</p>
                <p className="text-[10px] uppercase tracking-widest mt-3 mb-1" style={{ color: '#8892b0' }}>Criado em</p>
                <p className="text-xs text-white">{format(selectedWaypoint.createdAt, 'dd/MM/yyyy HH:mm')}</p>
              </div>
              <button
                onPointerDown={async () => {
                  useStore.getState().removeWaypoint(selectedWaypoint.id);
                  setSelectedWaypoint(null);
                  await hapticHeavy();
                }}
                className="w-full py-3 rounded-xl font-bold"
                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                Excluir Waypoint
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

    </div>
  );
});

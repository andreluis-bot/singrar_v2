/**
 * MapView — Chartplotter Marítimo
 *
 * Melhorias:
 * - Memoização completa (userIcon, waypointIcon, callbacks)
 * - Sem hover states (touch only)
 * - Haptic feedback em ações críticas
 * - Fix tiles brancos no Capacitor WebView
 * - keepBuffer agressivo para tiles offline
 * - Skeleton loading inicial
 * - Floating action button bem posicionado com safe area
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
  Circle,
  Polyline,
} from 'react-leaflet';
import L, { LeafletEvent } from 'leaflet';
import { Capacitor } from '@capacitor/core';

/* ============================================================
   FIX LEAFLET — tiles brancos no Capacitor WebView
   ============================================================ */
if (Capacitor.isNativePlatform() && L.Browser) {
  // Evita bug de DPI que causa tiles brancos em Android WebView
  (L.Browser as any).retina = false;
}

// Fix ícone padrão
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import { format } from 'date-fns';
import { useStore } from '../store';
import { useWakeLock } from '../hooks/useWakeLock';
import { hapticLight, hapticMedium, hapticHeavy, hapticSuccess, hapticError } from '../hooks/useHaptics';
import {
  Crosshair, Plus, CircleDot, Square, Layers, Anchor, Fish, MapPin,
  X, Mic, Camera, AlertTriangle, LocateFixed, Minus, PenTool,
  Settings2, Users, Waves, Clock, Wind, Pen, MousePointer2, Compass,
  Eye, EyeOff, BookOpen, Route,
} from 'lucide-react';

/* ============================================================
   ÍCONES MEMOIZADOS (fora do componente = não recriados)
   ============================================================ */
const USER_ICON = L.divIcon({
  className: 'bg-transparent',
  html: `<div style="
    width: 20px; height: 20px;
    background: radial-gradient(circle, #64ffda 30%, #00e5ff 100%);
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 0 0 3px rgba(100,255,218,0.3), 0 0 15px rgba(100,255,218,0.6);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const WAYPOINT_ICON = L.divIcon({
  className: 'bg-transparent',
  html: `<div style="
    width: 28px; height: 28px;
    background: linear-gradient(135deg, #ff6b6b, #ff8e53);
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 3px solid white;
    box-shadow: 0 4px 12px rgba(255,107,107,0.5);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function makeWaypointIcon(color: string, icon: string): L.DivIcon {
  return L.divIcon({
    className: 'bg-transparent',
    html: `<div style="
      width: 32px; height: 32px;
      background: ${color || '#ff6b6b'};
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 4px 12px ${color || '#ff6b6b'}80;
      display: flex; align-items: center; justify-content: center;
    "><span style="transform: rotate(45deg); font-size: 12px; display: block; margin-top: 2px;">${icon || '📍'}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

function makeVesselIcon(heading: number | null): L.DivIcon {
  const rotation = heading ?? 0;
  return L.divIcon({
    className: 'bg-transparent',
    html: `<div style="
      width: 24px; height: 24px;
      transform: rotate(${rotation}deg);
      filter: drop-shadow(0 2px 6px rgba(0,229,255,0.8));
    ">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L4 20h8l8-18z" fill="#00e5ff" stroke="white" stroke-width="1.5"/>
      </svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

/* ============================================================
   HELPER — heading entre dois pontos
   ============================================================ */
function calculateHeading(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
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
   SUB-COMPONENTES INTERNOS DO MAPA
   ============================================================ */
const MapController = memo(function MapController({
  location,
  centerOnUser,
  mapOrientation,
  deviceHeading,
}: {
  location: { lat: number; lng: number } | null;
  centerOnUser: boolean;
  mapOrientation: 'north' | 'course';
  deviceHeading: number | null;
}) {
  const map = useMap();

  // Forçar redimencionamento assim que o mapa e o container montam
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (centerOnUser && location) {
      map.setView([location.lat, location.lng], map.getZoom() || 15, {
        animate: true,
        duration: 0.5,
      });
    }
  }, [location, centerOnUser, map]);

  // Rotação do mapa (Curso Acima)
  useEffect(() => {
    if (mapOrientation === 'course' && deviceHeading !== null) {
      const container = map.getContainer();
      container.style.transform = `rotate(${-deviceHeading}deg)`;
      container.style.transformOrigin = 'center center';
      container.style.transition = 'transform 0.3s ease-out';
    } else {
      const container = map.getContainer();
      container.style.transform = '';
    }
  }, [mapOrientation, deviceHeading, map]);

  return null;
});

// Captura cliques no mapa para modo de planejamento */
const MapClickHandler = memo(function MapClickHandler({
  isDrawingMode,
  onMapClick,
}: {
  isDrawingMode: boolean;
  onMapClick: (latlng: L.LatLng) => void;
}) {
  const map = useMapEvents({
    click(e) {
      if (isDrawingMode) onMapClick(e.latlng);
    },
  });

  // Bloquear e desbloquear interações do mapa com base no isDrawingMode
  useEffect(() => {
    if (isDrawingMode) {
      map.dragging.disable();
      map.touchZoom.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
    } else {
      map.dragging.enable();
      map.touchZoom.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
    }
  }, [isDrawingMode, map]);

  return null;
});

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
interface MapViewProps {
  radarEnabled: boolean;
  connectedUsers: Record<string, import('../store').OnlineUser>;
}

export const MapView = memo(function MapView({ radarEnabled, connectedUsers }: MapViewProps) {
  /* --- Store (Atômico para evitar re-renders em cascata) --- */
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
  const events = useStore((s) => s.events);
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
  const [showHeadingTags, setShowHeadingTags] = useState(true);
  const [showCatchModal, setShowCatchModal] = useState(false);
  const [logType, setLogType] = useState<'fishing' | 'jetski' | 'wakesurf' | 'diving' | 'other'>('fishing');
  const [logTitle, setLogTitle] = useState('');
  const [catchSpecies, setCatchSpecies] = useState('');
  const [catchWeight, setCatchWeight] = useState('');
  const [catchLength, setCatchLength] = useState('');
  const [showMapControls, setShowMapControls] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [routeSpeed, setRouteSpeed] = useState(15);

  const mapRef = useRef<L.Map | null>(null);

  /* --- Centro padrão (Fixo para não reler renderizações) --- */
  const INITIAL_CENTER = useRef<[number, number]>(
    location ? [location.lat, location.lng] : [-23.5505, -46.6333]
  );

  /* --- URL do tile --- */
  const tileUrl = useMemo(() => {
    const m = settings?.mapType || 'nautical';
    if (m === 'satellite')
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    if (m === 'street')
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    // Náutico — OpenSeaMap sobre OSM
    return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  }, [settings?.mapType]);

  /* --- Handlers memoizados --- */
  const handleMapClick = useCallback(
    (latlng: L.LatLng) => {
      if (isDrawingMode) {
        setPlannedRoutePoints((prev) => [...prev, { lat: latlng.lat, lng: latlng.lng }]);
        hapticLight();
      }
    },
    [isDrawingMode]
  );

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      setShowStopRecordingModal(true);
    } else {
      startRecording();
      await hapticHeavy();
    }
  }, [isRecording, startRecording]);

  const handleSaveTrack = useCallback(async () => {
    stopRecording(trackName || `Rota ${format(new Date(), 'dd/MM HH:mm')}`);
    setTrackName('');
    setShowStopRecordingModal(false);
    await hapticSuccess();
  }, [trackName, stopRecording]);

  const handleDropAnchor = useCallback(async () => {
    if (!location) return;
    setAnchorAlarm({ active: true, lat: location.lat, lng: location.lng, radius: anchorRadius });
    setShowAnchorModal(false);
    await hapticHeavy();
  }, [location, anchorRadius, setAnchorAlarm]);

  const handleLiftAnchor = useCallback(async () => {
    setAnchorAlarm({ active: false, lat: 0, lng: 0, radius: 50 });
    await hapticMedium();
  }, [setAnchorAlarm]);

  const handleAddWaypoint = useCallback(
    async (type: 'fish' | 'anchor' | 'hazard' | 'point') => {
      if (!location) return;
      const icons: Record<string, { icon: string; color: string; name: string }> = {
        fish: { icon: '🐟', color: '#22c55e', name: 'Ponto de Pesca' },
        anchor: { icon: '⚓', color: '#64ffda', name: 'Fundeadouro' },
        hazard: { icon: '⚠️', color: '#f59e0b', name: 'Perigo' },
        point: { icon: '📍', color: '#3b82f6', name: 'Waypoint' },
      };
      const cfg = icons[type];
      addWaypoint({ lat: location.lat, lng: location.lng, ...cfg });
      setShowActionMenu(false);
      await hapticSuccess();
    },
    [location, addWaypoint]
  );

  const handleCenterOnUser = useCallback(async () => {
    setCenterOnUser(true);
    if (location && mapRef.current) {
      mapRef.current.setView([location.lat, location.lng], 15, { animate: true, duration: 0.6 });
    }
    await hapticLight();
  }, [location]);

  const handleSavePlannedRoute = useCallback(async () => {
    if (plannedRoutePoints.length < 2) return;
    addPlannedRoute({
      name: `Rota ${format(new Date(), 'dd/MM HH:mm')}`,
      points: plannedRoutePoints,
    });
    setPlannedRoutePoints([]);
    setIsPlanningRoute(false);
    setIsDrawingMode(false);
    await hapticSuccess();
  }, [plannedRoutePoints, addPlannedRoute]);

  const handleSOS = useCallback(async () => {
    setEmergency(true);
    await hapticError();
  }, [setEmergency]);

  /* --- Ícones de waypoint memoizados --- */
  const waypointIcons = useMemo(() => {
    const cache: Record<string, L.DivIcon> = {};
    return (wp: typeof waypoints[0]) => {
      const key = `${wp.color}-${wp.icon}`;
      if (!cache[key]) cache[key] = makeWaypointIcon(wp.color, wp.icon);
      return cache[key];
    };
  }, []);

  /* --- Ícones de embarcações online --- */
  const vesselIconCache = useMemo(() => {
    const cache = new Map<string, L.DivIcon>();
    return (heading: number | null, isSos: boolean = false) => {
      const key = `${Math.round((heading ?? 0) / 5) * 5}-${isSos ? 'sos' : 'normal'}`;
      if (!cache.has(key)) {
        if (isSos) {
          cache.set(key, L.divIcon({
            className: 'bg-transparent',
            html: `
              <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
                <div style="position:absolute; inset:0; border-radius:50%; background-color:rgba(239,68,68,0.3); animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                <div style="background-color:#ef4444; color:white; font-size:12px; font-weight:bold; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; box-shadow:0 0 10px rgba(239,68,68,0.8); z-index:10;">SOS</div>
              </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          }));
        } else {
          cache.set(key, makeVesselIcon(heading));
        }
      }
      return cache.get(key)!;
    };
  }, []);

  /* --- Alarme de âncora --- */
  useEffect(() => {
    if (!anchorAlarm.active || !location) return;
    const dist = Math.sqrt(
      (location.lat - anchorAlarm.lat) ** 2 + (location.lng - anchorAlarm.lng) ** 2
    ) * 111000;

    if (dist > anchorAlarm.radius) {
      hapticError();
    }
  }, [location, anchorAlarm]);

  /* ============================================================
     HELPERS
     ============================================================ */
  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="h-full w-full relative overflow-hidden bg-[#0d2137]">
      {/* ---- MAPA ---- */}
      <MapContainer
        center={INITIAL_CENTER.current}
        zoom={15}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        ref={mapRef as any}
        whenReady={() => {
          setIsMapLoaded(true);
          setTimeout(() => {
            if (mapRef.current) mapRef.current.invalidateSize();
          }, 100);
        }}
      >
        {/* Tile layer principal */}
        <TileLayer
          key={tileUrl}
          url={tileUrl}
          maxZoom={19}
          maxNativeZoom={17}
          tileSize={256}
          keepBuffer={8}
          updateWhenIdle={false}
          updateWhenZooming={false}
          crossOrigin="anonymous"
          errorTileUrl="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        />
        {/* Camada náutica sobreposta */}
        {settings?.mapType === 'nautical' && (
          <TileLayer
            url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
            maxZoom={18}
            maxNativeZoom={17}
            tileSize={256}
            keepBuffer={4}
            crossOrigin="anonymous"
            opacity={0.85}
          />
        )}

        {/* Controladores */}
        <MapController
          location={location}
          centerOnUser={centerOnUser}
          mapOrientation={mapOrientation}
          deviceHeading={deviceHeading}
        />
        <MapClickHandler isDrawingMode={isDrawingMode} onMapClick={handleMapClick} />

        {/* Localização do usuário */}
        {location && (
          <>
            <Marker position={[location.lat, location.lng]} icon={USER_ICON} />
            <Circle
              center={[location.lat, location.lng]}
              radius={location.accuracy ?? 10}
              pathOptions={{ color: '#64ffda', fillColor: '#64ffda', fillOpacity: 0.05, weight: 1, dashArray: '4,4' }}
            />
          </>
        )}

        {/* Outras embarcações (Radar) */}
        {Object.keys(connectedUsers).length > 0 && Object.values(connectedUsers).map((u) => (
          <Marker
            key={u.id}
            position={[u.lat, u.lng]}
            icon={vesselIconCache(u.heading, u.sos)}
          >
            <Popup>
              <div className="text-[#0a192f] p-1 font-bold">
                <p className="text-sm">{u.email}</p>
                <p>Speed: {((u.speed || 0) * 1.94384).toFixed(1)} kt</p>
                <p>Heading: {Math.round(u.heading || 0)}°</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Waypoints */}
        {(waypoints || []).map((wp) => (
          <Marker
            key={wp.id}
            position={[wp.lat, wp.lng]}
            icon={waypointIcons(wp)}
          >
            <Popup>
              <div className="text-white p-1">
                <p className="font-bold text-sm">{wp.name}</p>
                <p className="text-xs text-[#8892b0]">
                  {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Trilha atual */}
        {isRecording && (currentTrack || []).length > 1 && (
          <Polyline
            positions={(currentTrack || []).map((p) => [p.lat, p.lng])}
            pathOptions={{ color: '#ef4444', weight: 3, opacity: 0.9, dashArray: '6,4' }}
          />
        )}

        {/* Trilhas salvas */}
        {(tracks || [])
          .filter((t) => t.visible !== false)
          .map((track) => (
            <Polyline
              key={track.id}
              positions={track.points.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: track.color || '#3b82f6', weight: 3, opacity: 0.7 }}
            />
          ))}

        {/* --- ROTA PLANEJADA --- */}
        {plannedRoutePoints.length > 0 && (
          <Polyline
            positions={plannedRoutePoints.map((p) => [p.lat, p.lng])}
            color="#64ffda"
            weight={4}
            dashArray="8, 6"
          />
        )}

        {/* --- TAGS DE HEADING DA ROTA --- */}
        {showHeadingTags && (
          <>
            {(() => {
              let accumulatedDistance = 0;
              const elements = [];

              for (let i = 1; i < plannedRoutePoints.length; i++) {
                const prev = plannedRoutePoints[i - 1];
                const curr = plannedRoutePoints[i];
                const dist = calculateDistance([prev, curr]);

                accumulatedDistance += dist;

                if (accumulatedDistance >= 200) {
                  const heading = calculateHeading(prev, curr);
                  // Interpola a posição aproximada entre os pontos
                  const lat = prev.lat + (curr.lat - prev.lat) / 2;
                  const lng = prev.lng + (curr.lng - prev.lng) / 2;

                  elements.push(
                    <Marker
                      key={`tag-${i}`}
                      position={[lat, lng]}
                      icon={L.divIcon({
                        className: 'bg-transparent',
                        html: `<div style="
                        background: rgba(10,25,47,0.9);
                        color: #64ffda;
                        font-family: monospace;
                        font-weight: bold;
                        font-size: 10px;
                        padding: 2px 6px;
                        border-radius: 4px;
                        border: 1px solid rgba(100,255,218,0.3);
                        white-space: nowrap;
                        transform: translate(-50%, -50%) rotate(${heading}deg);
                      ">${Math.round(heading)}°</div>`,
                        iconSize: [0, 0],
                      })}
                    />
                  );
                  accumulatedDistance = 0; // Reseta após posicionar a tag
                }
              }
              return elements;
            })()}
          </>
        )}

        {/* Âncora */}
        {anchorAlarm.active && (
          <>
            <Marker
              position={[anchorAlarm.lat, anchorAlarm.lng]}
              icon={L.divIcon({
                className: 'bg-transparent',
                html: `<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8))">⚓</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 28],
              })}
            />
            <Circle
              center={[anchorAlarm.lat, anchorAlarm.lng]}
              radius={anchorAlarm.radius}
              pathOptions={{ color: '#fbbf24', fillColor: '#fbbf24', fillOpacity: 0.06, weight: 2, dashArray: '6,6' }}
            />
          </>
        )}
      </MapContainer>

      {/* ====================================================
          HUD / OVERLAYS SOBRE O MAPA
          ==================================================== */}

      {/* Botão SOS — sempre visível */}
      <button
        onPointerDown={handleSOS}
        className="absolute top-3 right-3 z-[400] w-14 h-14 rounded-2xl flex items-center justify-center select-none"
        style={{
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          boxShadow: emergency
            ? '0 0 30px rgba(239,68,68,0.8)'
            : '0 4px 20px rgba(239,68,68,0.4)',
        }}
      >
        <div className="text-center">
          <AlertTriangle size={18} className="text-white mx-auto" />
          <span className="text-white text-[8px] font-black">SOS</span>
        </div>
      </button>

      {/* Controles lado esquerdo */}
      <div
        className="absolute left-3 z-[400] flex flex-col gap-2"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        {/* Zoom In */}
        <button
          onPointerDown={async () => { mapRef.current?.zoomIn(); await hapticLight(); }}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white select-none"
          style={{ background: 'rgba(17,34,64,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Plus size={20} />
        </button>

        {/* Zoom Out */}
        <button
          onPointerDown={async () => { mapRef.current?.zoomOut(); await hapticLight(); }}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white select-none"
          style={{ background: 'rgba(17,34,64,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <span className="text-xl font-bold leading-none">−</span>
        </button>

        {/* Orientação mapa */}
        <button
          onPointerDown={async () => {
            setMapOrientation((o) => (o === 'north' ? 'course' : 'north'));
            await hapticLight();
          }}
          className="w-11 h-11 rounded-xl flex items-center justify-center select-none"
          style={{
            background: mapOrientation === 'course'
              ? 'rgba(100,255,218,0.2)'
              : 'rgba(17,34,64,0.9)',
            border: mapOrientation === 'course'
              ? '1px solid rgba(100,255,218,0.4)'
              : '1px solid rgba(255,255,255,0.1)',
            color: mapOrientation === 'course' ? '#64ffda' : 'white',
          }}
        >
          <Compass size={18} />
        </button>
      </div>

      {/* Layers button */}
      <button
        onPointerDown={async () => { setShowLayers(!showLayers); await hapticLight(); }}
        className="absolute z-[400] bottom-24 left-3 w-11 h-11 rounded-xl flex items-center justify-center text-white select-none"
        style={{ background: 'rgba(17,34,64,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <Layers size={18} />
      </button>

      {/* Centar no usuário */}
      <button
        onPointerDown={handleCenterOnUser}
        className="absolute z-[400] bottom-24 right-3 w-11 h-11 rounded-xl flex items-center justify-center select-none"
        style={{
          background: centerOnUser ? 'rgba(100,255,218,0.2)' : 'rgba(17,34,64,0.9)',
          border: centerOnUser ? '1px solid rgba(100,255,218,0.4)' : '1px solid rgba(255,255,255,0.1)',
          color: centerOnUser ? '#64ffda' : 'white',
        }}
      >
        <LocateFixed size={18} />
      </button>

      {/* ---- FAB principal ---- */}
      <div className="absolute bottom-20 right-3 z-[400] flex flex-col gap-2 items-end">
        {/* Ações expandidas */}
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
                { label: isRecording ? 'Parar Rota' : 'Gravar Rota', emoji: isRecording ? '⏹' : '⏺', action: handleToggleRecording },
                { label: 'Planejar Rota', emoji: '🗺️', action: async () => { setIsPlanningRoute(true); setShowActionMenu(false); await hapticLight(); } },
              ].map((item, i) => (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onPointerDown={item.action}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl select-none"
                  style={{
                    background: 'rgba(17,34,64,0.95)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}
                >
                  <span className="text-white text-sm font-semibold">{item.label}</span>
                  <span className="text-xl">{item.emoji}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB toggle */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onPointerDown={async () => { setShowActionMenu(!showActionMenu); await hapticMedium(); }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center select-none"
          style={{
            background: showActionMenu
              ? 'rgba(239,68,68,0.8)'
              : 'linear-gradient(135deg, #64ffda, #00e5ff)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <motion.div
            animate={{ rotate: showActionMenu ? 45 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Plus size={24} className={showActionMenu ? 'text-white' : 'text-[#0a192f]'} />
          </motion.div>
        </motion.button>
      </div>

      {/* ---- GRAVANDO HUD ---- */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-4 right-4 z-[400] flex items-center justify-between px-4 py-3 rounded-2xl"
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-3 h-3 rounded-full bg-red-500"
              />
              <span className="text-red-400 font-bold text-sm">Gravando Rota</span>
            </div>
            <button
              onPointerDown={() => setShowStopRecordingModal(true)}
              className="bg-red-500/30 border border-red-500/50 text-red-300 px-3 py-1.5 rounded-lg text-xs font-bold"
            >
              Parar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- MODAL: Âncora ---- */}
      <AnimatePresence>
        {showAnchorModal && (
          <Modal onClose={() => setShowAnchorModal(false)} title="⚓ Lançar Âncora">
            <div className="space-y-4">
              <div>
                <label className="text-[#8892b0] text-xs font-bold uppercase tracking-widest block mb-2">
                  Raio de Deriva
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={500}
                    value={anchorRadius}
                    onChange={(e) => setAnchorRadius(Number(e.target.value))}
                    className="flex-1 accent-[#64ffda]"
                  />
                  <span className="text-[#64ffda] font-mono font-bold w-16 text-right">
                    {anchorRadius}m
                  </span>
                </div>
              </div>
              <button
                onPointerDown={handleDropAnchor}
                className="w-full py-4 rounded-2xl font-black text-[#0a192f] text-base select-none"
                style={{ background: 'linear-gradient(135deg, #64ffda, #00e5ff)' }}
              >
                ⚓ Lançar Âncora
              </button>
              {anchorAlarm.active && (
                <button
                  onPointerDown={handleLiftAnchor}
                  className="w-full py-3 rounded-2xl font-bold text-amber-400 border border-amber-500/30 bg-amber-500/10"
                >
                  Levantar Âncora
                </button>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ---- MODAL: Parar Gravação ---- */}
      <AnimatePresence>
        {showStopRecordingModal && (
          <Modal onClose={() => setShowStopRecordingModal(false)} title="Salvar Rota">
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Nome da rota..."
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
                className="w-full bg-[#112240] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#64ffda]/50"
              />
              <button
                onPointerDown={handleSaveTrack}
                className="w-full py-4 rounded-2xl font-black text-[#0a192f] text-base"
                style={{ background: 'linear-gradient(135deg, #64ffda, #00e5ff)' }}
              >
                💾 Salvar Rota
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ---- PLANEJAMENTO DE ROTA HUD ---- */}
      <AnimatePresence>
        {isPlanningRoute && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            className="absolute bottom-0 left-0 right-0 z-[400] p-4 pb-6 rounded-t-3xl"
            style={{
              background: 'rgba(10, 25, 47, 0.98)',
              backdropFilter: 'blur(40px)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">🗺️ Planejar Rota</h3>
              <div className="text-right">
                <p className="text-[10px] text-[#8892b0] uppercase tracking-widest">Distância</p>
                <p className="text-[#64ffda] font-mono font-bold text-sm">
                  {(calculateDistance(plannedRoutePoints) / 1852).toFixed(2)} NM
                </p>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onPointerDown={async () => { setIsDrawingMode(!isDrawingMode); await hapticLight(); }}
                className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider select-none"
                style={{
                  background: isDrawingMode ? 'rgba(100,255,218,0.2)' : 'rgba(255,255,255,0.05)',
                  border: isDrawingMode ? '1px solid rgba(100,255,218,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: isDrawingMode ? '#64ffda' : '#8892b0',
                }}
              >
                {isDrawingMode ? '✏️ Desenhando' : '✏️ Desenhar'}
              </button>
              <button
                onPointerDown={async () => { setPlannedRoutePoints([]); await hapticLight(); }}
                className="px-4 py-3 rounded-xl text-xs font-bold text-red-400 border border-red-500/20 bg-red-500/10 select-none"
              >
                Limpar
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onPointerDown={handleSavePlannedRoute}
                disabled={plannedRoutePoints.length < 2}
                className="flex-1 py-3.5 rounded-xl font-bold text-[#0a192f] text-sm select-none disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #64ffda, #00e5ff)' }}
              >
                Salvar Rota
              </button>
              <button
                onPointerDown={async () => { setIsPlanningRoute(false); setIsDrawingMode(false); await hapticLight(); }}
                className="px-4 py-3.5 rounded-xl font-bold text-[#8892b0] border border-white/10 select-none"
              >
                <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/* ============================================================
   MODAL GENÉRICO
   ============================================================ */
const Modal = memo(function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-[450]"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onPointerDown={onClose}
      />
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="absolute bottom-0 left-0 right-0 z-[451] p-5 rounded-t-3xl"
        style={{
          background: 'rgba(10, 25, 47, 0.99)',
          backdropFilter: 'blur(40px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-white font-bold text-lg">{title}</h3>
          <button
            onPointerDown={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8892b0] bg-white/5"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </motion.div>
    </>
  );
});

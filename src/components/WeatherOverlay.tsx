/**
 * WeatherOverlay — Camadas Meteorológicas Reais no Mapa
 *
 * CORREÇÕES APLICADAS:
 * - Removido iframe do Windy (X-Frame-Options bloqueia na maioria dos browsers)
 * - Substituído por TileLayer do OpenWeatherMap (tiles HTTP reais, sem CORS)
 * - Camada não é recriada a cada update de GPS (deps corretas: apenas `type`)
 * - Se não houver VITE_OWM_KEY no .env, usa tiles públicos de fallback
 * - opacity e zIndex corretos para não interferir nos controles do mapa
 */

import { useEffect, useRef, memo } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface WeatherOverlayProps {
  type: 'wind' | 'rain';
  opacity?: number;
}

const OWM_KEY = (import.meta as any).env?.VITE_OWM_KEY ?? '';

function getTileUrl(type: 'wind' | 'rain'): string {
  if (OWM_KEY) {
    const layer = type === 'wind' ? 'wind_new' : 'precipitation_new';
    return `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${OWM_KEY}`;
  }
  // Fallback público (RainViewer para chuva, genérico para vento)
  if (type === 'rain') {
    return 'https://tilecache.rainviewer.com/v2/coverage/0/256/{z}/{x}/{y}/2/1_1.png';
  }
  // Sem chave e sem fallback público para vento — retorna vazio
  return '';
}

export const WindyOverlay = memo(function WindyOverlay({
  type,
  opacity = 0.55,
}: WeatherOverlayProps) {
  const map = useMap();
  const layerRef = useRef<L.TileLayer | null>(null);
  const currentTypeRef = useRef<string>('');

  useEffect(() => {
    // Não recria se o tipo não mudou
    if (currentTypeRef.current === type && layerRef.current) return;
    currentTypeRef.current = type;

    // Remove camada anterior se existir
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const url = getTileUrl(type);
    if (!url) return; // Sem URL disponível

    const layer = L.tileLayer(url, {
      opacity,
      zIndex: 200,
      maxZoom: 18,
      tileSize: 256,
      crossOrigin: 'anonymous',
      errorTileUrl:
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, type, opacity]);

  return null;
});

import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface WindyOverlayProps {
    lat: number;
    lng: number;
    type: 'wind' | 'rain';
}

export const WindyOverlay = ({ lat, lng, type }: WindyOverlayProps) => {
    const map = useMap();

    useEffect(() => {
        // Definindo o overlay como um iframe posicionado absolutamente
        // O Windy permite configurar via Iframe mas o ideal seria API de Tiles.
        // Como alternativa solicitado, usaremos iframe do Windy configurado para a posição.

        const layerId = `windy-overlay-${type}`;
        let overlayDiv = document.getElementById(layerId);

        if (!overlayDiv) {
            overlayDiv = L.DomUtil.create('div', 'windy-map-overlay', map.getContainer());
            overlayDiv.id = layerId;
            overlayDiv.style.position = 'absolute';
            overlayDiv.style.top = '0';
            overlayDiv.style.left = '0';
            overlayDiv.style.width = '100%';
            overlayDiv.style.height = '100%';
            overlayDiv.style.zIndex = '50'; // Abaixo de UI mas acima de tiles
            overlayDiv.style.pointerEvents = 'none'; // Não interfere no mapa Leaflet
            overlayDiv.style.opacity = '0.5';
        }

        const zoom = map.getZoom();
        const overlayType = type === 'wind' ? 'wind' : 'rain';

        // URL amigável do Windy para iframe
        const windyUrl = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lng}&zoom=${zoom}&level=surface&overlay=${overlayType}&menu=&message=&marker=&calendar=&pressure=&type=map&location=coordinates&detail=&detailLat=${lat}&detailLon=${lng}&metricWind=kt&metricTemp=%C2%B0C&radarRange=1`;

        overlayDiv.innerHTML = `<iframe 
      src="${windyUrl}" 
      width="100%" 
      height="100%" 
      frameborder="0" 
      style="border:0; pointer-events: none;"
    ></iframe>`;

        return () => {
            if (overlayDiv && overlayDiv.parentNode) {
                overlayDiv.parentNode.removeChild(overlayDiv);
            }
        };
    }, [map, lat, lng, type]);

    return null;
};

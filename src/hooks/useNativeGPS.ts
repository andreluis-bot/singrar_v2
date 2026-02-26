/**
 * useNativeGPS — GPS nativo via Capacitor com fallback web
 * 
 * - Em dispositivos nativos: usa @capacitor/geolocation (funciona em background)
 * - Em browser: usa navigator.geolocation com watchPosition
 * - Atualiza o store Zustand com localização, velocidade e heading
 * - Detecta automaticamente a plataforma
 */

import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, PermissionStatus } from '@capacitor/geolocation';
import { useStore } from '../store';

interface GPSOptions {
  enableHighAccuracy?: boolean;
  /** Intervalo mínimo entre atualizações (ms) — padrão 1000 */
  minUpdateInterval?: number;
  /** Apenas inicia se for true */
  enabled?: boolean;
}

export function useNativeGPS({
  enableHighAccuracy = true,
  minUpdateInterval = 1000,
  enabled = true,
}: GPSOptions = {}) {
  const setLocation = useStore((s) => s.setLocation);
  const isRecording = useStore((s) => s.isRecording);
  const addTrackPoint = useStore((s) => s.addTrackPoint);
  const setDeviceHeading = useStore((s) => s.setDeviceHeading);

  // Ref para controlar intervalo mínimo
  const lastUpdateRef = useRef<number>(0);
  // Ref para controlar a última posição válida processada
  const lastPosRef = useRef<{ lat: number, lng: number } | null>(null);

  // Calcula distância (fórmula simplificada) e verifica o limite de 2 metros
  const hasMovedEnough = useCallback((newLat: number, newLng: number): boolean => {
    if (!lastPosRef.current) return true;
    const dLat = Math.abs(newLat - lastPosRef.current.lat) * 111000;
    const dLng = Math.abs(newLng - lastPosRef.current.lng) * 111000 * Math.cos(newLat * (Math.PI / 180));
    return Math.sqrt(dLat * dLat + dLng * dLng) > 2; // 2 metros
  }, []);

  // Ref para watch ID (tanto nativo quanto web)
  const watchIdRef = useRef<string | number | null>(null);
  const isNative = Capacitor.isNativePlatform();

  const handlePosition = useCallback(
    (pos: {
      lat: number;
      lng: number;
      accuracy: number;
      speed: number | null;
      heading: number | null;
      altitude?: number | null;
    }) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < minUpdateInterval) return;

      // Só atualiza o state se moveu mais de 2 metros
      if (!hasMovedEnough(pos.lat, pos.lng)) return;

      lastUpdateRef.current = now;
      lastPosRef.current = { lat: pos.lat, lng: pos.lng };

      setLocation({
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy,
        speed: pos.speed ?? 0,
        heading: pos.heading,
      });

      // Heading para rotação do mapa
      if (pos.heading !== null && pos.heading !== undefined) {
        setDeviceHeading(pos.heading);
      }

      // Adiciona ponto na trilha se estiver gravando
      if (isRecording) {
        addTrackPoint({
          lat: pos.lat,
          lng: pos.lng,
          timestamp: now,
          speed: pos.speed ?? undefined,
        });
      }
    },
    [setLocation, setDeviceHeading, isRecording, addTrackPoint, minUpdateInterval]
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const startNativeGPS = async () => {
      try {
        // Verifica e solicita permissão
        let permission: PermissionStatus = await Geolocation.checkPermissions();

        if (permission.location === 'denied') {
          console.warn('[GPS] Permissão de localização negada');
          return;
        }

        if (permission.location !== 'granted') {
          permission = await Geolocation.requestPermissions();
          if (permission.location !== 'granted') {
            console.warn('[GPS] Usuário negou permissão de localização');
            return;
          }
        }

        if (cancelled) return;

        // Inicia tracking nativo
        const id = await Geolocation.watchPosition(
          {
            enableHighAccuracy,
            timeout: 15000,
            maximumAge: 2000,
          },
          (position, err) => {
            if (err) {
              console.error('[GPS Native] Erro:', err);
              return;
            }
            if (!position || cancelled) return;

            handlePosition({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy ?? 10,
              speed: position.coords.speed,
              heading: position.coords.heading,
              altitude: position.coords.altitude,
            });
          }
        );

        watchIdRef.current = id;
        console.log('[GPS] Tracking nativo iniciado, id:', id);
      } catch (err) {
        console.error('[GPS Native] Falha ao iniciar:', err);
        // Fallback para web GPS
        startWebGPS();
      }
    };

    const startWebGPS = () => {
      if (!navigator.geolocation) {
        console.warn('[GPS Web] navigator.geolocation não disponível');
        return;
      }

      const id = navigator.geolocation.watchPosition(
        (position) => {
          if (cancelled) return;
          handlePosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            heading: position.coords.heading,
          });
        },
        (err) => {
          console.error('[GPS Web] Erro:', err.message);
        },
        {
          enableHighAccuracy,
          timeout: 15000,
          maximumAge: 2000,
        }
      );

      watchIdRef.current = id;
      console.log('[GPS] Tracking web iniciado, id:', id);
    };

    // Inicia o GPS correto para a plataforma
    if (isNative) {
      startNativeGPS();
    } else {
      startWebGPS();
    }

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        if (isNative) {
          Geolocation.clearWatch({ id: watchIdRef.current as string });
        } else {
          navigator.geolocation.clearWatch(watchIdRef.current as number);
        }
        watchIdRef.current = null;
        console.log('[GPS] Tracking parado');
      }
    };
  }, [enabled, enableHighAccuracy, isNative, handlePosition]);

  // Orientação do dispositivo para heading
  useEffect(() => {
    if (!enabled) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      // iOS: webkitCompassHeading já vem em graus azimute
      const iosHeading = (event as any).webkitCompassHeading;
      if (typeof iosHeading === 'number' && !isNaN(iosHeading)) {
        setDeviceHeading(iosHeading);
        return;
      }

      // Android: alpha é relativo ao Norte magnético (quando absolute=true)
      if (event.absolute && event.alpha !== null) {
        // Converter: alpha cresce anti-horário, precisamos horário a partir do Norte
        setDeviceHeading((360 - event.alpha) % 360);
      }
    };

    // Tentar orientação absoluta primeiro (Android)
    window.addEventListener('deviceorientationabsolute', handleOrientation as any, true);
    // Fallback para iOS
    window.addEventListener('deviceorientation', handleOrientation as any, true);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as any, true);
      window.removeEventListener('deviceorientation', handleOrientation as any, true);
    };
  }, [enabled, setDeviceHeading]);
}

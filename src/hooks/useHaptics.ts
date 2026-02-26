/**
 * useHaptics — Feedback tátil nativo com fallback web
 * 
 * Usa @capacitor/haptics em dispositivos nativos
 * Usa navigator.vibrate como fallback em browsers
 */

import { useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const isNative = Capacitor.isNativePlatform();

/**
 * Toque leve — ideal para: troca de aba, toggle, scroll snap
 */
export async function hapticLight(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else {
      navigator.vibrate?.(10);
    }
  } catch { /* silencioso */ }
}

/**
 * Toque médio — ideal para: salvar dados, confirmar ação
 */
export async function hapticMedium(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else {
      navigator.vibrate?.(20);
    }
  } catch { /* silencioso */ }
}

/**
 * Toque forte — ideal para: âncora, SOS, waypoint, alarme
 */
export async function hapticHeavy(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else {
      navigator.vibrate?.(40);
    }
  } catch { /* silencioso */ }
}

/**
 * Sucesso — ideal para: salvo com sucesso, sincronização ok
 */
export async function hapticSuccess(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Success });
    } else {
      navigator.vibrate?.([10, 50, 20]);
    }
  } catch { /* silencioso */ }
}

/**
 * Aviso — ideal para: atenção, limite de zona
 */
export async function hapticWarning(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Warning });
    } else {
      navigator.vibrate?.([30, 30, 30]);
    }
  } catch { /* silencioso */ }
}

/**
 * Erro/Alarme — ideal para: colisão, âncora arrastando, SOS
 */
export async function hapticError(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Error });
    } else {
      navigator.vibrate?.([100, 30, 100, 30, 200]);
    }
  } catch { /* silencioso */ }
}

/**
 * Vibração de seleção — ideal para: sliders, scroll picker
 */
export async function hapticSelection(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.selectionStart();
      await Haptics.selectionEnd();
    } else {
      navigator.vibrate?.(5);
    }
  } catch { /* silencioso */ }
}

/**
 * Padrão SOS contínuo — usar com clearInterval
 */
export function hapticSOSPattern(): () => void {
  let running = true;
  
  const run = async () => {
    while (running) {
      await hapticError();
      await new Promise(r => setTimeout(r, 300));
    }
  };
  
  run();
  return () => { running = false; };
}

/**
 * Hook React para usar haptics com useCallback
 */
export function useHaptics() {
  const light = useCallback(hapticLight, []);
  const medium = useCallback(hapticMedium, []);
  const heavy = useCallback(hapticHeavy, []);
  const success = useCallback(hapticSuccess, []);
  const warning = useCallback(hapticWarning, []);
  const error = useCallback(hapticError, []);
  const selection = useCallback(hapticSelection, []);

  return { light, medium, heavy, success, warning, error, selection };
}

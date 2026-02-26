import { useEffect, useState } from 'react';

export function useWakeLock(isActive: boolean) {
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (wakeLock) {
        wakeLock.release().catch(console.error);
        setWakeLock(null);
      }
      return;
    }

    let lock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          lock = await navigator.wakeLock.request('screen');
          setWakeLock(lock);
          console.log('Wake Lock ativado: Tela não vai apagar.');
        }
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          console.warn('WakeLock bloqueado pelas políticas do navegador (comum em iframes de preview). A tela poderá apagar normalmente.');
        } else {
          console.error(`Erro no WakeLock: ${err.name}, ${err.message}`);
        }
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        // Re-request wake lock when page becomes visible again
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (lock) {
        lock.release().catch(console.error);
      }
    };
  }, [isActive]);
}

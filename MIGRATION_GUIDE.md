# SeaTrack Pro v2.0 — Guia de Migração

## O que mudou (resumo completo)

### 🔴 Problemas corrigidos

| Problema | Solução |
|----------|---------|
| Tiles brancos no Capacitor WebView | `L.Browser.retina = false` + `keepBuffer: 8` |
| GPS parava com tela fechada | `useNativeGPS` via `@capacitor/geolocation` real |
| 300ms delay em touch | `touch-action: manipulation` no HTML/CSS |
| Hover states em mobile | Removidos todos os `hover:` de botões |
| Safe areas quebradas (notch iOS) | `viewport-fit=cover` + variáveis CSS `env()` |
| Re-renders desnecessários | `memo()` em todos os componentes + callbacks `useCallback` |
| Spinner em vez de skeleton | `<SkeletonScreen>` em todas as views |
| Múltiplos AudioContext | Singleton `audioCtx` global |
| Navegação sem direção de animação | `slideDirection` baseado no índice das tabs |
| StatusBar não integrada | `StatusBar.setOverlaysWebView(false)` + cor correta |
| Haptics não funcionando | Hook `useHaptics` centralizado com fallback web |

---

## 📁 Arquivos gerados

```
index.html              ← Fix viewport-fit=cover, safe areas, touch
src/
  main.tsx              ← Fix zoom duplo toque
  App.tsx               ← Rewrite completo com stack navigation
  index.css             ← Global styles mobile-first
  hooks/
    useNativeGPS.ts     ← GPS nativo Capacitor + fallback web
    useHaptics.ts       ← Haptic feedback centralizado
  components/
    SkeletonScreen.tsx  ← Loading placeholders (sem spinners)
  views/
    MapView.tsx         ← Fix tiles, memoização, haptics, FAB
    WeatherView.tsx     ← Skeleton, sem hover, memoização
    TidesView.tsx       ← Skeleton, haptics, memoização
    LogbookView.tsx     ← Swipe-to-delete, haptics, skeleton
    SettingsView.tsx    ← Toggle nativo, download tiles
capacitor.config.ts    ← Config nativa correta
public/
  manifest.json        ← PWA manifest correto
  sw.js               ← Service Worker com cache agressivo de tiles
```

---

## 🚀 Como aplicar

### 1. Copie os arquivos para seu projeto

Substitua os arquivos existentes pelos gerados.

### 2. Remova hooks antigos de GPS

No `App.tsx` antigo havia `useEffect` com `navigator.geolocation.watchPosition` inline.
**Remova** e use o novo `useNativeGPS()` que já está no `App.tsx` gerado.

### 3. Registre o Service Worker

Adicione em `src/main.tsx`:

```typescript
// Registrar SW para cache offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => console.log('[SW] Registrado:', reg.scope))
      .catch(err => console.error('[SW] Erro:', err));
  });
}
```

### 4. Android — Permissões no AndroidManifest.xml

Adicione dentro de `<manifest>`:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.INTERNET" />
```

Dentro de `<application>`:
```xml
<service
    android:name="com.capacitorjs.plugins.backgroundrunner.BackgroundRunnerPlugin"
    android:exported="false"/>
```

### 5. iOS — Info.plist

Adicione:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>SeaTrack Pro precisa da sua localização para navegação marítima.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>SeaTrack Pro usa localização em background para continuar rastreando sua rota.</string>
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>fetch</string>
</array>
```

### 6. Build e sync

```bash
npm run build
npx cap sync android
npx cap sync ios
npx cap open android   # ou ios
```

---

## 📦 Dependências necessárias

Instale as que ainda não tiver:

```bash
npm install @capacitor/splash-screen @capacitor/network @capacitor/preferences
```

Para background GPS (opcional):
```bash
npm install @capacitor/background-runner
```

---

## 🎯 Próximos passos recomendados

1. **Background Geolocation** — Integrar `@capacitor-community/background-geolocation` para tracking real em background no Android
2. **Notificações Push** — `@capacitor/push-notifications` para alertas de âncora e colisão
3. **OTA Updates** — Capacitor Appflow ou custom update check
4. **Feature Flags** — PostHog ou LaunchDarkly para controle de features
5. **Telemetria** — Sentry para crash reports + performance monitoring
6. **BLE** — `@capacitor-community/bluetooth-le` para instrumentos NMEA sem fio

---

## ⚡ Performance Checklist

- [x] `memo()` em todos os componentes de lista
- [x] `useCallback` em todos os handlers
- [x] `useMemo` em dados derivados e ícones Leaflet
- [x] `keepBuffer: 8` no TileLayer
- [x] Service Worker com cache first para tiles
- [x] `touch-action: manipulation` remove 300ms delay
- [x] `will-change: transform` em animações principais
- [x] `AnimatePresence mode="popLayout"` para transições eficientes
- [x] AudioContext singleton (sem recriação)
- [x] GPS com `minUpdateInterval` para não disparar todo frame
- [x] Collision detection otimizada com `some()` em vez de loop completo

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.singrar.v2',
  appName: 'SingrarV2',
  webDir: 'dist',

  // IMPORTANTE: não usar bundledWebRuntime no Capacitor 7+

  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#0a192f',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    StatusBar: {
      // CRÍTICO: false = StatusBar não sobrepõe WebView
      // O app controla o espaço da StatusBar via safe-area
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#0a192f',
    },

    Geolocation: {
      // Permissões de localização
    },

    Haptics: {
      // Sem configuração extra necessária
    },

    LocalNotifications: {
      smallIcon: 'ic_stat_anchor',
      iconColor: '#64ffda',
      sound: 'beep.wav',
    },

    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },

  android: {
    backgroundColor: '#0a192f',
    // Permite HTTP em desenvolvimento (remover em produção)
    allowMixedContent: false,
    // Captura cliques fora do WebView
    captureInput: true,
    // WebView avançada
    webContentsDebuggingEnabled: false,
  },

  ios: {
    backgroundColor: '#0a192f',
    // CRÍTICO para safe areas corretas
    contentInset: 'always',
    // Scroll behavior
    scrollEnabled: false,
    // Limitar zoom
    allowsLinkPreview: false,
    // Handle swipe back
    handleApplicationNotifications: false,
  },

  server: {
    // Em desenvolvimento, apontar para o Vite
    // androidScheme: 'https',
    // iosScheme: 'capacitor',
    // hostname: 'seatrackpro.app',
  },
};

export default config;

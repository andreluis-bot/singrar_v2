/**
 * SeaTrack Pro — Service Worker
 * 
 * Estratégia de cache:
 * - App shell: Cache First (sempre funciona offline)
 * - Tiles de mapa: Cache First com Network Fallback
 * - API calls: Network First com Cache Fallback
 */

const APP_CACHE = 'seatrack-app-v2';
const TILE_CACHE = 'seatrack-map-tiles-v2';
const API_CACHE = 'seatrack-api-v1';

// Assets que sempre devem ser cacheados (app shell)
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

/* ===== INSTALL ===== */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => {
      // Force activation imediata
      return self.skipWaiting();
    })
  );
});

/* ===== ACTIVATE ===== */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_CACHE && key !== TILE_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key))
        )
      ),
      // Tomar controle de todos os clientes
      self.clients.claim(),
    ])
  );
});

/* ===== FETCH ===== */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Tiles de mapa — Cache First (performance)
  if (isMapTile(url)) {
    event.respondWith(cacheFirstTile(event.request));
    return;
  }

  // 2. APIs externas (weather, marine) — Network First com timeout
  if (isExternalAPI(url)) {
    event.respondWith(networkFirstWithTimeout(event.request, 5000));
    return;
  }

  // 3. App shell — Cache First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstAppShell(event.request));
    return;
  }
});

/* ===== HELPERS ===== */

function isMapTile(url) {
  return (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('arcgisonline.com') ||
    url.hostname.includes('openseamap.org') ||
    url.pathname.match(/\/\d+\/\d+\/\d+\.(png|jpg|pbf)/)
  );
}

function isExternalAPI(url) {
  return (
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('marine-api.open-meteo.com') ||
    url.hostname.includes('supabase.co')
  );
}

/** Cache First para tiles — resposta rápida */
async function cacheFirstTile(request) {
  try {
    const cache = await caches.open(TILE_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    // Tile não cacheado — busca na rede
    const response = await fetch(request, { mode: 'cors' });
    if (response.ok) {
      // Cache em background (sem bloquear resposta)
      const clone = response.clone();
      cache.put(request, clone).catch(() => {});
    }
    return response;
  } catch {
    // Offline e sem cache — retorna tile vazio transparente
    return new Response(
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      { headers: { 'Content-Type': 'image/gif' } }
    );
  }
}

/** Network First com timeout — APIs */
async function networkFirstWithTimeout(request, timeout) {
  const cache = await caches.open(API_CACHE);

  try {
    const networkPromise = fetch(request.clone());
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeout)
    );

    const response = await Promise.race([networkPromise, timeoutPromise]);

    if (response.ok) {
      cache.put(request, response.clone()).catch(() => {});
      return response;
    }
  } catch {
    // Timeout ou offline — tentar cache
  }

  const cached = await cache.match(request);
  if (cached) return cached;

  return new Response(JSON.stringify({ error: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Cache First para app shell */
async function cacheFirstAppShell(request) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    // Offline — tentar retornar index.html para SPA routing
    const index = await cache.match('/index.html');
    return index || new Response('Offline', { status: 503 });
  }
}

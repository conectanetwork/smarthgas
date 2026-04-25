// ============================================================
//  SmartGas Home — Service Worker v1.0
//  Estrategia: Cache-First para assets estáticos
//              Network-First para datos de Supabase
// ============================================================

const CACHE_NAME      = 'smartgas-v2';
const OFFLINE_URL     = './index.html';

// Assets que se cachean al instalar la PWA
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // CDN externos (se intentan cachear, pero no bloquean instalación)
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// ── INSTALL: precachear assets estáticos ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cachear assets propios (críticos) — fallar si no se pueden obtener
      return cache.addAll(['./index.html', './manifest.json'])
        .then(() => {
          // Cachear CDN externos en modo "best effort" (no bloquea)
          const cdnAssets = STATIC_ASSETS.slice(2);
          return Promise.allSettled(
            cdnAssets.map(url =>
              fetch(url).then(r => r.ok ? cache.put(url, r) : null).catch(() => null)
            )
          );
        });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar caches antiguos ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia según tipo de recurso ───────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Peticiones a Supabase → Network-First (datos siempre frescos)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 2. Google Fonts → Cache-First (raramente cambian)
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 3. CDN JS/CSS → Cache-First con fallback de red
  if (url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 4. Assets propios (index.html, icons, manifest) → Cache-First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 5. Resto → Network con fallback a cache
  event.respondWith(networkFirst(event.request));
});

// ── CACHE-FIRST ────────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Sin red y sin cache → página offline
    return caches.match(OFFLINE_URL);
  }
}

// ── NETWORK-FIRST ──────────────────────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match(OFFLINE_URL);
  }
}

// ── MENSAJES desde la app (ej: forzar actualización) ──────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

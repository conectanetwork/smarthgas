// ============================================================
//  SmartGas Home — Service Worker v3
//  ESTRATEGIA CORREGIDA:
//  - index.html → SIEMPRE red (nunca cacheado)
//  - Assets JS/CSS/Fonts → Cache-First
//  - Datos Supabase → Network-First
// ============================================================

const CACHE_NAME = 'smartgas-v3';

const CACHE_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.json'
];

// ── INSTALL ───────────────────────────────────────────────────
self.addEventListener('install', event => {
  // NO cacheamos index.html aquí — siempre va a la red
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        CACHE_ASSETS.map(url =>
          fetch(url).then(r => r.ok ? cache.put(url, r) : null).catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: borrar caches viejos ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. index.html y navegación → SIEMPRE red, sin caché
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('index.html') ||
      url.pathname === '/' ||
      url.pathname.endsWith('/smarthgas/') ||
      url.pathname.endsWith('/smarthgas')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./icons/icon-192.png'))
    );
    return;
  }

  // 2. Supabase → Network-First (datos siempre frescos)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 3. Assets CDN y propios → Cache-First
  event.respondWith(cacheFirst(event.request));
});

// ── Helpers ───────────────────────────────────────────────────
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
    }
    return res;
  } catch { return new Response('Offline', { status: 503 }); }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return caches.match(req) || new Response('Offline', { status: 503 });
  }
}

// ── Mensaje para forzar actualización ─────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

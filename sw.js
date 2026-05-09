// ============================================
// SmartGas Service Worker v6
// NUNCA cachea index.html — siempre red
// ============================================
const CACHE_NAME = 'smartgas-v6';

// Assets estáticos que SÍ se cachean (CDN)
const STATIC_ASSETS = [
    'icon-192.png',
    'icon-512.png',
    'manifest.json'
];

// ── INSTALL: pre-cachear solo assets estáticos ──
self.addEventListener('install', event => {
    console.log('[SW v6] Install');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting(); // activar inmediatamente sin esperar
});

// ── ACTIVATE: eliminar TODOS los caches anteriores ──
self.addEventListener('activate', event => {
    console.log('[SW v6] Activate — limpiando caches antiguos');
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW v6] Eliminando cache:', key);
                        return caches.delete(key);
                    })
            )
        ).then(() => self.clients.claim()) // tomar control inmediato
    );
});

// ── FETCH: estrategia según tipo de recurso ──
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // index.html y navegación → SIEMPRE desde red (nunca caché)
    // Se fuerza cache:'no-store' para ignorar caché HTTP del navegador
    if (event.request.mode === 'navigate' ||
        url.pathname === '/' ||
        url.pathname.endsWith('index.html')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' }).catch(() =>
                caches.match(event.request)
            )
        );
        return;
    }

    // Assets estáticos locales → caché primero, luego red
    if (STATIC_ASSETS.some(a => url.pathname.endsWith(a))) {
        event.respondWith(
            caches.match(event.request).then(cached =>
                cached || fetch(event.request).then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    return response;
                })
            )
        );
        return;
    }

    // Todo lo demás (CDN, Supabase) → siempre red
    event.respondWith(fetch(event.request));
});

// ============================================
// SmartGas Service Worker v6
// NUNCA cachea index.html — siempre red
// ============================================
const CACHE_NAME = 'smartgas';

const STATIC_ASSETS = [
    'icon-192.png',
    'icon-512.png',
    'manifest.json'
];

self.addEventListener('install', event => {
    console.log('[SW v6] Install');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('[SW v6] Activate — limpiando caches antiguos');
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

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

    event.respondWith(fetch(event.request));
});

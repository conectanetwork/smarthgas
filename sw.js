const CACHE_VERSION = 'levelgas-v6-android-icon';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (self.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', () => {
  // Sin cache forzado: dejamos que el navegador obtenga index.html, manifest e iconos actualizados.
});

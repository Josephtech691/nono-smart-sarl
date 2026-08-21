// Service worker minimal pour rendre le site installable (PWA, section 68 du
// cahier des charges) et disponible hors-ligne pour la coquille de l'app.
// Strategie volontairement simple : cache-first pour les assets statiques,
// network-first (avec repli sur le cache) pour tout le reste - en particulier
// on ne met jamais en cache les appels a /api/, qui doivent toujours refleter
// l'etat reel des commandes/stocks.

const CACHE_NAME = 'nono-smart-v1';
const APP_SHELL = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ne jamais mettre en cache les appels API : toujours le reseau.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(request).then(async (cached) => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      } catch (err) {
        // Reseau indisponible : on sert le cache si on en a un, sinon la
        // page d'accueil en cache (utile pour une navigation SPA hors-ligne),
        // et en tout dernier recours une reponse d'erreur explicite -
        // jamais `undefined`, qui ferait planter respondWith().
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match('/');
          if (shell) return shell;
        }
        return new Response('Hors ligne', { status: 503, statusText: 'Service Unavailable' });
      }
    })
  );
});

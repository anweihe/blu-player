const CACHE_NAME = 'bluesound-v1';
const STATIC_ASSETS = [
  // Pages
  '/',
  '/Players',
  '/Qobuz',
  '/TuneIn',
  '/RadioParadise',
  '/Settings',

  // CSS
  '/css/site.css',
  '/css/qobuz.css',
  '/css/tunein.css',
  '/css/radioparadise.css',
  '/css/settings.css',
  '/css/fab.css',
  '/css/now-playing-popup.css',
  '/css/volume-panel.css',

  // Core JS
  '/js/global-player.js',
  '/js/spa-router.js',
  '/js/hamburger-menu.js',
  '/js/settings-api.js',
  '/js/queue-api.js',
  '/js/user-profiles.js',
  '/js/volume-panel.js',
  '/js/fab.js',
  '/js/now-playing-swipe.js',
  '/js/site.js',

  // Feature JS
  '/js/tunein.js',
  '/js/radioparadise.js',
  '/js/qobuz/qobuz-core.js',
  '/js/qobuz/qobuz-auth.js',
  '/js/qobuz/qobuz-browse.js',
  '/js/qobuz/qobuz-playback.js',
  '/js/qobuz/qobuz-search.js',
  '/js/qobuz/qobuz-lightbox.js',
  '/js/qobuz/qobuz-ratings.js',

  // Icons
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg'
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-first, cache fallback
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API calls: Network only, no cache
  if (url.pathname.startsWith('/Api/') || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone response and cache it
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

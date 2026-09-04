const CACHE_NAME = 'date-memory-v8';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './config.js',
  './manifest.json',
  './icons/icon.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Network-First 戦略：常に最新のHTML/JS/CSSをサーバーから取得
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkRes;
      })
      .catch(() => caches.match(e.request))
  );
});


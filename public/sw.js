const CACHE_VERSION = '1.3.9';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Simple pass-through, required for PWA "installable" check
  event.respondWith(fetch(event.request));
});

const CACHE_VERSION = '5.8';
const APP_SHELL_CACHE = `void-app-shell-${CACHE_VERSION}`;
const CACHE_PREFIX = 'void-';
const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, '');

const isNavigationRequest = (request) => {
  if (request.method !== 'GET') return false;
  if (request.mode === 'navigate') return true;
  if (request.destination === 'document') return true;
  return request.headers.get('accept')?.includes('text/html') || false;
};

const cacheSuccessfulResponse = async (request, response) => {
  if (!response || !response.ok) return;

  const cache = await caches.open(APP_SHELL_CACHE);
  await cache.put(request, response.clone());
};

const networkFirstNavigation = async (request) => {
  const cache = await caches.open(APP_SHELL_CACHE);

  try {
    const response = await fetch(request);
    await cacheSuccessfulResponse(request, response);
    return response;
  } catch (error) {
    const cachedResponse =
      (await cache.match(request)) ||
      (await cache.match(`${scopePath || ''}/`)) ||
      (await cache.match(`${scopePath || ''}/index.html`));

    if (cachedResponse) return cachedResponse;
    throw error;
  }
};

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== APP_SHELL_CACHE)
            .map((cacheName) => caches.delete(cacheName))
        )
      ),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  if (isNavigationRequest(event.request)) {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  event.respondWith(fetch(event.request));
});

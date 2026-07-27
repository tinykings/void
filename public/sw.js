const CACHE_VERSION = '6.0';
const APP_SHELL_CACHE = `void-app-shell-${CACHE_VERSION}`;
const CACHE_PREFIX = 'void-';
const scopeUrl = new URL(self.registration.scope);

const scopedUrl = (path = '') => new URL(path, scopeUrl).toString();

const CORE_ASSETS = [
  '',
  'index.html',
  'manifest.json',
  'favicon.png',
  'logo.png',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
].map(scopedUrl);

const isNavigationRequest = (request) => {
  if (request.method !== 'GET') return false;
  if (request.mode === 'navigate' || request.destination === 'document') return true;
  return request.headers.get('accept')?.includes('text/html') || false;
};

const isStaticRequest = (request) => {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return false;
  if (url.pathname.endsWith('/sw.js')) return false;

  return url.pathname.includes('/_next/static/')
    || ['style', 'script', 'font', 'image', 'manifest'].includes(request.destination)
    || /\.(?:css|js|woff2?|png|jpe?g|gif|webp|svg|ico|json)$/i.test(url.pathname);
};

const cacheResponse = async (cache, request, response) => {
  if (response?.ok) await cache.put(request, response.clone());
  return response;
};

const discoverShellAssets = async () => {
  const response = await fetch(scopeUrl.toString(), { cache: 'reload' });
  if (!response.ok) return [];

  const cache = await caches.open(APP_SHELL_CACHE);
  await Promise.all([
    cache.put(scopeUrl.toString(), response.clone()),
    cache.put(scopedUrl('index.html'), response.clone()),
  ]);

  const html = await response.text();
  const discovered = new Set();
  const attributePattern = /(?:src|href)=["']([^"']+)["']/gi;
  let match;

  while ((match = attributePattern.exec(html))) {
    try {
      const assetUrl = new URL(match[1], scopeUrl);
      if (assetUrl.origin === scopeUrl.origin && assetUrl.pathname.startsWith(scopeUrl.pathname)) {
        discovered.add(assetUrl.toString());
      }
    } catch {
      // Ignore malformed or non-URL attributes.
    }
  }

  return [...discovered];
};

const precacheAppShell = async () => {
  const cache = await caches.open(APP_SHELL_CACHE);
  let discoveredAssets = [];

  try {
    discoveredAssets = await discoverShellAssets();
  } catch {
    // Individual core assets may still be available and are attempted below.
  }

  const assets = [...new Set([...CORE_ASSETS, ...discoveredAssets])];
  await Promise.allSettled(assets.map(async (url) => {
    const response = await fetch(url, { cache: 'reload' });
    await cacheResponse(cache, url, response);
  }));
};

const networkFirstNavigation = async (request) => {
  const cache = await caches.open(APP_SHELL_CACHE);

  try {
    const response = await fetch(request);
    return await cacheResponse(cache, request, response);
  } catch {
    const cachedResponse =
      (await cache.match(request))
      || (await cache.match(scopeUrl.toString()))
      || (await cache.match(scopedUrl('index.html')));

    if (cachedResponse) return cachedResponse;
    throw new Error('The VOID app shell is not available offline yet.');
  }
};

const cacheFirstStatic = async (request, event) => {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    event.waitUntil(
      fetch(request)
        .then((response) => cacheResponse(cache, request, response))
        .catch(() => undefined)
    );
    return cached;
  }

  const response = await fetch(request);
  return cacheResponse(cache, request, response);
};

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
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

  if (isStaticRequest(event.request)) {
    event.respondWith(cacheFirstStatic(event.request, event));
  }
});

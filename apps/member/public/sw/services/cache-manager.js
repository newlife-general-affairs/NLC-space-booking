export class CacheManager {
  constructor({ cachePrefix, cacheNames, precacheUrls, offlineFallbackUrl = '/index.html' }) {
    this.cachePrefix = cachePrefix;
    this.cacheNames = cacheNames;
    this.precacheUrls = precacheUrls;
    this.offlineFallbackUrl = offlineFallbackUrl;
  }

  async install() {
    const cache = await caches.open(this.cacheNames.shell);
    await cache.addAll(this.precacheUrls);
  }

  async activate() {
    const currentCaches = new Set(Object.values(this.cacheNames));
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(this.cachePrefix) && !currentCaches.has(key))
        .map((key) => caches.delete(key)),
    );
  }

  async cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') {
        const cache = await caches.open(this.cacheNames.static);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      console.warn('[ServiceWorker] Static asset unavailable:', request.url, error);
      return new Response('Resource unavailable while offline.', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  async navigationNetworkFirst(request) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(this.cacheNames.shell);
        await cache.put(this.offlineFallbackUrl, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(this.offlineFallbackUrl);
      if (cached) return cached;

      return new Response('The booking app is currently offline.', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }
}

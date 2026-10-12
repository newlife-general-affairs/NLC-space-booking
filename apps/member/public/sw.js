import {
  CACHE_NAMES,
  CACHE_PREFIX,
  PRECACHE_URLS,
  isAppNavigation,
  isAppStaticAsset,
} from './sw/config.js';
import { CacheManager } from './sw/services/cache-manager.js';

const cacheManager = new CacheManager({
  cachePrefix: CACHE_PREFIX,
  cacheNames: CACHE_NAMES,
  precacheUrls: PRECACHE_URLS,
});

self.addEventListener('install', (event) => {
  // Do not auto skip-waiting here: a new version stays "waiting" until the
  // page's update toast tells it to activate, so the app can prompt the
  // user instead of hot-swapping under them mid-session.
  event.waitUntil(cacheManager.install());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(cacheManager.activate());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== 'GET') return;

  // Booking data is always network-only and is never queued or cached.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    if (isAppNavigation(url)) {
      event.respondWith(cacheManager.navigationNetworkFirst(request));
    }
    return;
  }

  // Do not intercept arbitrary same-origin files. Localhost ports are often
  // reused by unrelated projects, and a root-scoped worker can outlive a dev server.
  if (isAppStaticAsset(url)) {
    event.respondWith(cacheManager.cacheFirst(request));
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

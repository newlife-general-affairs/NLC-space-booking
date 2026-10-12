export const CACHE_PREFIX = 'space-booking';
export const CACHE_VERSION = 'v3';

export const CACHE_NAMES = Object.freeze({
  shell: CACHE_PREFIX + '-shell-' + CACHE_VERSION,
  static: CACHE_PREFIX + '-static-' + CACHE_VERSION,
});

export const PRECACHE_URLS = Object.freeze([
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest',
]);

const APP_SHELL_PATHS = new Set(PRECACHE_URLS);
const VITE_ASSET_PATTERN = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|jpe?g|webp|svg|ico)$/i;

export function isAppNavigation(url) {
  return url.pathname === '/' || url.pathname === '/index.html';
}

export function isAppStaticAsset(url) {
  return APP_SHELL_PATHS.has(url.pathname) || VITE_ASSET_PATTERN.test(url.pathname);
}

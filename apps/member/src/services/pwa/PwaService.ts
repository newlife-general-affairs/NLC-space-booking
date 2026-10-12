const CACHE_PREFIX = 'space-booking';

type UpdateListener = () => void;

export class PwaService {
  private registration?: ServiceWorkerRegistration;
  private started = false;
  private updateListeners = new Set<UpdateListener>();
  private reloadOnControllerChange = false;

  async start(): Promise<ServiceWorkerRegistration | undefined> {
    if (this.started || !('serviceWorker' in navigator)) {
      return this.registration;
    }

    if (!import.meta.env.PROD) {
      await this.cleanupDevelopmentWorker();
      return undefined;
    }

    this.started = true;
    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        type: 'module',
      });
      this.watchForUpdates(this.registration);

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (this.reloadOnControllerChange) window.location.reload();
      });

      return this.registration;
    } catch (error) {
      this.started = false;
      console.error('Service worker registration failed:', error);
      return undefined;
    }
  }

  private watchForUpdates(registration: ServiceWorkerRegistration): void {
    // A worker already sitting in "waiting" when we register (e.g. a
    // previous tab installed it) means an update is ready right now.
    if (registration.waiting && navigator.serviceWorker.controller) {
      this.notifyUpdateAvailable();
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        // "installed" + an existing controller means this is an update to
        // an already-running app, not the very first install.
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          this.notifyUpdateAvailable();
        }
      });
    });
  }

  private notifyUpdateAvailable(): void {
    this.updateListeners.forEach((listener) => listener());
  }

  onUpdateAvailable(listener: UpdateListener): () => void {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  applyUpdate(): void {
    if (!this.registration?.waiting) return;
    this.reloadOnControllerChange = true;
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  private async cleanupDevelopmentWorker(): Promise<void> {
    if (!('caches' in window)) return;

    const cacheNames = await caches.keys();
    const appCacheNames = cacheNames.filter((name) => name.startsWith(CACHE_PREFIX));
    if (appCacheNames.length === 0) return;

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => {
          const scriptUrl = registration.active?.scriptURL
            || registration.waiting?.scriptURL
            || registration.installing?.scriptURL;
          return scriptUrl ? new URL(scriptUrl).pathname === '/sw.js' : false;
        })
        .map((registration) => registration.unregister()),
    );
    await Promise.all(appCacheNames.map((name) => caches.delete(name)));
  }
}

export const pwaService = new PwaService();

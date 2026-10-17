export type RegisterPwaOptions = {
  /** Service worker URL. Default `/service-worker.js` (emitted by PwaPlugin in production builds). */
  swUrl?: string;
  /** Registration scope. Default: the browser default (directory of swUrl). */
  scope?: string;
  /** Called when registration fails. Default: ignore (no SW in dev). */
  onError?: (error: unknown) => void;
};

/**
 * Register the app's service worker after `load`.
 * Only the app that owns the page (shell, or a remote running standalone) calls this.
 * Remotes rendered inside a shell never register a service worker.
 */
export function registerPwa(options: RegisterPwaOptions = {}): void {
  const { swUrl = '/service-worker.js', scope, onError } = options;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  const register = () => {
    navigator.serviceWorker
      .register(swUrl, scope ? { scope } : undefined)
      .catch((error: unknown) => {
        // The SW only exists in production builds; a 404 in dev is expected.
        onError?.(error);
      });
  };
  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}

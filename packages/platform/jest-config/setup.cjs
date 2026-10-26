// Shared Jest setup (setupFilesAfterEnv). Ported from starter-mfe src/test/setup.ts.
require('@testing-library/jest-dom');
const util = require('node:util');

if (typeof globalThis.TextEncoder === 'undefined') {
  Object.assign(globalThis, {
    TextEncoder: util.TextEncoder,
    TextDecoder: util.TextDecoder,
  });
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  // jsdom has no matchMedia. Default: light scheme. Tests may override.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

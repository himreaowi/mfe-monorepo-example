// @ts-check
/**
 * DEV ONLY mock vendor, format "web-component": <mock-vendor-widget> wraps the same mount().
 * The host assigns `element.props` and re-assigns it on every update.
 *   { "url": "http://localhost:3191/element.js", "format": "web-component", "tagName": "mock-vendor-widget" }
 */
import { contractVersion, mount } from './mount.js';

/** @typedef {import('@org/vendor-kit/contract').MountProps} MountProps */
/** @typedef {import('@org/vendor-kit/contract').MountedModule} MountedModule */

class MockVendorWidget extends HTMLElement {
  static contractVersion = contractVersion;
  /** @type {MountedModule | null} */
  #handle = null;
  /** @type {MountProps | undefined} */
  #props;

  /** @param {MountProps | undefined} value */
  set props(value) {
    this.#props = value;
    if (!value) return;
    if (this.#handle) this.#handle.update?.(value);
    else if (this.isConnected) this.#handle = mount(this, value);
  }

  get props() {
    return this.#props;
  }

  connectedCallback() {
    if (this.#props && !this.#handle) this.#handle = mount(this, this.#props);
  }

  disconnectedCallback() {
    void this.#handle?.unmount();
    this.#handle = null;
  }
}

if (!customElements.get('mock-vendor-widget')) {
  customElements.define('mock-vendor-widget', MockVendorWidget);
}

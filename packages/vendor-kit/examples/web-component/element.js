// @ts-check
/**
 * Minimal external module (format "web-component"): a custom element wrapping the same mount
 * logic. The host creates <example-module>, assigns `element.props` and re-assigns on updates.
 * The class must have a static `contractVersion`. Manifest config:
 *   { "url": "https://…/element.js", "format": "web-component", "tagName": "example-module" }
 */
import { contractVersion, mount } from '../vanilla/mount.js';

/** @typedef {import('../../contract/mount-contract').MountProps} MountProps */
/** @typedef {import('../../contract/mount-contract').MountedModule} MountedModule */

class ExampleModule extends HTMLElement {
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
    else if (this.isConnected)
      this.#handle = /** @type {MountedModule} */ (mount(this, value));
  }

  get props() {
    return this.#props;
  }

  connectedCallback() {
    if (this.#props && !this.#handle)
      this.#handle = /** @type {MountedModule} */ (mount(this, this.#props));
  }

  disconnectedCallback() {
    void this.#handle?.unmount();
    this.#handle = null;
  }
}

if (!customElements.get('example-module'))
  customElements.define('example-module', ExampleModule);

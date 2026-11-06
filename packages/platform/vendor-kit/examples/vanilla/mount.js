// @ts-check
/**
 * Minimal external module (format "esm"), no framework, no build step.
 * Copy it as a starting point. Contract: ../../contract/mount-contract.d.ts.
 *
 * - renders into a shadow root on its own element inside the host's element (styles scoped)
 * - uses the host's CSS custom properties with fallbacks (follows the host theme)
 * - reports clicks through onEvent, navigation through onNavigate, problems through onError
 * - update() re-renders, unmount() removes everything (no globals, no listeners left)
 */

/** @typedef {import('../../contract/mount-contract').MountProps} MountProps */
/** @typedef {import('../../contract/mount-contract').MountedModule} MountedModule */

export const contractVersion = '1.0.0';

const CSS = `
  :host { display: block; font-family: var(--font-sans, system-ui, sans-serif); color: var(--color-text, #0f172a); }
  .card { padding: 1rem; border: 1px solid var(--color-border, #cbd5e1); border-radius: var(--radius, 6px); background: var(--color-surface, #fff); }
  button { font: inherit; padding: 0.25rem 0.75rem; border-radius: var(--radius, 6px); border: 1px solid var(--color-accent, #0f766e); background: var(--color-accent, #0f766e); color: var(--color-accent-contrast, #fff); cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--color-accent, #0f766e); outline-offset: 2px; }
`;

/**
 * @param {HTMLElement} element empty element owned by the host
 * @param {MountProps} initialProps
 * @returns {MountedModule}
 */
export function mount(element, initialProps) {
  let props = initialProps;
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  // Constructable stylesheet: scoped to the shadow root, allowed by a strict CSP (no inline <style>).
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS);
  root.adoptedStyleSheets = [sheet];
  element.appendChild(host);

  const onClick = (/** @type {Event} */ e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.dataset.action === 'hello')
      props.onEvent('example:hello', { at: Date.now() });
  };
  root.addEventListener('click', onClick);

  function render() {
    const section = document.createElement('section');
    section.className = 'card';
    section.setAttribute('aria-label', 'Example module');
    const h = document.createElement('h2');
    h.textContent = String(props.config.title ?? 'Example module');
    const p = document.createElement('p');
    p.textContent = `Hello ${props.user?.name ?? 'guest'} (${props.theme} theme, path "${props.path}")`;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'hello';
    button.textContent = 'Send event to host';
    section.append(h, p, button);
    root.replaceChildren(section);
  }
  render();

  return {
    update(next) {
      props = next;
      render();
    },
    unmount() {
      root.removeEventListener('click', onClick);
      host.remove();
    },
  };
}

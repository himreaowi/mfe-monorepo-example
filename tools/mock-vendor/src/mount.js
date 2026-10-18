// @ts-check
/**
 * DEV ONLY mock vendor module (format "esm"). Plain DOM, no framework, no build step: it plays
 * the role of a product built by an external vendor who only has the vendor kit
 * (@org/vendor-kit contract types), not our repo.
 *
 * A neutral demo widget that exercises the whole mount contract:
 * - renders in a shadow root inside the host's element (styles scoped, constructable stylesheet:
 *   CSP-friendly), using the host's CSS custom properties with fallbacks
 * - own routing on `props.path` + `props.onNavigate` (overview ↔ details/<n>)
 * - `onEvent` ("demo:action"), `onError` (non-fatal warning and fatal crash)
 * - `config.title` / `config.message` from the manifest (`props.vendor.config`), both optional
 * - `update()` re-renders (theme, path, user, config); `unmount()` removes everything
 * - logs every lifecycle call to the console ("[mock-vendor] mount|update|unmount")
 */

/** @typedef {import('@org/vendor-kit/contract').MountProps} MountProps */
/** @typedef {import('@org/vendor-kit/contract').MountedModule} MountedModule */

export const contractVersion = '1.0.0';

const VENDOR = 'mock-vendor';

const CSS = `
:host { display: block; font-family: var(--font-sans, system-ui, sans-serif); color: var(--color-text, #0f172a); }
.widget { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; border: 2px solid var(--color-accent, #6d28d9); border-radius: var(--radius, 6px); background: var(--color-surface, #fff); }
.brand { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
.brand h2 { margin: 0; font-size: 1.125rem; }
.tag { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 999px; background: var(--color-accent, #6d28d9); color: var(--color-accent-contrast, #fff); }
.muted { margin: 0; color: var(--color-text-muted, #475569); font-size: 0.875rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
button { font: inherit; min-height: 2.25rem; padding: 0.25rem 0.875rem; border-radius: var(--radius, 6px); border: 1px solid var(--color-accent, #6d28d9); background: transparent; color: var(--color-text, #0f172a); cursor: pointer; }
button.primary { background: var(--color-accent, #6d28d9); color: var(--color-accent-contrast, #fff); }
button:focus-visible { outline: 3px solid var(--color-accent, #6d28d9); outline-offset: 2px; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; margin: 0; font-size: 0.875rem; }
dt { color: var(--color-text-muted, #475569); }
dd { margin: 0; }
@media (prefers-reduced-motion: no-preference) { button { transition: background-color 120ms; } }
`;

/** @param {string} tag @param {Record<string, string>} [attrs] @param {(Node | string)[]} [children] */
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('data-'))
      el.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] =
        v;
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
}

/**
 * @param {HTMLElement} element empty element owned by the host
 * @param {MountProps} initialProps
 * @returns {MountedModule}
 */
export function mount(element, initialProps) {
  let props = initialProps;
  let updates = 0;
  let actions = 0;
  console.info(
    `[${VENDOR}] mount contract=${props.contractVersion} basePath=${props.basePath} path="${props.path}" theme=${props.theme}`,
  );

  const host = h('div', { 'data-vendor': VENDOR });
  const root = host.attachShadow({ mode: 'open' });
  if ('adoptedStyleSheets' in root && typeof CSSStyleSheet === 'function') {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
  } else {
    root.append(h('style', {}, [CSS]));
  }
  element.appendChild(host);

  /** @param {Event} event */
  const onClick = (event) => {
    const target = /** @type {HTMLElement | null} */ (event.target);
    const action = target?.closest('button')?.dataset.action;
    if (!action) return;
    if (action === 'event') {
      actions += 1;
      props.onEvent('demo:action', { count: actions });
      render(`Sent event demo:action #${actions}.`);
    } else if (action === 'details') {
      props.onNavigate(`details/${Math.max(actions, 1)}`);
    } else if (action === 'back') {
      props.onNavigate('');
    } else if (action === 'warn') {
      props.onError({
        code: 'mock-warning',
        message: 'A non-fatal problem (mock).',
        fatal: false,
      });
    } else if (action === 'crash') {
      props.onError({
        code: 'mock-crash',
        message: 'The mock vendor crashed on purpose.',
        fatal: true,
      });
    }
  };
  root.addEventListener('click', onClick);

  /** @param {string} [status] */
  function render(status = '') {
    const details = /^details\/(.+)$/.exec(props.path)?.[1];
    const title = String(props.config.title ?? 'Mock vendor');
    const message = String(
      props.config.message ??
        'A demo module rendered by the mock vendor through the mount contract.',
    );
    const who = props.user
      ? (props.user.name ?? props.user.id)
      : 'guest (signed out)';
    const body = details
      ? [
          h('h3', {}, [`Details ${details}`]),
          h('p', { class: 'muted', 'data-testid': 'mock-vendor-details' }, [
            `Details page ${details} for ${who}. Rendered by the vendor's own router from props.path.`,
          ]),
          h('div', { class: 'actions' }, [
            h('button', { type: 'button', 'data-action': 'back' }, [
              'Back to overview',
            ]),
          ]),
        ]
      : [
          h('p', {}, [`Hello, ${who}.`]),
          h('p', { class: 'muted' }, [message]),
          h('div', { class: 'actions' }, [
            h(
              'button',
              { type: 'button', class: 'primary', 'data-action': 'event' },
              ['Send demo event'],
            ),
            h('button', { type: 'button', 'data-action': 'details' }, [
              'Open details',
            ]),
            h('button', { type: 'button', 'data-action': 'warn' }, [
              'Report a warning',
            ]),
            h('button', { type: 'button', 'data-action': 'crash' }, [
              'Simulate crash',
            ]),
          ]),
        ];
    const section = h(
      'section',
      {
        class: 'widget',
        'aria-labelledby': 'mock-vendor-title',
        'data-testid': 'mock-vendor',
      },
      [
        h('div', { class: 'brand' }, [
          h('h2', { id: 'mock-vendor-title' }, [title]),
          h('span', { class: 'tag' }, ['Mock vendor · no React']),
        ]),
        ...body,
        h('dl', { 'data-testid': 'mock-vendor-props' }, [
          h('dt', {}, ['theme']),
          h('dd', { 'data-testid': 'mock-vendor-theme' }, [props.theme]),
          h('dt', {}, ['path']),
          h('dd', { 'data-testid': 'mock-vendor-path' }, [
            props.path || '(root)',
          ]),
          h('dt', {}, ['user']),
          h('dd', { 'data-testid': 'mock-vendor-user' }, [who]),
          h('dt', {}, ['locale']),
          h('dd', {}, [props.locale]),
          h('dt', {}, ['updates']),
          h('dd', { 'data-testid': 'mock-vendor-updates' }, [String(updates)]),
        ]),
        h(
          'p',
          {
            class: 'muted',
            role: 'status',
            'aria-live': 'polite',
            'data-testid': 'mock-vendor-status',
          },
          [status],
        ),
      ],
    );
    root.replaceChildren(section);
  }
  render();

  return {
    update(next) {
      props = next;
      updates += 1;
      console.info(
        `[${VENDOR}] update #${updates} path="${next.path}" theme=${next.theme} user=${next.user?.id ?? 'null'}`,
      );
      render();
    },
    unmount() {
      console.info(`[${VENDOR}] unmount`);
      root.removeEventListener('click', onClick);
      host.remove();
    },
  };
}

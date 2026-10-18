// @ts-check
/**
 * Vendor kit test host: loads a module through the SAME loader the production shells use
 * (lib/load.js, generated from @org/mf-runtime), mounts it with sample props and logs every
 * callback and lifecycle step. Also runs a few automatic checks (contract version, unmount
 * cleans up, no new globals, no styles added to <head>, no CSP violations).
 *
 * Query parameters (prefill + automation): url, format, exportName, global, tagName, integrity,
 * config (JSON), user (JSON), theme, locale, path, autoMount=1, csp.
 */
import {
  ExternalModuleLoadError,
  loadExternalModule,
  withTimeout,
} from './lib/load.js';
import {
  MOUNT_CONTRACT_VERSION,
  isCompatibleContractVersion,
} from './lib/contract.js';

/** @typedef {import('../contract/mount-contract').MountProps} MountProps */
/** @typedef {import('../contract/mount-contract').MountedModule} MountedModule */

const TIMEOUT_MS = 15000;
const $ = (/** @type {string} */ sel) =>
  /** @type {HTMLElement} */ (document.querySelector(sel));
const form = /** @type {HTMLFormElement} */ ($('#setup'));
const stage = $('#stage');
const logList = $('#log');
const checkList = $('#checks');
const buttons = {
  mount: /** @type {HTMLButtonElement} */ ($('#mount')),
  update: /** @type {HTMLButtonElement} */ ($('#update')),
  unmount: /** @type {HTMLButtonElement} */ ($('#unmount')),
};

$('#contract-version').textContent =
  `host implements mount contract ${MOUNT_CONTRACT_VERSION}`;

/** @type {{ handle: MountedModule | null, element: HTMLElement | null, attempt: number, globals: Set<string>, expectedGlobal?: string, headNodes: number, docSheets: number, cspViolations: string[] }} */
const state = {
  handle: null,
  element: null,
  attempt: 0,
  globals: new Set(),
  headNodes: 0,
  docSheets: 0,
  cspViolations: [],
};

function setState(/** @type {string} */ value) {
  document.body.dataset.state = value;
  buttons.update.disabled = value !== 'mounted';
  buttons.unmount.disabled = value !== 'mounted';
}
setState('idle');

/** @param {string} kind @param {string} text @param {unknown} [data] */
function log(kind, text, data) {
  const li = document.createElement('li');
  li.dataset.kind = kind;
  const time = new Date().toISOString().slice(11, 23);
  li.textContent = `${time} [${kind}] ${text}${data === undefined ? '' : ` ${JSON.stringify(data)}`}`;
  logList.append(li);
  li.scrollIntoView({ block: 'nearest' });
  console.info(`[test-host] [${kind}] ${text}`, data ?? '');
}

/** @param {'pass' | 'fail' | 'warn'} status @param {string} text */
function check(status, text) {
  const li = document.createElement('li');
  li.className = status;
  li.dataset.status = status;
  li.textContent = text;
  checkList.append(li);
}

// The portal's CSP blocks the same things (e.g. an inline <style> in your shadow root, a
// style="" attribute in an HTML string, a script or stylesheet from an origin you did not
// declare): report each violation in the log and as a failed check.
document.addEventListener('securitypolicyviolation', (event) => {
  const what = `${event.effectiveDirective} blocked ${event.blockedURI || 'inline code'}${event.sample ? ` ("${event.sample}")` : ''}`;
  state.cspViolations.push(what);
  log('csp', what);
  check(
    'fail',
    `CSP violation: ${what}. Use constructable stylesheets or a <link> from your declared origin for styles; declare every origin you load from.`,
  );
});

function field(/** @type {string} */ name) {
  return /** @type {HTMLInputElement} */ (form.elements.namedItem(name));
}

/** @param {string} name @returns {unknown} */
function json(name) {
  const raw = field(name).value.trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${name}: not valid JSON`);
  }
}

function readConfig() {
  /** @type {Record<string, unknown>} */
  const config = {
    url: field('url').value.trim(),
    format: field('format').value,
  };
  for (const key of ['exportName', 'global', 'tagName', 'integrity']) {
    const v = field(key).value.trim();
    if (v) config[key] = v;
  }
  return /** @type {any} */ (config);
}

/** The host's navigation: relative to basePath, or an absolute host path. */
function navigate(/** @type {string} */ to) {
  const path = to.startsWith('/') ? to : to.replace(/^\/+/, '');
  field('path').value = path;
  if (state.handle) void update();
}

/** @returns {MountProps} */
function readProps() {
  const user = json('user');
  return {
    contractVersion: MOUNT_CONTRACT_VERSION,
    basePath: '/vendor-test',
    path: field('path').value.replace(/^\/+/, ''),
    theme: field('theme').value === 'dark' ? 'dark' : 'light',
    locale: field('locale').value || 'en-SG',
    user: user === undefined ? null : /** @type {any} */ (user),
    config: Object.freeze({ .../** @type {object} */ (json('config') ?? {}) }),
    onNavigate(to, options) {
      log('onNavigate', String(to), options);
      navigate(String(to));
    },
    onEvent(name, detail) {
      log('onEvent', String(name), detail);
    },
    onError(error) {
      log('onError', `${error?.code}: ${error?.message}`, {
        fatal: error?.fatal === true,
      });
      if (error?.fatal) {
        check(
          'warn',
          `module reported a fatal error (${error.code}); the host would show its fallback`,
        );
        void unmount();
      }
    },
  };
}

function applyTheme() {
  document.documentElement.dataset.theme = field('theme').value;
  stage.style.width = field('width').value;
}

function snapshot() {
  state.globals = new Set(Object.getOwnPropertyNames(window));
  state.headNodes = document.head.querySelectorAll(
    'style, link[rel="stylesheet"]',
  ).length;
  state.docSheets = document.adoptedStyleSheets.length;
}

function newGlobals() {
  return Object.getOwnPropertyNames(window).filter(
    (name) => !state.globals.has(name) && name !== state.expectedGlobal,
  );
}

async function mount() {
  if (state.handle) await unmount();
  checkList.replaceChildren();
  state.cspViolations = [];
  applyTheme();
  let config;
  let props;
  try {
    config = readConfig();
    props = readProps();
  } catch (error) {
    check('fail', String(error instanceof Error ? error.message : error));
    return;
  }
  setState('loading');
  snapshot();
  state.expectedGlobal =
    config.format === 'script'
      ? String(config.global).split('.')[0]
      : undefined;
  log('load', `${config.format} ${config.url}`);
  const started = performance.now();
  try {
    const mod = await withTimeout(
      loadExternalModule(config, { attempt: state.attempt }),
      TIMEOUT_MS,
      'Loading the module',
    );
    check(
      isCompatibleContractVersion(mod.contractVersion) ? 'pass' : 'fail',
      `contractVersion ${mod.contractVersion} (host ${MOUNT_CONTRACT_VERSION}, same major required)`,
    );
    const element = document.createElement('div');
    element.dataset.testid = 'mount-element';
    stage.replaceChildren(element);
    state.element = element;
    const handle = await withTimeout(
      Promise.resolve().then(() => mod.mount(element, props)),
      TIMEOUT_MS,
      'mount()',
    );
    if (!handle || typeof handle.unmount !== 'function') {
      check('fail', 'mount() must return { unmount(), update?() }');
      setState('error');
      return;
    }
    state.handle = handle;
    const ms = Math.round(performance.now() - started);
    log('mounted', `in ${ms} ms`);
    check(ms < 3000 ? 'pass' : 'warn', `loaded and mounted in ${ms} ms`);
    check(
      typeof handle.update === 'function' ? 'pass' : 'warn',
      typeof handle.update === 'function'
        ? 'update() provided'
        : 'no update(): the host remounts on every prop change',
    );
    setState('mounted');
    await new Promise((r) => setTimeout(r, 300));
    const globals = newGlobals();
    check(
      globals.length ? 'fail' : 'pass',
      globals.length
        ? `new globals: ${globals.join(', ')}`
        : 'no new globals on window',
    );
    const headNodes = document.head.querySelectorAll(
      'style, link[rel="stylesheet"]',
    ).length;
    const docSheets = document.adoptedStyleSheets.length;
    check(
      headNodes > state.headNodes || docSheets > state.docSheets
        ? 'fail'
        : 'pass',
      headNodes > state.headNodes || docSheets > state.docSheets
        ? 'styles were added to the document (<head> or document.adoptedStyleSheets): scope them to the mount element / shadow root'
        : 'no styles added to the document',
    );
    if (state.cspViolations.length === 0) {
      check('pass', 'no CSP violations');
    }
  } catch (error) {
    const code =
      error instanceof ExternalModuleLoadError ? error.code : 'mount-failed';
    log(
      'error',
      `${code}: ${error instanceof Error ? error.message : String(error)}`,
    );
    check(
      'fail',
      `${code}: ${error instanceof Error ? error.message : String(error)}`,
    );
    setState('error');
    state.attempt += 1;
  }
}

async function update() {
  if (!state.handle) return;
  applyTheme();
  let props;
  try {
    props = readProps();
  } catch (error) {
    check('fail', String(error instanceof Error ? error.message : error));
    return;
  }
  if (typeof state.handle.update === 'function') {
    log('update', `path="${props.path}" theme=${props.theme}`);
    try {
      state.handle.update(props);
    } catch (error) {
      check(
        'fail',
        `update() threw: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    log('update', 'no update(): remounting');
    await mount();
  }
}

async function unmount() {
  const { handle, element } = state;
  if (!handle || !element) return;
  state.handle = null;
  log('unmount', 'calling unmount()');
  try {
    await handle.unmount();
  } catch (error) {
    check(
      'fail',
      `unmount() threw: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const leftovers =
    element.childNodes.length + (element.shadowRoot?.childNodes.length ?? 0);
  check(
    leftovers ? 'fail' : 'pass',
    leftovers
      ? `unmount() left ${leftovers} node(s) in the mount element`
      : 'unmount() removed everything it rendered',
  );
  const globals = newGlobals();
  if (globals.length)
    check('fail', `globals left after unmount: ${globals.join(', ')}`);
  setState('unmounted');
}

window.addEventListener('error', (e) => log('uncaught', e.message));
window.addEventListener('unhandledrejection', (e) =>
  log(
    'uncaught',
    `unhandled rejection: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`,
  ),
);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  void mount();
});
buttons.update.addEventListener('click', () => void update());
buttons.unmount.addEventListener('click', () => void unmount());
field('theme').addEventListener('change', () => void update());
field('csp').addEventListener('change', () => {
  const params = new URLSearchParams(location.search);
  params.set('csp', field('csp').value);
  location.search = params.toString();
});

// prefill from the query string
const params = new URLSearchParams(location.search);
for (const name of [
  'url',
  'format',
  'exportName',
  'global',
  'tagName',
  'integrity',
  'config',
  'user',
  'theme',
  'locale',
  'path',
  'width',
  'csp',
]) {
  const value = params.get(name);
  if (value !== null) field(name).value = value;
}
applyTheme();
if (params.get('autoMount') === '1' && field('url').value) void mount();

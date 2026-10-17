// @ts-check
/**
 * DEV ONLY example vendor module: "Acme Service Desk" ticket widget (format "esm").
 *
 * Plays a vendor product built without React and without access to our repo: it only knows the
 * mount contract (@org/vendor-kit/contract types). Plain DOM in an open shadow root, styles via
 * a constructable stylesheet that reads the host's CSS custom properties.
 *
 * - routes on `props.path` ('' list, 'new' form, 'tickets/<id>' detail) and navigates with
 *   `props.onNavigate` (the host's router owns the URL)
 * - talks to the vendor API at `props.config.apiBaseUrl` (from the host's manifest)
 * - `onEvent('ticket:created', { id, summary })`, `onError` for API failures (non-fatal)
 * - `update()` re-renders (theme, path, user); `unmount()` aborts requests, removes everything
 */
import {
  CATEGORIES,
  PRIORITIES,
  STATUS_LABELS,
  apiBaseUrl,
  categoryLabel,
  formatDate,
  parseRoute,
  validateTicket,
} from './tickets.js';

/** @typedef {import('@org/vendor-kit/contract').MountProps} MountProps */
/** @typedef {import('@org/vendor-kit/contract').MountedModule} MountedModule */
/** @typedef {import('./tickets.js').Ticket} Ticket */
/** @typedef {import('./tickets.js').TicketInput} TicketInput */

export const contractVersion = '1.0.0';

const CSS = `
:host { display: block; font-family: var(--font-sans, system-ui, sans-serif); color: var(--color-text, #0f172a); line-height: 1.5; }
* { box-sizing: border-box; }
.widget { display: flex; flex-direction: column; gap: 1rem; padding: 1rem; border: 1px solid var(--color-border, #cbd5e1); border-radius: var(--radius, 6px); background: var(--color-surface, #fff); }
.top { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: baseline; justify-content: space-between; }
h2 { margin: 0; font-size: 1.25rem; }
h3 { margin: 0; font-size: 1.0625rem; }
h2:focus, h3:focus { outline: none; }
h2:focus-visible, h3:focus-visible { outline: 3px solid var(--color-accent, #0f766e); outline-offset: 2px; }
.vendor { font-size: 0.8125rem; color: var(--color-text-muted, #475569); }
p { margin: 0; }
.muted { color: var(--color-text-muted, #475569); }
ul.tickets { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
ul.tickets li { padding: 0.75rem; border: 1px solid var(--color-border, #cbd5e1); border-radius: var(--radius, 6px); display: grid; gap: 0.25rem; }
.meta { display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; font-size: 0.875rem; color: var(--color-text-muted, #475569); }
.pill { display: inline-block; padding: 0 0.5rem; border: 1px solid currentColor; border-radius: 999px; font-size: 0.8125rem; color: var(--color-text, #0f172a); }
a, .link { color: var(--color-accent, #0f766e); font-weight: 600; text-underline-offset: 2px; }
.link { background: none; border: 0; padding: 0; font: inherit; cursor: pointer; text-decoration: underline; min-height: 24px; }
button.primary, button.secondary { font: inherit; min-height: 2.5rem; padding: 0.375rem 1rem; border-radius: var(--radius, 6px); cursor: pointer; }
button.primary { background: var(--color-accent, #0f766e); color: var(--color-accent-contrast, #ecfdf5); border: 1px solid var(--color-accent, #0f766e); }
button.secondary { background: transparent; color: var(--color-text, #0f172a); border: 1px solid var(--color-border, #cbd5e1); }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid var(--color-accent, #0f766e); outline-offset: 2px; }
button[disabled] { opacity: 0.6; cursor: progress; }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
form { display: grid; gap: 1rem; }
.field { display: grid; gap: 0.25rem; }
label { font-weight: 600; }
.hint { font-size: 0.875rem; color: var(--color-text-muted, #475569); }
input, select, textarea { font: inherit; width: 100%; max-width: 36rem; padding: 0.5rem; border: 1px solid var(--color-text-muted, #475569); border-radius: var(--radius, 6px); background: var(--color-surface, #fff); color: var(--color-text, #0f172a); }
textarea { min-height: 6rem; }
[aria-invalid='true'] { border: 2px solid var(--color-danger, #b91c1c); }
.error { color: var(--color-danger, #b91c1c); font-weight: 600; font-size: 0.9375rem; }
.summary { padding: 0.75rem 1rem; border: 2px solid var(--color-danger, #b91c1c); border-radius: var(--radius, 6px); background: var(--color-danger-bg, #fef2f2); }
.summary ul { margin: 0.25rem 0 0; padding-left: 1.25rem; }
.summary a { color: var(--color-danger, #b91c1c); }
.notice { padding: 0.75rem 1rem; border-left: 4px solid var(--color-accent, #0f766e); background: var(--color-bg, #f1f5f4); }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; margin: 0; }
dt { color: var(--color-text-muted, #475569); }
dd { margin: 0; overflow-wrap: anywhere; }
.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (prefers-reduced-motion: no-preference) { button, a { transition: background-color 120ms; } }
`;

/**
 * @param {string} tag
 * @param {Record<string, string | boolean | undefined>} [attrs]
 * @param {(Node | string | null | false)[]} [children]
 */
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children) if (child) el.append(child);
  return el;
}

/** Real href for a vendor route (open in new tab, copy link); clicks go through onNavigate. @param {string} basePath @param {string} path */
function hostHref(basePath, path) {
  const base = basePath.replace(/\/+$/, '');
  return path ? `${base}/${path}` : base || '/';
}

/** @type {TicketInput} */
const EMPTY_FORM = {
  category: '',
  priority: 'normal',
  summary: '',
  description: '',
};

/**
 * @param {HTMLElement} element
 * @param {MountProps} initialProps
 * @returns {MountedModule}
 */
export function mount(element, initialProps) {
  let props = initialProps;
  /** @type {AbortController | null} */
  let inflight = null;
  /** @type {{ state: 'loading' } | { state: 'error', message: string } | { state: 'ready', tickets: Ticket[] }} */
  let list = { state: 'loading' };
  /** @type {{ state: 'loading' } | { state: 'error', message: string } | { state: 'ready', ticket: Ticket }} */
  let detail = { state: 'loading' };
  /** @type {TicketInput} */
  let form = { ...EMPTY_FORM };
  /** @type {Partial<Record<keyof TicketInput, string>>} */
  let errors = {};
  let submitting = false;
  let notice = '';
  let route = parseRoute(props.path);

  const host = h('div', { 'data-vendor': 'acme-service-desk' });
  const root = host.attachShadow({ mode: 'open' });
  if ('adoptedStyleSheets' in root && typeof CSSStyleSheet === 'function') {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
  } else {
    root.append(h('style', {}, [CSS]));
  }
  element.appendChild(host);

  /** @param {string} path @param {RequestInit} [init] */
  async function api(path, init = {}) {
    inflight?.abort();
    inflight = new AbortController();
    const response = await fetch(`${apiBaseUrl(props.config)}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: inflight.signal,
    });
    const body = response.status === 204 ? undefined : await response.json();
    return { status: response.status, ok: response.ok, body };
  }

  /** @param {unknown} error @param {string} code */
  function report(error, code) {
    if (error instanceof DOMException && error.name === 'AbortError')
      return null;
    const message = error instanceof Error ? error.message : String(error);
    props.onError({ code, message, fatal: false });
    return message;
  }

  async function loadList() {
    list = { state: 'loading' };
    render();
    try {
      const res = await api('/helpdesk/tickets');
      if (!res.ok)
        throw new Error(`Tickets could not be loaded (HTTP ${res.status})`);
      list = { state: 'ready', tickets: res.body.items };
    } catch (error) {
      const message = report(error, 'tickets-unavailable');
      if (message === null) return;
      list = { state: 'error', message };
    }
    render();
  }

  /** @param {string} id */
  async function loadTicket(id) {
    detail = { state: 'loading' };
    render();
    try {
      const res = await api(`/helpdesk/tickets/${encodeURIComponent(id)}`);
      if (res.status === 404) throw new Error(`There is no ticket ${id}`);
      if (!res.ok)
        throw new Error(
          `Ticket ${id} could not be loaded (HTTP ${res.status})`,
        );
      detail = { state: 'ready', ticket: res.body };
    } catch (error) {
      const message = report(error, 'ticket-unavailable');
      if (message === null) return;
      detail = { state: 'error', message };
    }
    render();
  }

  async function submit() {
    errors = validateTicket(form);
    if (Object.keys(errors).length > 0) {
      render();
      root.querySelector('.summary')?.querySelector('a')?.focus();
      return;
    }
    submitting = true;
    render();
    try {
      const res = await api('/helpdesk/tickets', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      submitting = false;
      if (res.status === 422) {
        errors = res.body.errors ?? {};
        render();
        root.querySelector('.summary')?.querySelector('a')?.focus();
        return;
      }
      if (!res.ok)
        throw new Error(`The ticket could not be sent (HTTP ${res.status})`);
      /** @type {Ticket} */
      const ticket = res.body;
      form = { ...EMPTY_FORM };
      errors = {};
      notice = `Ticket ${ticket.id} created. We will email you about updates.`;
      props.onEvent('ticket:created', {
        id: ticket.id,
        summary: ticket.summary,
      });
      props.onNavigate(`tickets/${ticket.id}`);
    } catch (error) {
      submitting = false;
      const message = report(error, 'ticket-not-sent');
      if (message !== null) {
        notice = '';
        errors = {};
        render();
        const alert = root.querySelector('[data-role="send-error"]');
        if (alert) alert.textContent = `${message}. Try again.`;
      }
    }
  }

  /** @param {Event} event */
  function onClick(event) {
    const target = /** @type {HTMLElement} */ (event.target);
    const nav = target.closest('[data-nav]');
    if (nav instanceof HTMLElement) {
      event.preventDefault();
      props.onNavigate(nav.dataset.nav ?? '');
      return;
    }
    const focusLink = target.closest('[data-focus]');
    if (focusLink instanceof HTMLElement) {
      event.preventDefault();
      /** @type {HTMLElement | null} */ (
        root.getElementById(focusLink.dataset.focus ?? '')
      )?.focus();
      return;
    }
    if (target.closest('[data-action="retry"]')) {
      if (route.view === 'ticket') void loadTicket(route.id);
      else void loadList();
    }
  }

  /** @param {Event} event */
  function onInput(event) {
    const field = /** @type {HTMLInputElement} */ (event.target);
    const name = /** @type {keyof TicketInput} */ (field.name);
    if (name in form) form = { ...form, [name]: field.value };
  }

  /** @param {Event} event */
  function onSubmit(event) {
    event.preventDefault();
    void submit();
  }

  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('submit', onSubmit);

  /** @param {string} id @param {string} label @param {HTMLElement} control @param {string} [hint] */
  function field(id, label, control, hint) {
    const name = /** @type {keyof TicketInput} */ (
      control.getAttribute('name')
    );
    const error = errors[name];
    const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : '']
      .filter(Boolean)
      .join(' ');
    control.id = id;
    if (describedBy) control.setAttribute('aria-describedby', describedBy);
    if (error) control.setAttribute('aria-invalid', 'true');
    return h('div', { class: 'field' }, [
      h('label', { for: id }, [label]),
      hint ? h('p', { class: 'hint', id: `${id}-hint` }, [hint]) : null,
      error
        ? h('p', { class: 'error', id: `${id}-error` }, [
            h('span', { class: 'visually-hidden' }, ['Error: ']),
            error,
          ])
        : null,
      control,
    ]);
  }

  /** @param {{ value: string, label: string }[]} options @param {string} value @param {string} name @param {string} [placeholder] */
  function select(options, value, name, placeholder) {
    const el = h('select', { name }, [
      placeholder ? h('option', { value: '' }, [placeholder]) : null,
      ...options.map((o) =>
        h('option', { value: o.value, selected: o.value === value }, [o.label]),
      ),
    ]);
    /** @type {HTMLSelectElement} */ (el).value = value;
    return el;
  }

  function listView() {
    const who = props.user?.name ?? 'you';
    /** @type {(Node | string | null)[]} */
    const body = [];
    if (list.state === 'loading')
      body.push(h('p', { role: 'status' }, ['Loading your tickets…']));
    else if (list.state === 'error') {
      body.push(
        h('div', { role: 'alert', class: 'summary' }, [list.message]),
        h('div', { class: 'actions' }, [
          h(
            'button',
            { type: 'button', class: 'secondary', 'data-action': 'retry' },
            ['Try again'],
          ),
        ]),
      );
    } else if (list.tickets.length === 0)
      body.push(h('p', { class: 'muted' }, ['You have no tickets.']));
    else {
      body.push(
        h(
          'ul',
          { class: 'tickets', 'aria-label': 'Your tickets' },
          list.tickets.map((t) =>
            h('li', { 'data-testid': 'helpdesk-ticket' }, [
              h(
                'a',
                {
                  href: hostHref(props.basePath, `tickets/${t.id}`),
                  'data-nav': `tickets/${t.id}`,
                },
                [`${t.id}: ${t.summary}`],
              ),
              h('div', { class: 'meta' }, [
                h('span', { class: 'pill' }, [
                  STATUS_LABELS[t.status] ?? t.status,
                ]),
                h('span', {}, [categoryLabel(t.category)]),
                h('span', {}, [
                  `Opened ${formatDate(t.createdAt, props.locale)}`,
                ]),
              ]),
            ]),
          ),
        ),
      );
    }
    return [
      h('div', { class: 'top' }, [
        h('h2', { tabindex: '-1', 'data-heading': '' }, ['Your IT tickets']),
        h('span', { class: 'vendor' }, ['Acme Service Desk']),
      ]),
      h('p', { class: 'muted' }, [`Tickets raised by ${who}.`]),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', class: 'primary', 'data-nav': 'new' }, [
          'Report a problem',
        ]),
      ]),
      ...body,
    ];
  }

  function newView() {
    const entries = /** @type {[keyof TicketInput, string][]} */ (
      Object.entries(errors)
    );
    return [
      h('div', { class: 'top' }, [
        h('h2', { tabindex: '-1', 'data-heading': '' }, ['Report a problem']),
        h('span', { class: 'vendor' }, ['Acme Service Desk']),
      ]),
      entries.length > 0
        ? h(
            'div',
            {
              class: 'summary',
              role: 'alert',
              'aria-labelledby': 'hd-summary-title',
            },
            [
              h('h3', { id: 'hd-summary-title' }, ['There is a problem']),
              h(
                'ul',
                {},
                entries.map(([name, message]) =>
                  h('li', {}, [
                    h(
                      'a',
                      { href: `#hd-${name}`, 'data-focus': `hd-${name}` },
                      [message],
                    ),
                  ]),
                ),
              ),
            ],
          )
        : null,
      h('p', { role: 'alert', class: 'error', 'data-role': 'send-error' }, []),
      h(
        'form',
        {
          novalidate: true,
          'aria-labelledby': 'hd-form-title',
          'data-testid': 'helpdesk-form',
        },
        [
          h('h3', { id: 'hd-form-title', class: 'visually-hidden' }, [
            'New ticket',
          ]),
          field(
            'hd-category',
            'Category',
            select(CATEGORIES, form.category, 'category', 'Choose a category'),
          ),
          field(
            'hd-priority',
            'Priority',
            select(PRIORITIES, form.priority, 'priority'),
          ),
          field(
            'hd-summary',
            'Summary',
            h('input', {
              name: 'summary',
              type: 'text',
              value: form.summary,
              autocomplete: 'off',
              maxlength: '200',
            }),
            'One line, for example "Laptop does not charge".',
          ),
          (() => {
            const textarea = h('textarea', { name: 'description', rows: '4' });
            textarea.textContent = form.description;
            return field(
              'hd-description',
              'Details (optional)',
              textarea,
              'What happened, and since when?',
            );
          })(),
          h('div', { class: 'actions' }, [
            h(
              'button',
              { type: 'submit', class: 'primary', disabled: submitting },
              [submitting ? 'Sending…' : 'Send ticket'],
            ),
            h('button', { type: 'button', class: 'link', 'data-nav': '' }, [
              'Cancel',
            ]),
          ]),
        ],
      ),
    ];
  }

  function ticketView() {
    /** @type {(Node | string | null)[]} */
    const body = [];
    if (detail.state === 'loading')
      body.push(h('p', { role: 'status' }, ['Loading the ticket…']));
    else if (detail.state === 'error') {
      body.push(
        h('div', { role: 'alert', class: 'summary' }, [detail.message]),
        h('div', { class: 'actions' }, [
          h(
            'button',
            { type: 'button', class: 'secondary', 'data-action': 'retry' },
            ['Try again'],
          ),
        ]),
      );
    } else {
      const t = detail.ticket;
      body.push(
        h('dl', { 'data-testid': 'helpdesk-ticket-detail' }, [
          h('dt', {}, ['Ticket']),
          h('dd', {}, [t.id]),
          h('dt', {}, ['Summary']),
          h('dd', {}, [t.summary]),
          h('dt', {}, ['Status']),
          h('dd', {}, [STATUS_LABELS[t.status] ?? t.status]),
          h('dt', {}, ['Category']),
          h('dd', {}, [categoryLabel(t.category)]),
          h('dt', {}, ['Priority']),
          h('dd', {}, [
            PRIORITIES.find((p) => p.value === t.priority)?.label ?? t.priority,
          ]),
          h('dt', {}, ['Opened']),
          h('dd', {}, [formatDate(t.createdAt, props.locale)]),
          t.description ? h('dt', {}, ['Details']) : null,
          t.description ? h('dd', {}, [t.description]) : null,
        ]),
      );
    }
    return [
      h('div', { class: 'top' }, [
        h('h2', { tabindex: '-1', 'data-heading': '' }, [
          `Ticket ${route.view === 'ticket' ? route.id : ''}`,
        ]),
        h('span', { class: 'vendor' }, ['Acme Service Desk']),
      ]),
      ...body,
      h('p', {}, [
        h('a', { href: hostHref(props.basePath, ''), 'data-nav': '' }, [
          'Back to your tickets',
        ]),
      ]),
    ];
  }

  function render() {
    const content =
      route.view === 'new'
        ? newView()
        : route.view === 'ticket'
          ? ticketView()
          : listView();
    root.replaceChildren(
      h(
        'section',
        {
          class: 'widget',
          'aria-label': 'IT tickets',
          'data-testid': 'helpdesk-widget',
        },
        [
          h(
            'p',
            {
              role: 'status',
              class: notice ? 'notice' : '',
              'data-testid': 'helpdesk-notice',
            },
            [notice],
          ),
          ...content,
        ],
      ),
    );
  }

  /** Load what the current route needs; move focus to the new view's heading if asked. */
  function go(focus = false) {
    route = parseRoute(props.path);
    if (route.view === 'list') void loadList();
    else if (route.view === 'ticket') void loadTicket(route.id);
    else {
      errors = {};
      render();
    }
    if (focus)
      /** @type {HTMLElement | null} */ (
        root.querySelector('[data-heading]')
      )?.focus();
  }

  go();

  return {
    update(next) {
      const pathChanged = next.path !== props.path;
      props = next;
      if (pathChanged) {
        if (parseRoute(next.path).view !== 'ticket') notice = '';
        go(true);
      } else render();
    },
    unmount() {
      inflight?.abort();
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
      root.removeEventListener('change', onInput);
      root.removeEventListener('submit', onSubmit);
      host.remove();
    },
  };
}

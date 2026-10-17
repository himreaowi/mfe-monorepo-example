// @ts-check
/**
 * DEV ONLY example vendor module: "Bright Payments" checkout, format "web-component".
 *   { "url": "http://localhost:3990/payments/2.3.1/element.js", "format": "web-component",
 *     "tagName": "bright-checkout", "config": { "description": "…", "amount": 1500 } }
 *
 * Plays a vendor product built without React and without access to our repo. The host
 * assigns `element.props` (mount contract props) and re-assigns them on every update. Instead of
 * calling `props.onEvent` / `onNavigate` / `onError`, this element dispatches the contract's
 * CustomEvents (`external:event`, `external:navigate`, `external:error`; bubbles + composed),
 * the alternative the contract offers to web components.
 *
 * - checkout ('' path): bill from `props.config`, choice of payment method, "Pay"
 * - receipt ('receipt/<reference>'): after a payment, via the host router
 * - events: `payment:completed { reference, amount, currency, method, description }`
 * - invalid `config` → fatal `external:error` (the host shows its fallback)
 */
import {
  METHODS,
  createReference,
  formatAmount,
  parseRoute,
  readBill,
} from './payment.js';

/** @typedef {import('@org/vendor-kit/contract').MountProps} MountProps */
/** @typedef {import('./payment.js').Payment} Payment */

export const contractVersion = '1.0.0';
export const TAG_NAME = 'bright-checkout';
const PROCESSING_MS = 400;

const CSS = `
:host { display: block; font-family: var(--font-sans, system-ui, sans-serif); color: var(--color-text, #0f172a); line-height: 1.5; }
* { box-sizing: border-box; }
.card { display: grid; gap: 1rem; padding: 1rem; border: 1px solid var(--color-border, #cbd5e1); border-radius: var(--radius, 6px); background: var(--color-surface, #fff); max-width: 40rem; }
.top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0.25rem 1rem; }
h2 { margin: 0; font-size: 1.25rem; }
h2:focus { outline: none; }
h2:focus-visible { outline: 3px solid var(--color-accent, #0f766e); outline-offset: 2px; }
p { margin: 0; }
.brand { font-size: 0.8125rem; color: var(--color-text-muted, #475569); }
.bill { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem; padding: 0.75rem; border-radius: var(--radius, 6px); background: var(--color-bg, #f1f5f4); }
.amount { font-size: 1.25rem; font-weight: 700; }
fieldset { margin: 0; padding: 0; border: 0; display: grid; gap: 0.5rem; }
legend { font-weight: 600; margin-bottom: 0.5rem; padding: 0; }
.option { display: grid; grid-template-columns: auto 1fr; gap: 0 0.75rem; align-items: start; padding: 0.75rem; border: 1px solid var(--color-border, #cbd5e1); border-radius: var(--radius, 6px); cursor: pointer; }
.option input { width: 1.25rem; height: 1.25rem; margin: 0.15rem 0 0; accent-color: var(--color-accent, #0f766e); }
.option .hint { grid-column: 2; font-size: 0.875rem; color: var(--color-text-muted, #475569); }
.option:has(input:checked) { border: 2px solid var(--color-accent, #0f766e); }
.error { color: var(--color-danger, #b91c1c); font-weight: 600; }
button { font: inherit; min-height: 2.75rem; padding: 0.5rem 1.25rem; border-radius: var(--radius, 6px); cursor: pointer; }
.pay { background: var(--color-accent, #0f766e); color: var(--color-accent-contrast, #ecfdf5); border: 1px solid var(--color-accent, #0f766e); font-weight: 600; }
.link { background: none; border: 0; padding: 0; min-height: 24px; color: var(--color-accent, #0f766e); text-decoration: underline; font-weight: 600; }
button:focus-visible, input:focus-visible { outline: 3px solid var(--color-accent, #0f766e); outline-offset: 2px; }
button[disabled] { opacity: 0.6; cursor: progress; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; margin: 0; }
dt { color: var(--color-text-muted, #475569); }
dd { margin: 0; overflow-wrap: anywhere; }
p[role='status']:empty { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.success { padding: 0.75rem 1rem; border-left: 4px solid var(--color-accent, #0f766e); background: var(--color-bg, #f1f5f4); font-weight: 600; }
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

/** Payments made in this page (the receipt route reads them). @type {Map<string, Payment>} */
const payments = new Map();
let sequence = 0;

class BrightCheckout extends HTMLElement {
  static contractVersion = contractVersion;
  /** @type {MountProps | undefined} */
  #props;
  /** @type {ShadowRoot} */
  #root;
  #method = '';
  #methodError = '';
  #processing = false;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #timer;
  #lastPath = '';
  #fatalReported = false;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    if (
      'adoptedStyleSheets' in this.#root &&
      typeof CSSStyleSheet === 'function'
    ) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      this.#root.adoptedStyleSheets = [sheet];
    }
    this.#root.addEventListener('click', (event) => this.#onClick(event));
    this.#root.addEventListener('change', (event) => this.#onChange(event));
  }

  /** @param {MountProps | undefined} value */
  set props(value) {
    const pathChanged = value !== undefined && value.path !== this.#lastPath;
    this.#props = value;
    if (!value || !this.isConnected) return;
    this.#render();
    if (pathChanged) {
      this.#lastPath = value.path;
      /** @type {HTMLElement | null} */ (
        this.#root.querySelector('h2')
      )?.focus();
    }
  }

  get props() {
    return this.#props;
  }

  connectedCallback() {
    if (this.#props) {
      this.#lastPath = this.#props.path;
      this.#render();
    }
  }

  disconnectedCallback() {
    clearTimeout(this.#timer);
  }

  /** @param {string} type @param {unknown} detail */
  #emit(type, detail) {
    this.dispatchEvent(
      new CustomEvent(type, { detail, bubbles: true, composed: true }),
    );
  }

  /** @param {Event} event */
  #onChange(event) {
    const input = /** @type {HTMLInputElement} */ (event.target);
    if (input.name === 'method') {
      this.#method = input.value;
      this.#methodError = '';
    }
  }

  /** @param {Event} event */
  #onClick(event) {
    const target = /** @type {HTMLElement} */ (event.target);
    const action = target.closest('[data-action]')?.getAttribute('data-action');
    if (action === 'pay') this.#pay();
    if (action === 'back') this.#emit('external:navigate', { to: '' });
  }

  #pay() {
    const props = this.#props;
    if (!props || this.#processing) return;
    const result = readBill(props.config);
    if (!result.ok) return;
    if (!this.#method) {
      this.#methodError = 'Choose how you want to pay';
      this.#render();
      /** @type {HTMLElement | null} */ (
        this.#root.querySelector('input[name="method"]')
      )?.focus();
      return;
    }
    this.#processing = true;
    this.#render();
    this.#timer = setTimeout(() => {
      sequence += 1;
      /** @type {Payment} */
      const payment = {
        reference: createReference(new Date(), sequence),
        amount: result.bill.amount,
        currency: result.bill.currency,
        method: this.#method,
        description: result.bill.description,
        paidAt: new Date().toISOString(),
      };
      payments.set(payment.reference, payment);
      this.#processing = false;
      this.#method = '';
      this.#emit('external:event', {
        name: 'payment:completed',
        detail: payment,
      });
      this.#emit('external:navigate', { to: `receipt/${payment.reference}` });
    }, PROCESSING_MS);
  }

  #render() {
    const props = this.#props;
    if (!props) return;
    const result = readBill(props.config);
    if (!result.ok) {
      if (!this.#fatalReported) {
        this.#fatalReported = true;
        this.#emit('external:error', {
          code: 'invalid-config',
          message: result.message,
          fatal: true,
        });
      }
      this.#root.replaceChildren();
      return;
    }
    const { bill } = result;
    const route = parseRoute(props.path);
    const amount = formatAmount(bill.amount, bill.currency, props.locale);
    const header = (/** @type {string} */ title) =>
      h('div', { class: 'top' }, [
        h('h2', { tabindex: '-1' }, [title]),
        h('span', { class: 'brand' }, ['Secured by Bright Payments']),
      ]);

    if (route.view === 'receipt') {
      const payment = payments.get(route.reference);
      this.#root.replaceChildren(
        h(
          'section',
          {
            class: 'card',
            'aria-label': 'Payment receipt',
            'data-testid': 'bright-receipt',
          },
          [
            header('Payment receipt'),
            h('p', { class: 'success' }, [
              payment
                ? `Paid ${formatAmount(payment.amount, payment.currency, props.locale)}`
                : 'Payment received',
            ]),
            h('dl', {}, [
              h('dt', {}, ['Reference']),
              h('dd', { 'data-testid': 'bright-reference' }, [route.reference]),
              ...(payment
                ? [
                    h('dt', {}, ['For']),
                    h('dd', {}, [payment.description]),
                    h('dt', {}, ['Method']),
                    h('dd', {}, [
                      METHODS.find((m) => m.value === payment.method)?.label ??
                        payment.method,
                    ]),
                  ]
                : [
                    h('dt', {}, ['Details']),
                    h('dd', {}, ['A copy of the receipt was sent by email.']),
                  ]),
            ]),
            h('p', {}, [
              h(
                'button',
                { type: 'button', class: 'link', 'data-action': 'back' },
                ['Make another payment'],
              ),
            ]),
          ],
        ),
      );
      return;
    }

    const who = props.user
      ? `Paying as ${props.user.name ?? props.user.id}`
      : 'Paying as a guest';
    const errorId = 'bp-method-error';
    this.#root.replaceChildren(
      h(
        'section',
        {
          class: 'card',
          'aria-label': 'Checkout',
          'data-testid': 'bright-checkout',
        },
        [
          header(bill.title),
          h('div', { class: 'bill' }, [
            h('span', {}, [bill.description]),
            h('span', { class: 'amount', 'data-testid': 'bright-amount' }, [
              amount,
            ]),
          ]),
          h('p', { class: 'brand' }, [who]),
          h(
            'fieldset',
            { 'aria-describedby': this.#methodError ? errorId : undefined },
            [
              h('legend', {}, ['How do you want to pay?']),
              this.#methodError
                ? h('p', { class: 'error', id: errorId, role: 'alert' }, [
                    this.#methodError,
                  ])
                : null,
              ...METHODS.map((m) =>
                h('label', { class: 'option' }, [
                  h('input', {
                    type: 'radio',
                    name: 'method',
                    value: m.value,
                    checked: this.#method === m.value,
                  }),
                  h('span', {}, [m.label]),
                  h('span', { class: 'hint' }, [m.hint]),
                ]),
              ),
            ],
          ),
          h('div', {}, [
            h(
              'button',
              {
                type: 'button',
                class: 'pay',
                'data-action': 'pay',
                disabled: this.#processing,
              },
              [this.#processing ? 'Processing payment…' : `Pay ${amount}`],
            ),
          ]),
          h('p', { role: 'status' }, [
            this.#processing ? 'Processing your payment, please wait.' : '',
          ]),
        ],
      ),
    );
  }
}

if (!customElements.get(TAG_NAME))
  customElements.define(TAG_NAME, BrightCheckout);

// @ts-check
/**
 * "Acme Service Desk" vendor: pure helpers (no DOM), unit tested with node --test.
 */

export const CATEGORIES = [
  { value: 'hardware', label: 'Hardware (laptop, monitor, phone)' },
  { value: 'software', label: 'Software or apps' },
  { value: 'access', label: 'Accounts and access' },
  { value: 'other', label: 'Something else' },
];

export const PRIORITIES = [
  { value: 'low', label: 'Low: it can wait' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High: I cannot work' },
];

export const STATUS_LABELS = {
  open: 'Open',
  'in-progress': 'In progress',
  resolved: 'Resolved',
};

/**
 * @typedef {{ id: string, category: string, priority: string, summary: string,
 *   description: string, status: keyof typeof STATUS_LABELS, createdAt: string,
 *   updatedAt: string }} Ticket
 * @typedef {{ category: string, priority: string, summary: string, description: string }} TicketInput
 */

/**
 * Field errors for a new ticket (same rules as the vendor API).
 * @param {TicketInput} input
 * @returns {Partial<Record<keyof TicketInput, string>>}
 */
export function validateTicket(input) {
  /** @type {Partial<Record<keyof TicketInput, string>>} */
  const errors = {};
  if (!CATEGORIES.some((c) => c.value === input.category)) {
    errors.category = 'Choose a category';
  }
  if (!PRIORITIES.some((p) => p.value === input.priority)) {
    errors.priority = 'Choose a priority';
  }
  const summary = input.summary.trim();
  if (summary.length === 0) errors.summary = 'Enter a summary';
  else if (summary.length < 5)
    errors.summary = 'Summary must be at least 5 characters';
  else if (summary.length > 120)
    errors.summary = 'Summary must be 120 characters or fewer';
  if (input.description.trim().length > 2000) {
    errors.description = 'Description must be 2000 characters or fewer';
  }
  return errors;
}

/** Label of a category value. @param {string} value */
export function categoryLabel(value) {
  return (
    CATEGORIES.find((c) => c.value === value)?.label.split(' (')[0] ?? value
  );
}

/** Short date in the user's locale. @param {string} iso @param {string} locale */
export function formatDate(iso, locale) {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
      new Date(iso),
    );
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * The vendor's own routes on `props.path`.
 * @param {string} path
 * @returns {{ view: 'list' } | { view: 'new' } | { view: 'ticket', id: string }}
 */
export function parseRoute(path) {
  if (path === 'new') return { view: 'new' };
  const ticket = /^tickets\/([A-Za-z0-9-]+)$/.exec(path);
  if (ticket) return { view: 'ticket', id: ticket[1] };
  return { view: 'list' };
}

/**
 * The API base URL from the vendor config (`props.config.apiBaseUrl`, set per environment in
 * the host's manifest). Throws a readable error when it is missing.
 * @param {Readonly<Record<string, unknown>>} config
 */
export function apiBaseUrl(config) {
  const value = config.apiBaseUrl;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Acme Service Desk: config.apiBaseUrl is not set');
  }
  return value.replace(/\/+$/, '');
}

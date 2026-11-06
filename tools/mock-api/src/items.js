// @ts-check
/**
 * Example resource: `/items`. The generated remotes' demo feature lists and creates items, so
 * a new team sees the whole pattern (apiRoutes → http client → api/ → hooks/ → UI, 422 field
 * errors on a form). Replace or extend with your own resources (see README).
 */
import { json, notFound, validationError } from './server.js';

/** @typedef {import('./server.js').MockResource} MockResource */
/** @typedef {{ id: number, name: string, description: string, uen?: string }} Item */

export const NAME_MAX_LENGTH = 80;

/**
 * UEN shapes (business, local company, other entities). A rough copy of the rule the business
 * form checks in the browser: a real backend applies the same rules itself, the browser check is
 * only fast feedback.
 */
const UEN = /^(\d{8}[A-Z]|\d{9}[A-Z]|[TSR]\d{2}[A-Z]{2}\d{4}[A-Z])$/;

/** @param {string} zone @returns {Item[]} */
function seed(zone) {
  return [
    {
      id: 1,
      name: 'Getting started',
      description: `Served by the ${zone} mock API (tools/mock-api).`,
    },
    {
      id: 2,
      name: 'Loading and error states',
      description:
        'MOCK_API_DELAY=800 pnpm dev:<zone> slows every response down.',
    },
    {
      id: 3,
      name: 'Replace me',
      description:
        'Point settings.apiBaseUrl at your real API per environment.',
    },
  ];
}

/**
 * @param {string} zone
 * @returns {MockResource}
 */
export function createItemsResource(zone) {
  /** @type {Item[]} */
  let items = seed(zone);
  return {
    reset() {
      items = seed(zone);
    },
    routes: [
      {
        method: 'GET',
        path: '/items',
        handler: ({ query }) => {
          const q = (query.get('q') ?? '').trim().toLowerCase();
          return json(
            200,
            q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items,
          );
        },
      },
      {
        method: 'GET',
        path: '/items/:id',
        handler: ({ params }) => {
          const item = items.find((i) => String(i.id) === params.id);
          return item ? json(200, item) : notFound(`No item ${params.id}`);
        },
      },
      {
        method: 'POST',
        path: '/items',
        handler: ({ body }) => {
          const input =
            /** @type {{ name?: unknown, description?: unknown, uen?: unknown }} */ (
              body ?? {}
            );
          const name = typeof input.name === 'string' ? input.name.trim() : '';
          /** @type {Record<string, string>} */
          const errors = {};
          if (!name) errors.name = 'Enter a name.';
          else if (name.length > NAME_MAX_LENGTH)
            errors.name = `Use ${NAME_MAX_LENGTH} characters or fewer.`;
          else if (
            items.some((i) => i.name.toLowerCase() === name.toLowerCase())
          )
            errors.name = 'An item with this name already exists.';
          // optional (other remotes post items without one); malformed is rejected
          const uen =
            typeof input.uen === 'string' ? input.uen.trim().toUpperCase() : '';
          if (input.uen !== undefined && input.uen !== '' && !UEN.test(uen))
            errors.uen = 'Enter a valid UEN.';
          if (Object.keys(errors).length > 0) return validationError(errors);
          const item = {
            id: Math.max(0, ...items.map((i) => i.id)) + 1,
            name,
            description:
              typeof input.description === 'string' ? input.description : '',
            ...(uen ? { uen } : {}),
          };
          items = [...items, item];
          return json(201, item);
        },
      },
    ],
  };
}

// @ts-check
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
/** @type {typeof import('../fetch.d.ts')} */
const { createFakeFetch, jsonResponse } = require('../fetch.cjs');

describe('jsonResponse', () => {
  it('builds a JSON response with status and url', async () => {
    const res = jsonResponse({ a: 1 }, { status: 201, url: 'http://x.test/a' });
    assert.equal(res.status, 201);
    assert.equal(res.url, 'http://x.test/a');
    assert.equal(res.headers.get('content-type'), 'application/json');
    assert.deepEqual(await res.json(), { a: 1 });
  });

  it('uses a null body for 204', async () => {
    const res = jsonResponse(undefined, { status: 204 });
    assert.equal(await res.text(), '');
  });
});

describe('createFakeFetch', () => {
  const fetch = createFakeFetch({
    'GET /api/items': { body: [{ id: 1 }] },
    'POST /api/items': ({ body }) =>
      /** @type {{ name?: string }} */ (body).name
        ? { status: 201, body }
        : { status: 422, body: { errors: { name: 'Required' } } },
  });

  it('answers from the route table and records calls', async () => {
    const res = await fetch('http://api.test/api/items?q=a');
    assert.deepEqual(await res.json(), [{ id: 1 }]);
    assert.equal(fetch.calls[0].pathname, '/api/items');
    assert.equal(fetch.calls[0].query.get('q'), 'a');
  });

  it('passes the parsed JSON body to route functions', async () => {
    const bad = await fetch('/api/items', { method: 'POST', body: '{}' });
    assert.equal(bad.status, 422);
    const ok = await fetch('/api/items', {
      method: 'POST',
      body: JSON.stringify({ name: 'x' }),
    });
    assert.equal(ok.status, 201);
  });

  it('answers 404 for unknown routes and rejects aborted requests', async () => {
    assert.equal((await fetch('/nope')).status, 404);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      fetch('/api/items', { signal: controller.signal }),
      /** @param {Error} e */ (e) => e.name === 'AbortError',
    );
  });
});

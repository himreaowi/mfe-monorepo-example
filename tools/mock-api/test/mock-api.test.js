// @ts-check
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createMockApi, mockApiPort } from '../src/index.js';
import { matchPath } from '../src/server.js';

/** @param {string} zone */
function startZone(zone, options = {}) {
  const server = createMockApi(zone, options);
  const ctx = {
    origin: '',
    /** @param {string} path @param {RequestInit} [init] */
    call: async (path, init = {}) => {
      const res = await fetch(`${ctx.origin}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init.headers },
      });
      const text = await res.text();
      return { res, body: text ? JSON.parse(text) : undefined };
    },
  };
  before(async () => {
    await new Promise((resolve) => server.listen(0, () => resolve(undefined)));
    const address = server.address();
    ctx.origin = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`;
  });
  beforeEach(() => ctx.call('/__reset', { method: 'POST' }));
  after(() => server.close());
  return ctx;
}

describe('helpers', () => {
  it('matches path patterns', () => {
    assert.deepEqual(matchPath('/items/:id', '/items/42'), { id: '42' });
    assert.equal(matchPath('/items/:id', '/items'), null);
    assert.equal(matchPath('/items', '/other'), null);
  });

  it('uses the zone tools ports', () => {
    assert.equal(mockApiPort('intranet'), 3190);
    assert.equal(mockApiPort('internet'), 3290);
    assert.throws(() => mockApiPort('extranet'), /unknown zone/);
  });
});

describe('mock API (intranet)', () => {
  const api = startZone('intranet');

  it('answers /api/health', async () => {
    const { res, body } = await api.call('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(body, { ok: true, zone: 'intranet' });
  });

  it('lists, filters and reads items', async () => {
    const all = await api.call('/api/items');
    assert.equal(all.res.status, 200);
    assert.ok(all.body.length >= 3);
    const filtered = await api.call('/api/items?q=getting');
    assert.deepEqual(
      filtered.body.map((/** @type {{ id: number }} */ i) => i.id),
      [1],
    );
    assert.equal((await api.call('/api/items/1')).body.name, 'Getting started');
    assert.equal((await api.call('/api/items/999')).res.status, 404);
  });

  it('creates items and answers 422 with field errors', async () => {
    const bad = await api.call('/api/items', {
      method: 'POST',
      body: JSON.stringify({ name: '  ' }),
    });
    assert.equal(bad.res.status, 422);
    assert.deepEqual(bad.body.errors, { name: 'Enter a name.' });
    const dup = await api.call('/api/items', {
      method: 'POST',
      body: JSON.stringify({ name: 'getting started' }),
    });
    assert.match(dup.body.errors.name, /already exists/);
    const ok = await api.call('/api/items', {
      method: 'POST',
      body: JSON.stringify({ name: 'New one' }),
    });
    assert.equal(ok.res.status, 201);
    assert.equal(ok.body.name, 'New one');
    assert.equal((await api.call(`/api/items/${ok.body.id}`)).res.status, 200);
  });

  it('POST /__reset restores the seed', async () => {
    await api.call('/api/items', {
      method: 'POST',
      body: JSON.stringify({ name: 'Temporary' }),
    });
    await api.call('/__reset', { method: 'POST' });
    const { body } = await api.call('/api/items?q=temporary');
    assert.deepEqual(body, []);
  });

  it('CORS: echoes localhost origins with credentials, ignores others', async () => {
    const local = await api.call('/api/items', {
      headers: { Origin: 'http://localhost:3101' },
    });
    assert.equal(
      local.res.headers.get('access-control-allow-origin'),
      'http://localhost:3101',
    );
    assert.equal(
      local.res.headers.get('access-control-allow-credentials'),
      'true',
    );
    const foreign = await api.call('/api/items', {
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(foreign.res.headers.get('access-control-allow-origin'), null);
    const preflight = await fetch(`${api.origin}/api/items`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3101',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-csrf-token',
      },
    });
    assert.equal(preflight.status, 204);
    assert.match(
      preflight.headers.get('access-control-allow-headers') ?? '',
      /X-CSRF-Token/,
    );
  });

  it('rejects bad bodies, unknown routes and wrong methods', async () => {
    const bad = await api.call('/api/items', { method: 'POST', body: '{' });
    assert.equal(bad.res.status, 400);
    assert.equal((await api.call('/api/nope')).res.status, 404);
    assert.equal((await api.call('/nope')).res.status, 404);
    assert.equal(
      (await api.call('/api/items/1', { method: 'POST' })).res.status,
      405,
    );
  });
});

describe('mock API (internet)', () => {
  const api = startZone('internet', { delayMs: 5 });

  it('is a separate instance per zone', async () => {
    assert.equal((await api.call('/api/health')).body.zone, 'internet');
    const { body } = await api.call('/api/items/1');
    assert.match(body.description, /internet mock API/);
  });
});

// @ts-check
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { countWorkingDays, isIsoDate } from '../src/dates.js';
import { createMockApi } from '../src/index.js';
import { matchPath } from '../src/server.js';

/** @param {string} zone */
function startZone(zone) {
  const server = createMockApi(zone);
  const ctx = {
    base: '',
    /** @param {string} path @param {RequestInit} [init] */
    call: async (path, init = {}) => {
      const res = await fetch(`${ctx.base}${path}`, {
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
    ctx.base = `http://localhost:${typeof address === 'object' && address ? address.port : 0}/api`;
  });
  beforeEach(() => ctx.call('/__reset', { method: 'POST' }));
  after(() => server.close());
  return ctx;
}

/** ISO date `days` from today (UTC). @param {number} days */
function inDays(days) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Next Monday at least a week ahead, so ranges never hit "in the past". */
function nextMonday() {
  const date = new Date(Date.now() + 7 * 86_400_000);
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

describe('helpers', () => {
  it('matches path patterns', () => {
    assert.deepEqual(matchPath('/staff/:id', '/staff/s-1001'), {
      id: 's-1001',
    });
    assert.equal(matchPath('/staff/:id', '/staff'), null);
    assert.equal(matchPath('/staff', '/leave'), null);
  });

  it('counts working days and validates dates', () => {
    assert.equal(countWorkingDays('2026-10-19', '2026-10-25'), 5); // Mon–Sun
    assert.equal(countWorkingDays('2026-10-24', '2026-10-25'), 0); // weekend
    assert.equal(countWorkingDays('2026-10-20', '2026-10-19'), 0);
    assert.equal(isIsoDate('2026-02-30'), false);
    assert.equal(isIsoDate('2026-02-28'), true);
  });
});

describe('intranet API', () => {
  const api = startZone('intranet');

  it('answers CORS for local origins with credentials', async () => {
    const res = await fetch(`${api.base}/staff`, {
      headers: { Origin: 'http://localhost:3101' },
    });
    assert.equal(
      res.headers.get('access-control-allow-origin'),
      'http://localhost:3101',
    );
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
    const other = await fetch(`${api.base}/staff`, {
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(other.headers.get('access-control-allow-origin'), null);
    const preflight = await fetch(`${api.base}/leave/requests`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3100' },
    });
    assert.equal(preflight.status, 204);
    assert.match(
      preflight.headers.get('access-control-allow-headers') ?? '',
      /X-CSRF-Token/,
    );
  });

  it('searches staff and returns details', async () => {
    const all = await api.call('/staff');
    assert.equal(all.body.total, 24);
    assert.ok(all.body.departments.includes('Technology'));
    const found = await api.call('/staff?q=security');
    assert.deepEqual(
      found.body.items.map((/** @type {{ name: string }} */ s) => s.name),
      ['Priya Nair'],
    );
    const byDept = await api.call(
      `/staff?department=${encodeURIComponent('Legal')}`,
    );
    assert.equal(byDept.body.total, 2);
    const detail = await api.call('/staff/s-1016');
    assert.equal(detail.body.manager.name, 'Oliver Chan');
    assert.ok(Array.isArray(detail.body.skills));
    assert.equal((await api.call('/staff/nope')).res.status, 404);
  });

  it('computes the leave balance from requests', async () => {
    const { body } = await api.call('/leave/balance');
    const annual = body.balances.find(
      (/** @type {{ type: string }} */ b) => b.type === 'annual',
    );
    assert.deepEqual(
      {
        taken: annual.taken,
        pending: annual.pending,
        remaining: annual.remaining,
      },
      { taken: 7, pending: 4, remaining: 7 },
    );
  });

  it('rejects invalid leave requests with field errors', async () => {
    const empty = await api.call('/leave/requests', {
      method: 'POST',
      body: '{}',
    });
    assert.equal(empty.res.status, 422);
    assert.deepEqual(Object.keys(empty.body.errors).sort(), [
      'endDate',
      'startDate',
      'type',
    ]);
    const past = await api.call('/leave/requests', {
      method: 'POST',
      body: JSON.stringify({
        type: 'annual',
        startDate: '2020-01-06',
        endDate: '2020-01-06',
      }),
    });
    assert.match(past.body.errors.startDate, /today or later/);
    const start = nextMonday();
    const tooMany = await api.call('/leave/requests', {
      method: 'POST',
      body: JSON.stringify({
        type: 'childcare',
        startDate: start,
        endDate: inDays(40),
      }),
    });
    assert.match(tooMany.body.errors.endDate, /days of childcare leave left/);
  });

  it('creates a leave request and updates the balance', async () => {
    const start = nextMonday();
    const created = await api.call('/leave/requests', {
      method: 'POST',
      body: JSON.stringify({
        type: 'annual',
        startDate: start,
        endDate: start,
        reason: ' Dentist ',
      }),
    });
    assert.equal(created.res.status, 201);
    assert.equal(created.body.status, 'pending');
    assert.equal(created.body.days, 1);
    assert.equal(created.body.reason, 'Dentist');
    const list = await api.call('/leave/requests');
    assert.equal(list.body.items[0].id, created.body.id);
    const { body } = await api.call('/leave/balance');
    const annual = body.balances.find(
      (/** @type {{ type: string }} */ b) => b.type === 'annual',
    );
    assert.equal(annual.pending, 5);
  });

  it('serves the helpdesk vendor API', async () => {
    const list = await api.call('/helpdesk/tickets');
    assert.equal(list.body.items.length, 3);
    const invalid = await api.call('/helpdesk/tickets', {
      method: 'POST',
      body: '{}',
    });
    assert.equal(invalid.res.status, 422);
    const created = await api.call('/helpdesk/tickets', {
      method: 'POST',
      body: JSON.stringify({
        category: 'hardware',
        priority: 'high',
        summary: 'Monitor flickers',
      }),
    });
    assert.equal(created.res.status, 201);
    assert.equal(
      (await api.call(`/helpdesk/tickets/${created.body.id}`)).body.summary,
      'Monitor flickers',
    );
  });

  it('answers 404, 405 and bad JSON clearly', async () => {
    assert.equal((await api.call('/nope')).res.status, 404);
    assert.equal(
      (await api.call('/staff', { method: 'POST', body: '{}' })).res.status,
      405,
    );
    assert.equal(
      (await api.call('/leave/requests', { method: 'POST', body: '{' })).res
        .status,
      400,
    );
  });
});

describe('internet API', () => {
  const api = startZone('internet');

  it('lists and filters services, returns details', async () => {
    const all = await api.call('/services');
    assert.equal(all.body.total, 10);
    const transport = await api.call(
      `/services?category=${encodeURIComponent('Transport')}`,
    );
    assert.equal(transport.body.total, 3);
    const dog = await api.call('/services?q=dog');
    assert.equal(dog.body.items[0].slug, 'renew-dog-licence');
    const detail = await api.call('/services/renew-dog-licence');
    assert.deepEqual(detail.body.fee, { amount: 1500, currency: 'SGD' });
    assert.equal((await api.call('/services/nope')).res.status, 404);
  });

  it('lists announcements without bodies and returns one with body', async () => {
    const list = await api.call('/announcements');
    assert.equal(list.body.items.length, 5);
    assert.equal(list.body.items[0].body, undefined);
    const one = await api.call(`/announcements/${list.body.items[0].id}`);
    assert.ok(one.body.body.length > 0);
  });

  it('returns the profile and updates preferences only with the CSRF token', async () => {
    const me = await api.call('/profile/me');
    assert.equal(me.body.id, 'mock-user-1');
    const prefs = JSON.stringify({ emailUpdates: false, smsReminders: true });
    const denied = await api.call('/profile/me/preferences', {
      method: 'PUT',
      body: prefs,
    });
    assert.equal(denied.res.status, 403);
    const ok = await api.call('/profile/me/preferences', {
      method: 'PUT',
      body: prefs,
      headers: { 'X-CSRF-Token': 'mock-csrf-token' },
    });
    assert.equal(ok.res.status, 200);
    assert.deepEqual(ok.body.preferences, {
      emailUpdates: false,
      smsReminders: true,
    });
    const invalid = await api.call('/profile/me/preferences', {
      method: 'PUT',
      body: JSON.stringify({ emailUpdates: 'yes' }),
      headers: { 'X-CSRF-Token': 'mock-csrf-token' },
    });
    assert.equal(invalid.res.status, 422);
  });
});

// @ts-check
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { VENDORS, createServer } from '../bin/serve.js';
import {
  apiBaseUrl,
  categoryLabel,
  parseRoute as helpdeskRoute,
  validateTicket,
} from '../src/helpdesk/tickets.js';
import {
  createReference,
  formatAmount,
  parseRoute as paymentsRoute,
  readBill,
} from '../src/payments/payment.js';

describe('Acme Service Desk (helpdesk) helpers', () => {
  it('validates a new ticket like the vendor API', () => {
    assert.deepEqual(
      Object.keys(
        validateTicket({
          category: '',
          priority: 'urgent',
          summary: ' ',
          description: '',
        }),
      ).sort(),
      ['category', 'priority', 'summary'],
    );
    assert.match(
      validateTicket({
        category: 'hardware',
        priority: 'low',
        summary: 'abc',
        description: '',
      }).summary ?? '',
      /at least 5/,
    );
    assert.deepEqual(
      validateTicket({
        category: 'access',
        priority: 'high',
        summary: 'VPN does not connect',
        description: '',
      }),
      {},
    );
  });

  it('routes on props.path', () => {
    assert.deepEqual(helpdeskRoute(''), { view: 'list' });
    assert.deepEqual(helpdeskRoute('new'), { view: 'new' });
    assert.deepEqual(helpdeskRoute('tickets/HD-1042'), {
      view: 'ticket',
      id: 'HD-1042',
    });
    assert.deepEqual(helpdeskRoute('e2e/deep/link'), { view: 'list' });
  });

  it('reads the API base URL from config', () => {
    assert.equal(
      apiBaseUrl({ apiBaseUrl: 'http://localhost:3910/api/' }),
      'http://localhost:3910/api',
    );
    assert.throws(() => apiBaseUrl({}), /apiBaseUrl/);
    assert.equal(categoryLabel('hardware'), 'Hardware');
  });
});

describe('Bright Payments helpers', () => {
  it('validates the bill config', () => {
    assert.deepEqual(readBill({ amount: 1500, description: 'Dog licence' }), {
      ok: true,
      bill: {
        amount: 1500,
        currency: 'SGD',
        description: 'Dog licence',
        title: 'Pay',
      },
    });
    assert.equal(readBill({ amount: 12.5 }).ok, false);
    assert.equal(readBill({ amount: 100, currency: 'dollars' }).ok, false);
  });

  it('formats amounts and references, routes on props.path', () => {
    assert.equal(formatAmount(1500, 'SGD', 'en-SG'), 'SGD 15.00');
    assert.equal(
      createReference(new Date('2026-10-18T03:00:00Z'), 7),
      'BP-20261018-0007',
    );
    assert.deepEqual(paymentsRoute('receipt/BP-20261018-0007'), {
      view: 'receipt',
      reference: 'BP-20261018-0007',
    });
    assert.deepEqual(paymentsRoute('receipt/../../x'), { view: 'checkout' });
  });
});

describe('vendor CDN (dev server)', () => {
  const server = createServer(0);
  let base = '';
  before(async () => {
    await new Promise((resolve) => server.listen(0, () => resolve(undefined)));
    const address = server.address();
    base = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`;
  });
  after(() => server.close());

  it('serves each vendor on its versioned URL with CORS', async () => {
    for (const file of [
      `/helpdesk/${VENDORS.helpdesk}/mount.js`,
      `/helpdesk/${VENDORS.helpdesk}/tickets.js`,
      `/payments/${VENDORS.payments}/element.js`,
    ]) {
      const res = await fetch(base + file);
      assert.equal(res.status, 200, file);
      assert.equal(res.headers.get('access-control-allow-origin'), '*');
      assert.match(res.headers.get('content-type') ?? '', /text\/javascript/);
      await res.text();
    }
  });

  it('refuses unknown vendors, versions and paths', async () => {
    for (const file of [
      '/helpdesk/9.9.9/mount.js',
      '/nope/1.0.0/mount.js',
      '/helpdesk/1.0.0/../payments/element.js',
      '/helpdesk/1.0.0/missing.js',
    ]) {
      assert.equal((await fetch(base + file)).status, 404, file);
    }
  });
});

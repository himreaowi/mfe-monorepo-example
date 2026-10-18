// @ts-check
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, describe, it } from 'node:test';
import {
  VENDORS,
  ZONE_VENDORS,
  createServer,
  vendorPort,
} from '../bin/serve.js';
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
      apiBaseUrl({ apiBaseUrl: 'http://localhost:3190/api/' }),
      'http://localhost:3190/api',
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
  /** @param {import('node:http').Server} server */
  async function listen(server) {
    await new Promise((resolve) => server.listen(0, () => resolve(undefined)));
    const address = server.address();
    return `http://localhost:${typeof address === 'object' && address ? address.port : 0}`;
  }
  const server = createServer();
  let base = '';
  before(async () => {
    base = await listen(server);
  });
  after(() => server.close());

  it('runs one server per zone on the zone tools range, serving only its vendor', async () => {
    assert.equal(vendorPort('intranet'), 3192);
    assert.equal(vendorPort('internet'), 3292);
    assert.throws(() => vendorPort('extranet'), /unknown zone/);
    assert.deepEqual(ZONE_VENDORS, {
      intranet: ['helpdesk'],
      internet: ['payments'],
    });
    const intranet = createServer({ vendors: ZONE_VENDORS.intranet });
    const origin = await listen(intranet);
    try {
      const own = await fetch(
        `${origin}/helpdesk/${VENDORS.helpdesk}/mount.js`,
      );
      assert.equal(own.status, 200);
      await own.text();
      const other = await fetch(
        `${origin}/payments/${VENDORS.payments}/element.js`,
      );
      assert.equal(other.status, 404);
      await other.text();
    } finally {
      intranet.close();
    }
  });

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

describe('styles under the portal CSP (no style-src unsafe-inline)', () => {
  for (const file of [
    '../src/helpdesk/mount.js',
    '../src/payments/element.js',
  ]) {
    it(`${file}: constructable stylesheet, never a <style> element or style attribute`, () => {
      const src = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
      assert.match(src, /new CSSStyleSheet\(\)/);
      assert.match(src, /adoptedStyleSheets = \[sheet\]/);
      assert.doesNotMatch(src, /h\('style'|createElement\(['"]style['"]\)/);
      assert.doesNotMatch(src, /style="/);
    });
  }
});

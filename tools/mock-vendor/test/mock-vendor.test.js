// @ts-check
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createServer } from '../bin/serve.js';
import * as vendor from '../src/mount.js';

describe('mock vendor', () => {
  it('implements the contract shape (contract 1.x)', () => {
    assert.match(vendor.contractVersion, /^1\.\d+\.\d+$/);
    assert.equal(typeof vendor.mount, 'function');
  });

  describe('server', () => {
    const server = createServer(0);
    /** @type {string} */
    let base;
    before(async () => {
      await new Promise((r) => server.listen(0, () => r(undefined)));
      const address = server.address();
      base = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`;
    });
    after(() => server.close());

    it('serves the modules with CORS and a JavaScript MIME type', async () => {
      for (const file of ['/mount.js', '/element.js']) {
        const res = await fetch(base + file);
        assert.equal(res.status, 200, file);
        assert.equal(res.headers.get('access-control-allow-origin'), '*');
        assert.match(res.headers.get('content-type') ?? '', /text\/javascript/);
        assert.match(await res.text(), /contractVersion/);
      }
      assert.equal((await fetch(`${base}/../package.json`)).status, 404);
      assert.equal((await fetch(`${base}/nope.js`)).status, 404);
    });

    it('can simulate a vendor outage', async () => {
      await fetch(`${base}/__down`);
      assert.equal((await fetch(`${base}/mount.js`)).status, 503);
      await fetch(`${base}/__down?value=0`);
      assert.equal((await fetch(`${base}/mount.js`)).status, 200);
    });
  });
});

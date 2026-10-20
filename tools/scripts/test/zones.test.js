// @ts-check
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';
import {
  BASE_PATH,
  basePathsOverlap,
  shellBasePath,
  TOOL_SLOTS,
  ZONES,
  allToolPorts,
  readToolConfig,
  toolPort,
} from '../src/zones.js';

describe('zones', () => {
  it('port plan: proxy x00, shells x01-x09, remotes x10-x89, tools x90-x99', () => {
    for (const z of Object.values(ZONES)) {
      assert.equal(z.shells.first, z.proxy + 1);
      assert.equal(z.remotes.first, z.shells.last + 1);
      assert.equal(z.tools.first, z.remotes.last + 1);
    }
  });

  it('base paths: normalised, overlap rules', () => {
    assert.equal(shellBasePath(undefined), '/');
    assert.equal(shellBasePath('/citizen/'), '/citizen');
    assert.ok(BASE_PATH.test('/'));
    assert.ok(BASE_PATH.test('/business/eservices'));
    assert.ok(!BASE_PATH.test('/Citizen'));
    assert.ok(!BASE_PATH.test('/citizen/'));
    assert.ok(basePathsOverlap('/a', '/a'));
    assert.ok(basePathsOverlap('/a', '/a/b'));
    assert.ok(!basePathsOverlap('/a', '/ab'));
    assert.ok(!basePathsOverlap('/', '/a'));
    assert.ok(basePathsOverlap('/', '/'));
  });

  it('per-zone tool ports sit in the zone tools range, outside the app range', () => {
    assert.equal(toolPort('intranet', 'mockApi'), 3190);
    assert.equal(toolPort('intranet', 'mockVendor'), 3191);
    assert.equal(toolPort('internet', 'mockApi'), 3290);
    assert.equal(toolPort('internet', 'mockVendor'), 3291);
    for (const [zone, range] of Object.entries(ZONES)) {
      for (const tool of /** @type {const} */ (['mockApi', 'mockVendor'])) {
        const port = toolPort(/** @type {any} */ (zone), tool);
        assert.ok(port >= range.tools.first && port <= range.tools.last);
        assert.ok(port > range.remotes.last);
      }
    }
    assert.deepEqual(allToolPorts('mockVendor'), [3191, 3291]);
  });

  it('no two zones share a port', () => {
    const ranges = Object.values(ZONES).map((z) => [z.proxy, z.tools.last]);
    const [a, b] = ranges;
    assert.ok(a[1] < b[0] || b[1] < a[0]);
  });

  it('reads tool offsets from the root package.json of a workspace (mfe.tools)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mfe-zones-'));
    try {
      fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({
          mfe: {
            tools: {
              exampleVendor: { offset: 2, package: '@org/example-vendor' },
              broken: { offset: 12 },
            },
          },
        }),
      );
      assert.equal(toolPort('intranet', 'exampleVendor', root), 3192);
      assert.equal(toolPort('internet', 'exampleVendor', root), 3292);
      assert.deepEqual(allToolPorts('exampleVendor', root), [3192, 3292]);
      assert.throws(
        () => toolPort('intranet', 'mockApi', root),
        /Unknown dev tool "mockApi": declare it in .*package\.json under "mfe"/,
      );
      assert.throws(
        () => toolPort('intranet', 'broken', root),
        /"offset" must be an integer 0-9/,
      );
      assert.equal(TOOL_SLOTS, 10);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('@org/playwright-config reads the same tool ports (and mirrors the zone tool ranges)', async () => {
    const file = path.resolve(
      import.meta.dirname,
      '../../../packages/playwright-config/src/zone.js',
    );
    const { TOOL_PORTS, ZONE_TOOL_RANGES, ZONE_PORTS } = await import(
      pathToFileURL(file).href
    );
    assert.deepEqual(
      ZONE_PORTS,
      Object.fromEntries(
        Object.entries(ZONES).map(([zone, z]) => [
          zone,
          { proxy: z.proxy, tools: { ...z.tools } },
        ]),
      ),
    );
    assert.deepEqual(
      ZONE_TOOL_RANGES,
      Object.fromEntries(
        Object.entries(ZONES).map(([zone, z]) => [zone, { ...z.tools }]),
      ),
    );
    const declared = Object.keys(readToolConfig());
    assert.deepEqual(Object.keys(TOOL_PORTS).sort(), declared.sort());
    for (const tool of declared) {
      assert.deepEqual([...TOOL_PORTS[tool]], allToolPorts(tool));
    }
  });
});

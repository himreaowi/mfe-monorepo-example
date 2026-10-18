// @ts-check
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';
import { ZONES, allToolPorts, toolPort } from '../src/zones.js';

describe('zones', () => {
  it('per-zone tool ports sit in the zone tools range, outside the app range', () => {
    assert.equal(toolPort('intranet', 'mockApi'), 3190);
    assert.equal(toolPort('intranet', 'mockVendor'), 3191);
    assert.equal(toolPort('internet', 'mockApi'), 3290);
    assert.equal(toolPort('internet', 'mockVendor'), 3291);
    for (const [zone, range] of Object.entries(ZONES)) {
      for (const tool of /** @type {const} */ (['mockApi', 'mockVendor'])) {
        const port = toolPort(/** @type {any} */ (zone), tool);
        assert.ok(port >= range.tools.first && port <= range.tools.last);
        assert.ok(port > range.last);
      }
    }
    assert.deepEqual(allToolPorts('mockVendor'), [3191, 3291]);
  });

  it('no two zones share a port', () => {
    const ranges = Object.values(ZONES).map((z) => [z.first, z.tools.last]);
    const [a, b] = ranges;
    assert.ok(a[1] < b[0] || b[1] < a[0]);
  });

  it('@org/playwright-config mirrors the tool ports (packages cannot import tools)', async () => {
    const file = path.resolve(
      import.meta.dirname,
      '../../../packages/playwright-config/src/zone.js',
    );
    const { TOOL_PORTS } = await import(pathToFileURL(file).href);
    assert.deepEqual([...TOOL_PORTS.mockApi], allToolPorts('mockApi'));
    assert.deepEqual([...TOOL_PORTS.mockVendor], allToolPorts('mockVendor'));
  });
});

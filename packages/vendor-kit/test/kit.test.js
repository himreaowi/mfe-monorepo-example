// @ts-check
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { after, before, describe, it } from 'node:test';
import { buildKit } from '../scripts/build-kit.mjs';
import { isContractUpToDate } from '../scripts/contract-source.mjs';
import { zipDirectory } from '../scripts/zip.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-kit-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('vendor kit', () => {
  /** @type {{ kitVersion: string, contractVersion: string }} */
  let version;
  const out = path.join(tmp, 'kit');

  before(async () => {
    version = await buildKit(out);
  });

  it('contract/mount-contract.d.ts matches @org/mf-runtime (run generate:contract if not)', async () => {
    assert.equal(await isContractUpToDate(), true);
  });

  it('contains the contract, test host, examples and docs', () => {
    for (const rel of [
      'README.md',
      'CHECKLIST.md',
      'VERSION.json',
      'contract/mount-contract.d.ts',
      'test-host/index.html',
      'test-host/host.js',
      'test-host/csp.js',
      'test-host/host.css',
      'test-host/serve.mjs',
      'test-host/lib/load.js',
      'test-host/lib/contract.js',
      'examples/vanilla/mount.js',
      'examples/web-component/element.js',
    ]) {
      assert.ok(fs.existsSync(path.join(out, rel)), `missing ${rel}`);
    }
    const v = JSON.parse(
      fs.readFileSync(path.join(out, 'VERSION.json'), 'utf8'),
    );
    assert.equal(v.contractVersion, version.contractVersion);
    assert.match(version.contractVersion, /^\d+\.\d+\.\d+$/);
    assert.match(
      fs.readFileSync(path.join(out, 'CHECKLIST.md'), 'utf8'),
      /WCAG 2\.2 AA/,
    );
  });

  it('lib/*.js are plain ES modules that run in a browser (and Node)', async () => {
    const load = fs.readFileSync(
      path.join(out, 'test-host/lib/load.js'),
      'utf8',
    );
    assert.match(load, /from '\.\/contract\.js'/);
    assert.doesNotMatch(load, /from '\.\/config'/); // type-only import erased
    assert.doesNotMatch(load, /: (string|number|unknown)\b[,)]/); // no TS annotations left
    const contract = await import(
      pathToFileURL(path.join(out, 'test-host/lib/contract.js')).href
    );
    assert.equal(contract.MOUNT_CONTRACT_VERSION, version.contractVersion);
    assert.equal(
      contract.isCompatibleContractVersion('1.9.0'),
      version.contractVersion.startsWith('1.'),
    );
    const lib = await import(
      pathToFileURL(path.join(out, 'test-host/lib/load.js')).href
    );
    const mod = lib.toExternalModule(
      {
        contractVersion: version.contractVersion,
        mount: () => ({ unmount() {} }),
      },
      'x',
    );
    assert.equal(typeof mod.mount, 'function');
    assert.throws(
      () =>
        lib.toExternalModule({ contractVersion: '99.0.0', mount() {} }, 'x'),
      /major version must match/,
    );
  });

  it('the example module satisfies the contract shape', async () => {
    const example = await import(
      pathToFileURL(path.join(out, 'examples/vanilla/mount.js')).href
    );
    assert.equal(example.contractVersion, version.contractVersion);
    assert.equal(typeof example.mount, 'function');
  });

  it('packs a valid zip', () => {
    const zipFile = path.join(tmp, 'kit.zip');
    const names = zipDirectory(out, zipFile, 'org-vendor-kit-test');
    const buf = fs.readFileSync(zipFile);
    // end of central directory
    const eocd = buf.length - 22;
    assert.equal(buf.readUInt32LE(eocd), 0x06054b50);
    assert.equal(buf.readUInt16LE(eocd + 10), names.length);
    // walk the central directory and inflate every entry
    let p = buf.readUInt32LE(eocd + 16);
    for (let i = 0; i < names.length; i += 1) {
      assert.equal(buf.readUInt32LE(p), 0x02014b50);
      const csize = buf.readUInt32LE(p + 20);
      const size = buf.readUInt32LE(p + 24);
      const crc = buf.readUInt32LE(p + 16);
      const nameLen = buf.readUInt16LE(p + 28);
      const local = buf.readUInt32LE(p + 42);
      const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
      assert.equal(name, names[i]);
      const dataStart =
        local +
        30 +
        buf.readUInt16LE(local + 26) +
        buf.readUInt16LE(local + 28);
      const data = zlib.inflateRawSync(
        buf.subarray(dataStart, dataStart + csize),
      );
      assert.equal(data.length, size);
      assert.equal(zlib.crc32(data), crc);
      p += 46 + nameLen;
    }
    assert.ok(names.includes('org-vendor-kit-test/test-host/index.html'));
  });
});

/**
 * @jest-environment node
 */
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultAssetFiles, generateServiceWorker } from './index.cjs';

describe('generateServiceWorker', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'org-pwa-'));
    mkdirSync(join(dir, 'icons'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>x</title>');
    writeFileSync(join(dir, 'main.123.js'), 'console.log(1)');
    writeFileSync(join(dir, 'main.123.js.map'), '{}');
    // extracted CSS of production builds ([name].[contenthash:8].css)
    writeFileSync(join(dir, '616.7d2ec52d.css'), 'body{margin:0}');
    writeFileSync(join(dir, 'mfe-manifest.json'), '{"remotes":{}}');
    writeFileSync(join(dir, 'mf-manifest.json'), '{}');
    writeFileSync(join(dir, 'remoteEntry.js'), '');
    writeFileSync(join(dir, 'manifest.webmanifest'), '{}');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('precaches the app shell but never mfe-manifest.json or federation metadata', async () => {
    const result = await generateServiceWorker({ outputDir: dir });
    const sw = readFileSync(join(dir, 'service-worker.js'), 'utf8');
    expect(sw).toContain('"index.html"');
    expect(sw).toContain('"main.123.js"');
    // CSS is precached like JS (the shell's own extracted .css files); its name already carries
    // the content hash, so Workbox adds no extra revision
    expect(sw).toMatch(/url:\s*"616\.7d2ec52d\.css",\s*revision:\s*null/);
    expect(sw).toContain('"manifest.webmanifest"');
    expect(sw).not.toContain('"mfe-manifest.json"');
    expect(sw).not.toContain('"mf-manifest.json"');
    expect(sw).not.toContain('"remoteEntry.js"');
    expect(sw).not.toContain('.map"');
    // the manifest is still served network-first at runtime
    expect(sw).toContain('mfe-manifest');
    expect(result.count).toBe(4);
  }, 60_000);

  it('ships a default web manifest and icons', () => {
    const files = defaultAssetFiles().map(([name]) => name);
    expect(files).toEqual(
      expect.arrayContaining([
        'manifest.webmanifest',
        'icons/icon-192.png',
        'icons/icon-512.png',
      ]),
    );
  });
});

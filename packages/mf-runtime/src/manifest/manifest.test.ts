/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadMfeManifest,
  MfeManifestError,
  parseMfeManifest,
  resolveRemoteEntry,
  validateMfeManifest,
} from './manifest';

const valid = {
  $schema: './node_modules/@org/mf-runtime/mfe-manifest.schema.json',
  remotes: {
    intranet_staff: {
      entry: 'http://localhost:3101/mf-manifest.json',
      props: { title: 'Staff' },
    },
    intranet_leave: { entry: '/remotes/leave/mf-manifest.json?v=2' },
    legacy_remote: { entry: 'https://cdn.example.com/legacy/remoteEntry.js' },
  },
  auth: { loginUrl: '/bff/login' },
  settings: { apiBaseUrl: 'https://api.example.com' },
};

function issuesOf(value: unknown): string[] {
  const result = validateMfeManifest(value);
  if (result.ok) throw new Error('expected invalid manifest');
  return result.issues;
}

describe('validateMfeManifest', () => {
  it('accepts a full manifest', () => {
    expect(validateMfeManifest(valid)).toEqual({ ok: true, manifest: valid });
  });

  it('accepts a minimal manifest with no remotes', () => {
    expect(validateMfeManifest({ remotes: {} }).ok).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(issuesOf(null)).toEqual(['(root): must be object']);
    expect(issuesOf([])).toEqual(['(root): must be object']);
  });

  it('requires remotes', () => {
    expect(issuesOf({ settings: {} })).toEqual([
      '(root): missing required property "remotes"',
    ]);
  });

  it('requires an entry per remote', () => {
    expect(issuesOf({ remotes: { a: { props: {} } } })).toEqual([
      'remotes.a: missing required property "entry"',
    ]);
  });

  it.each([
    'ftp://host/mf-manifest.json',
    'http://localhost:3101/',
    'mf-manifest.json',
    'http://localhost:3101/mf manifest.json',
    'javascript:alert(1)//x.js',
  ])('rejects entry %p', (entry) => {
    expect(issuesOf({ remotes: { a: { entry } } })).toEqual([
      "remotes.a.entry: must be an http(s) URL or root-relative path to the remote's mf-manifest.json or remoteEntry.js",
    ]);
  });

  it('rejects remote names that are not federation names', () => {
    expect(
      issuesOf({
        remotes: { 'staff-directory': { entry: '/x/mf-manifest.json' } },
      }),
    ).toEqual([
      'remotes: invalid remote name "staff-directory" (must be a JS identifier, the remote\'s federation name)',
    ]);
  });

  it('rejects unknown properties (typos) and wrong types, listing every issue', () => {
    expect(
      issuesOf({
        remotes: { a: { entry: '/a/mf-manifest.json', prop: {} }, b: 'x' },
        setting: {},
        auth: 'yes',
      }),
    ).toEqual([
      '(root): unknown property "setting"',
      'remotes.a: unknown property "prop"',
      'remotes.b: must be object',
      'auth: must be object',
    ]);
  });
});

describe('parseMfeManifest', () => {
  it('returns the manifest when valid', () => {
    expect(parseMfeManifest(valid)).toBe(valid);
  });

  it('throws MfeManifestError with a readable message and issues', () => {
    let error: unknown;
    try {
      parseMfeManifest({ remotes: { a: {} } }, '/mfe-manifest.json');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(MfeManifestError);
    const e = error as MfeManifestError;
    expect(e.issues).toEqual(['remotes.a: missing required property "entry"']);
    expect(e.message).toBe(
      'Invalid MFE manifest (/mfe-manifest.json): does not match mfe-manifest.schema.json\n' +
        '  - remotes.a: missing required property "entry"',
    );
  });
});

describe('loadMfeManifest', () => {
  const ok = (body: string, status = 200) =>
    jest.fn().mockResolvedValue(new Response(body, { status }));

  it('fetches /mfe-manifest.json without HTTP caching and validates it', async () => {
    const fetchMock = ok(JSON.stringify(valid));
    await expect(loadMfeManifest({ fetch: fetchMock })).resolves.toEqual(valid);
    expect(fetchMock).toHaveBeenCalledWith(
      '/mfe-manifest.json',
      expect.objectContaining({
        cache: 'no-cache',
        credentials: 'same-origin',
      }),
    );
  });

  it('reports HTTP errors', async () => {
    await expect(
      loadMfeManifest({ fetch: ok('missing', 404), url: '/m.json' }),
    ).rejects.toThrow('Invalid MFE manifest (/m.json): HTTP 404');
  });

  it('reports invalid JSON (e.g. an HTML fallback page)', async () => {
    await expect(
      loadMfeManifest({ fetch: ok('<!doctype html><html>') }),
    ).rejects.toThrow(/not valid JSON \(starts with: <!doctype html><html>\)/);
  });

  it('reports network failures', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(loadMfeManifest({ fetch: fetchMock })).rejects.toThrow(
      /request failed \(Failed to fetch\)/,
    );
  });

  it('reports schema violations', async () => {
    await expect(
      loadMfeManifest({ fetch: ok('{"remotes":{"a":{"entry":"nope"}}}') }),
    ).rejects.toMatchObject({
      name: 'MfeManifestError',
      issues: [expect.stringContaining('remotes.a.entry')],
    });
  });
});

describe('resolveRemoteEntry', () => {
  it('keeps absolute URLs and resolves root-relative ones against the page', () => {
    expect(resolveRemoteEntry('http://cdn.test/a/mf-manifest.json')).toBe(
      'http://cdn.test/a/mf-manifest.json',
    );
    expect(
      resolveRemoteEntry('/r/mf-manifest.json', 'https://portal.test/x/y'),
    ).toBe('https://portal.test/r/mf-manifest.json');
  });
});

describe('generated validator', () => {
  it('is up to date with mfe-manifest.schema.json (run `pnpm generate:validator`)', () => {
    const pkg = join(__dirname, '..', '..');
    const expected = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { readFileSync } from 'node:fs';
         import { generateValidatorSource } from './scripts/validator-source.mjs';
         const schema = JSON.parse(readFileSync('src/manifest/mfe-manifest.schema.json', 'utf8'));
         process.stdout.write(generateValidatorSource(schema));`,
      ],
      { cwd: pkg, encoding: 'utf8' },
    );
    const actual = readFileSync(
      join(__dirname, 'validateSchema.generated.js'),
      'utf8',
    );
    expect(actual).toBe(expected);
  });
});

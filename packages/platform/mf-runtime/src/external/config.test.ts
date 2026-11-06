import {
  isCompatibleContractVersion,
  MOUNT_CONTRACT_VERSION,
} from './contract';
import { validateExternalModuleConfig } from './config';

const issues = (value: unknown) => {
  const r = validateExternalModuleConfig(value);
  return r.ok ? [] : r.issues;
};

describe('isCompatibleContractVersion', () => {
  it('accepts the same major only', () => {
    expect(MOUNT_CONTRACT_VERSION).toMatch(/^1\./);
    expect(isCompatibleContractVersion('1.0.0')).toBe(true);
    expect(isCompatibleContractVersion('1.4')).toBe(true);
    expect(isCompatibleContractVersion('1')).toBe(true);
    expect(isCompatibleContractVersion('2.0.0')).toBe(false);
    expect(isCompatibleContractVersion('0.9.0')).toBe(false);
    expect(isCompatibleContractVersion(1)).toBe(false);
    expect(isCompatibleContractVersion(undefined)).toBe(false);
    expect(isCompatibleContractVersion('v1')).toBe(false);
  });
});

describe('validateExternalModuleConfig', () => {
  it('accepts every format with its required fields', () => {
    for (const config of [
      { url: 'https://vendor.example/pay/v1/mount.js', format: 'esm' },
      {
        url: '/vendor/mount.js',
        format: 'esm',
        exportName: 'payments',
        integrity: 'sha384-abc+/=',
      },
      {
        url: 'https://v.example/x.js',
        format: 'script',
        global: 'Acme.Payments',
      },
      {
        url: 'https://v.example/x.js',
        format: 'web-component',
        tagName: 'acme-pay',
        scriptType: 'classic',
      },
      {
        url: 'https://v.example/mf-manifest.json',
        format: 'mf',
        remoteName: 'acme_pay',
        expose: './mount',
      },
      {
        url: 'http://localhost:3999/mount.js',
        format: 'esm',
        timeoutMs: 5000,
        config: { a: 1 },
      },
    ]) {
      expect(issues(config)).toEqual([]);
    }
  });

  it('lists every problem', () => {
    expect(issues(null)).toHaveLength(1);
    expect(
      issues({
        url: 'javascript:alert(1)',
        format: 'iframe',
        tagname: 'x',
        timeoutMs: 10,
        config: [],
      }),
    ).toEqual([
      'unknown property "tagname"',
      'url: must be an http(s) URL or a root-relative path',
      'format: must be one of esm, script, web-component, mf',
      'timeoutMs: must be an integer between 1000 and 120000',
      'config: must be an object',
    ]);
    expect(issues({ url: '/x.js', format: 'script' })).toEqual([
      'global: required for format "script"',
    ]);
    expect(
      issues({ url: '/x.js', format: 'web-component', tagName: 'Nope' }),
    ).toEqual([
      'tagName: must be a custom element name (lowercase, with a "-")',
    ]);
    expect(
      issues({ url: '/m.json', format: 'mf', integrity: 'sha384-abc' }),
    ).toEqual([
      'remoteName: required for format "mf"',
      'integrity: not supported for format "mf"',
    ]);
  });
});

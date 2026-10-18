import { resolveVendorConfig } from './vendorConfig';

describe('resolveVendorConfig', () => {
  const env = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = env;
  });

  it('uses the config from the manifest (host props)', () => {
    const vendor = { url: 'https://vendor.example/mount.js', format: 'esm' };
    expect(resolveVendorConfig(vendor)).toBe(vendor);
  });

  it('falls back to the dev example vendor outside production', () => {
    expect(resolveVendorConfig(undefined)).toMatchObject({
      url: 'http://localhost:3192/helpdesk/1.0.0/mount.js',
      format: 'esm',
    });
  });

  it('has no fallback in production', () => {
    process.env.NODE_ENV = 'production';
    expect(resolveVendorConfig(undefined)).toBeUndefined();
  });
});

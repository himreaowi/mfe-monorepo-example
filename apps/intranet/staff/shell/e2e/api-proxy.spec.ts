import { expect, test } from '@org/playwright-config/test';
import { openRemote, zone } from './helpers';

// Same-origin API: the browser only calls <base path>/api on the zone's dev proxy origin
// (`/api`), which forwards to API_UPSTREAM (the zone's mock API by default), like nginx in
// production. No request goes to the mock API's own port.
const remote = zone.remotes.find((r) => r.name === 'leave-requests')!;

test.describe('API behind the shell origin', () => {
  test('leave-requests calls /api/... on the proxy origin', async ({
    page,
  }) => {
    const urls: string[] = [];
    page.on('request', (request) => urls.push(request.url()));
    await openRemote(page, remote);
    const api = urls.filter((url) => {
      const { pathname } = new URL(url);
      return pathname === '/api' || pathname.startsWith('/api/');
    });
    expect(api.length).toBeGreaterThan(0);
    for (const url of api)
      expect(url.startsWith(`${zone.origin}/api/`)).toBe(true);
    // nothing talks to another origin's /api (the mock API's own port)
    const foreign = urls.filter((url) => {
      const u = new URL(url);
      return u.origin !== zone.origin && u.pathname.includes('/api/');
    });
    expect(foreign).toEqual([]);
  });
});

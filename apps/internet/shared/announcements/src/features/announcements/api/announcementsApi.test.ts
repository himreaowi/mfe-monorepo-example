import { createHttpClient } from '@org/http-client';
import { createFakeFetch, type FakeRoute } from '@org/jest-config/fetch';
import { getAnnouncement, listAnnouncements } from './announcementsApi';

function fakeHttp(routes: Record<string, FakeRoute>) {
  return createHttpClient({
    baseUrl: 'https://api.test/api',
    fetch: createFakeFetch(routes),
  });
}

describe('announcements api', () => {
  it('lists newest first', async () => {
    const http = fakeHttp({
      'GET /api/announcements': {
        body: {
          items: [
            { id: 'old', publishedAt: '2026-01-01T00:00:00Z' },
            { id: 'new', publishedAt: '2026-10-01T00:00:00Z' },
          ],
        },
      },
    });
    const items = await listAnnouncements(http);
    expect(items.map((i) => i.id)).toEqual(['new', 'old']);
  });

  it('returns one announcement with text paragraphs only, null when unknown', async () => {
    const http = fakeHttp({
      'GET /api/announcements/a-1': {
        body: { id: 'a-1', body: ['One', { html: '<b>x</b>' }, 'Two'] },
      },
    });
    await expect(getAnnouncement(http, 'a-1')).resolves.toMatchObject({
      body: ['One', 'Two'],
    });
    // unknown routes answer 404
    await expect(getAnnouncement(http, 'gone')).resolves.toBeNull();
  });
});

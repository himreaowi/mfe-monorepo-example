import { createHttpClient } from '@org/http-client';
import { getAnnouncement, listAnnouncements } from './announcementsApi';

type Reply = { status?: number; body?: unknown };

function fakeHttp(replies: Record<string, Reply>) {
  const fetchFn = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const { status = 200, body } = replies[url] ?? { status: 404 };
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: '',
      url,
      text: async () => (body === undefined ? '' : JSON.stringify(body)),
    } as Response;
  });
  return createHttpClient({ baseUrl: 'https://api.test/api', fetch: fetchFn });
}

describe('announcements api', () => {
  it('lists newest first', async () => {
    const http = fakeHttp({
      'https://api.test/api/announcements': {
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
      'https://api.test/api/announcements/a-1': {
        body: { id: 'a-1', body: ['One', { html: '<b>x</b>' }, 'Two'] },
      },
    });
    await expect(getAnnouncement(http, 'a-1')).resolves.toMatchObject({
      body: ['One', 'Two'],
    });
    await expect(getAnnouncement(http, 'gone')).resolves.toBeNull();
  });
});

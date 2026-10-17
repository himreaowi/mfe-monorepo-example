import { createHttpClient } from '@org/http-client';
import { getDepartments, getStaffMember, searchStaff } from './staffApi';

type Reply = { status?: number; body?: unknown };

/** A fetch that answers from a map of URL → reply and records the requested URLs. */
function fakeHttp(replies: Record<string, Reply>) {
  const urls: string[] = [];
  const fetchFn = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const { status = 200, body } = replies[url] ?? { status: 404 };
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: '',
      url,
      text: async () => (body === undefined ? '' : JSON.stringify(body)),
    } as Response;
  });
  return {
    http: createHttpClient({ baseUrl: 'https://api.test/api', fetch: fetchFn }),
    urls,
  };
}

describe('staff api', () => {
  it('searches with trimmed query and department, normalising the result', async () => {
    const { http, urls } = fakeHttp({
      'https://api.test/api/staff?q=ann&department=Legal+%26+Risk': {
        body: { items: [{ id: 's-1' }] },
      },
    });
    const result = await searchStaff(http, {
      q: '  ann ',
      department: 'Legal & Risk',
    });
    expect(urls).toHaveLength(1);
    expect(result).toEqual({
      items: [{ id: 's-1' }],
      total: 1,
      departments: [],
    });
  });

  it('omits empty filters and reads departments', async () => {
    const { http } = fakeHttp({
      'https://api.test/api/staff': {
        body: { items: [], total: 0, departments: ['Finance', 'Legal'] },
      },
    });
    await expect(getDepartments(http)).resolves.toEqual(['Finance', 'Legal']);
  });

  it('returns a staff member, null for an unknown id, throws other errors', async () => {
    const { http } = fakeHttp({
      'https://api.test/api/staff/s-1': {
        body: { id: 's-1', name: 'Ann', manager: null },
      },
      'https://api.test/api/staff/boom': { status: 500 },
    });
    await expect(getStaffMember(http, 's-1')).resolves.toMatchObject({
      id: 's-1',
      skills: [],
      directReports: [],
      manager: null,
    });
    await expect(getStaffMember(http, 'nobody')).resolves.toBeNull();
    await expect(getStaffMember(http, 'boom')).rejects.toThrow('500');
  });
});

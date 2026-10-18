import { createHttpClient } from '@org/http-client';
import { createFakeFetch, type FakeRoute } from '@org/jest-config/fetch';
import { getDepartments, getStaffMember, searchStaff } from './staffApi';

function fakeHttp(routes: Record<string, FakeRoute>) {
  const fetch = createFakeFetch(routes);
  return {
    http: createHttpClient({ baseUrl: 'https://api.test/api', fetch }),
    fetch,
  };
}

describe('staff api', () => {
  it('searches with trimmed query and department, normalising the result', async () => {
    const { http, fetch } = fakeHttp({
      'GET /api/staff': { body: { items: [{ id: 's-1' }] } },
    });
    const result = await searchStaff(http, {
      q: '  ann ',
      department: 'Legal & Risk',
    });
    expect(fetch.calls.map((c) => c.url)).toEqual([
      'https://api.test/api/staff?q=ann&department=Legal+%26+Risk',
    ]);
    expect(result).toEqual({
      items: [{ id: 's-1' }],
      total: 1,
      departments: [],
    });
  });

  it('omits empty filters and reads departments', async () => {
    const { http, fetch } = fakeHttp({
      'GET /api/staff': {
        body: { items: [], total: 0, departments: ['Finance', 'Legal'] },
      },
    });
    await expect(getDepartments(http)).resolves.toEqual(['Finance', 'Legal']);
    expect(fetch.calls[0].url).toBe('https://api.test/api/staff');
  });

  it('returns a staff member, null for an unknown id, throws other errors', async () => {
    const { http } = fakeHttp({
      'GET /api/staff/s-1': { body: { id: 's-1', name: 'Ann', manager: null } },
      'GET /api/staff/boom': { status: 500 },
    });
    await expect(getStaffMember(http, 's-1')).resolves.toMatchObject({
      id: 's-1',
      skills: [],
      directReports: [],
      manager: null,
    });
    // unknown routes answer 404
    await expect(getStaffMember(http, 'nobody')).resolves.toBeNull();
    await expect(getStaffMember(http, 'boom')).rejects.toThrow('500');
  });
});

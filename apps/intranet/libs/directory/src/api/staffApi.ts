import { HttpClientError, type HttpClient } from '@org/http-client';
import { apiRoutes } from './apiRoutes';
import type {
  StaffMember,
  StaffSearchQuery,
  StaffSearchResult,
} from '../types/staff';

/** Search staff by name, job title, department or skill; optional department filter. */
export async function searchStaff(
  http: HttpClient,
  { q, department }: StaffSearchQuery,
  signal?: AbortSignal,
): Promise<StaffSearchResult> {
  const result = await http.getJson<Partial<StaffSearchResult>>(
    apiRoutes.staff.search({ q: q.trim(), department }),
    { signal },
  );
  const items = result?.items ?? [];
  return {
    items,
    total: result?.total ?? items.length,
    departments: result?.departments ?? [],
  };
}

/** One staff member, or `null` when the id is unknown (404). */
export async function getStaffMember(
  http: HttpClient,
  id: string,
  signal?: AbortSignal,
): Promise<StaffMember | null> {
  try {
    const member = await http.getJson<StaffMember>(apiRoutes.staff.byId(id), {
      signal,
    });
    return {
      ...member,
      skills: member.skills ?? [],
      directReports: member.directReports ?? [],
      manager: member.manager ?? null,
    };
  } catch (error) {
    if (error instanceof HttpClientError && error.status === 404) return null;
    throw error;
  }
}

/** Every department (for the filter), from the unfiltered search. */
export async function getDepartments(
  http: HttpClient,
  signal?: AbortSignal,
): Promise<string[]> {
  const { departments } = await searchStaff(
    http,
    { q: '', department: '' },
    signal,
  );
  return departments;
}

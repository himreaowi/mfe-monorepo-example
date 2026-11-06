import { HttpClientError, type HttpClient } from '@org/http-client';
import { apiRoutes } from '@/core/constants/apiRoutes';
import type { Announcement, AnnouncementSummary } from '../types/announcement';

/** Announcements, newest first. */
export async function listAnnouncements(
  http: HttpClient,
  signal?: AbortSignal,
): Promise<AnnouncementSummary[]> {
  const result = await http.getJson<{ items?: AnnouncementSummary[] }>(
    apiRoutes.announcements.list(),
    { signal },
  );
  return [...(result?.items ?? [])].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
}

/** One announcement, or `null` when the id is unknown (404). */
export async function getAnnouncement(
  http: HttpClient,
  id: string,
  signal?: AbortSignal,
): Promise<Announcement | null> {
  try {
    const item = await http.getJson<Announcement>(
      apiRoutes.announcements.byId(id),
      { signal },
    );
    return {
      ...item,
      body: (item.body ?? []).filter((p) => typeof p === 'string'),
    };
  } catch (error) {
    if (error instanceof HttpClientError && error.status === 404) return null;
    throw error;
  }
}

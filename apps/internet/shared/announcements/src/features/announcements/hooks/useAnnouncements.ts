import { useQuery } from '@tanstack/react-query';
import { requireApiClient } from '@org/http-client';
import { useApiClient } from '@org/mf-runtime/remote';
import { getAnnouncement, listAnnouncements } from '../api/announcementsApi';
import { announcementKeys } from '../queryKeys';

/** The announcements, newest first, as a query result. */
export function useAnnouncements() {
  const http = useApiClient();
  return useQuery({
    queryKey: announcementKeys.list(),
    queryFn: ({ signal }) => listAnnouncements(requireApiClient(http), signal),
  });
}

export type AnnouncementsQuery = ReturnType<typeof useAnnouncements>;

/** One announcement (`null`: unknown id); another id has its own cache entry. */
export function useAnnouncement(id: string) {
  const http = useApiClient();
  return useQuery({
    queryKey: announcementKeys.detail(id),
    queryFn: ({ signal }) =>
      getAnnouncement(requireApiClient(http), id, signal),
  });
}

export type AnnouncementQuery = ReturnType<typeof useAnnouncement>;

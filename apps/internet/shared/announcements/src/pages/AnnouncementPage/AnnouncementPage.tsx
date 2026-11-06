import { useParams } from 'react-router';
import { AnnouncementDetail, useAnnouncement } from '@/features/announcements';

/**
 * Page-level data fetching: the page loads the announcement of the URL, `AnnouncementDetail`
 * displays it. Another id has its own query key, so it starts from a fresh pending state.
 */
export function AnnouncementPage() {
  const { announcementId = '' } = useParams();
  const announcement = useAnnouncement(announcementId);
  return (
    <div data-testid="announcement-page">
      <AnnouncementDetail announcement={announcement} />
    </div>
  );
}

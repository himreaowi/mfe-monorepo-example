import { AnnouncementList } from '@/components/AnnouncementList/AnnouncementList';
import { useAnnouncements } from '@/hooks/useAnnouncements';

/** Page-level data fetching: the page loads the list, `AnnouncementList` displays it. */
export function OverviewPage() {
  const announcements = useAnnouncements();
  return (
    <div data-testid="overview-page">
      <AnnouncementList announcements={announcements} />
    </div>
  );
}

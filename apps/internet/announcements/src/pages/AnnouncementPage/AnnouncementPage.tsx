import { useParams } from 'react-router';
import { AnnouncementDetail } from '@/features/announcements';

export function AnnouncementPage() {
  const { announcementId = '' } = useParams();
  return (
    <div data-testid="announcement-page">
      {/* key: another announcement starts from a fresh loading state */}
      <AnnouncementDetail key={announcementId} id={announcementId} />
    </div>
  );
}

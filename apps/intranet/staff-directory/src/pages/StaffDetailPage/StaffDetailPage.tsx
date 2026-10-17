import { useParams } from 'react-router';
import { StaffDetail } from '@/features/staff';

export function StaffDetailPage() {
  const { staffId = '' } = useParams();
  return (
    <div data-testid="staff-detail-page">
      {/* key: another person starts from a fresh loading state */}
      <StaffDetail key={staffId} id={staffId} />
    </div>
  );
}

import { useParams } from 'react-router';
import { StaffDetail, useStaffMember } from '@/features/staff';

/**
 * Page-level data fetching: the page loads the person of the URL, `StaffDetail` displays them.
 * Another person has its own query key (`staffKeys.detail(id)`), so it starts from a fresh pending state.
 */
export function StaffDetailPage() {
  const { staffId = '' } = useParams();
  const member = useStaffMember(staffId);
  return (
    <div data-testid="staff-detail-page">
      <StaffDetail member={member} />
    </div>
  );
}

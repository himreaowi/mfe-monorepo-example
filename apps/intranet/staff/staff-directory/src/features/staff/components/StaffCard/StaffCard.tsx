import { Link } from 'react-router';
import { useRemotePath } from '@org/mf-runtime/remote';
import { staffPath } from '@/core/constants/routePaths';
import type { StaffSummary } from '../../types/staff';
import styles from './StaffCard.module.scss';

export function StaffCard({ member }: { member: StaffSummary }) {
  const toPath = useRemotePath();
  return (
    <li className={styles.card} data-testid="staff-card">
      <h2 className={styles.name}>
        <Link to={toPath(staffPath(member.id))}>{member.name}</Link>
      </h2>
      <p>{member.jobTitle}</p>
      <p className={styles.muted}>
        {member.department}, {member.location}
      </p>
      <p>
        <a href={`mailto:${member.email}`}>{member.email}</a>
      </p>
    </li>
  );
}

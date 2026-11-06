import { Link } from 'react-router';
import type { StaffSummary } from '../../types/staff';
import styles from './StaffCard.module.scss';

export type StaffCardProps = {
  member: StaffSummary;
  /** Where the name links to (the caller resolves it, e.g. with `useRemotePath()`). */
  to: string;
};

/** One staff member as a list item: name (link), job title, department, mail link. */
export function StaffCard({ member, to }: StaffCardProps) {
  return (
    <li className={styles.card} data-testid="staff-card">
      <h2 className={styles.name}>
        <Link to={to}>{member.name}</Link>
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

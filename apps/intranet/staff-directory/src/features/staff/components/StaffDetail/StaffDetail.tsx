import { Link } from 'react-router';
import { useRemotePath } from '@org/mf-runtime/remote';
import { RemoteFallback } from '@org/ui';
import { routePaths, staffPath } from '@/core/constants/routePaths';
import { useStaffMember } from '../../hooks/useStaffMember';
import type { StaffLink } from '../../types/staff';
import styles from './StaffDetail.module.scss';

function PersonLink({ person }: { person: StaffLink }) {
  const toPath = useRemotePath();
  return <Link to={toPath(staffPath(person.id))}>{person.name}</Link>;
}

/** One staff member: contact details, manager, direct reports, skills. */
export function StaffDetail({ id }: { id: string }) {
  const toPath = useRemotePath();
  const member = useStaffMember(id);
  const back = (
    <p>
      <Link className={styles.back} to={toPath(routePaths.list)}>
        Back to the staff directory
      </Link>
    </p>
  );

  if (member.status === 'loading') {
    return (
      <section className={styles.page} data-testid="staff-detail">
        <h1 className={styles.title}>Staff member</h1>
        <p role="status">Loading…</p>
      </section>
    );
  }
  if (member.status === 'error') {
    return (
      <section className={styles.page} data-testid="staff-detail">
        <h1 className={styles.title}>Staff member</h1>
        <RemoteFallback
          title="Could not load this staff member"
          reason={member.error.message}
          onRetry={member.reload}
        />
        {back}
      </section>
    );
  }
  if (member.data === null) {
    return (
      <section className={styles.page} data-testid="staff-detail">
        <h1 className={styles.title}>Staff member not found</h1>
        <p>There is no one with this id. They may have left.</p>
        {back}
      </section>
    );
  }

  const person = member.data;
  return (
    <section className={styles.page} data-testid="staff-detail">
      <div>
        <h1 className={styles.title}>{person.name}</h1>
        <p className={styles.lead}>{person.jobTitle}</p>
      </div>
      <dl className={styles.details}>
        <dt>Department</dt>
        <dd>{person.department}</dd>
        <dt>Location</dt>
        <dd>{person.location}</dd>
        <dt>Email</dt>
        <dd>
          <a href={`mailto:${person.email}`}>{person.email}</a>
        </dd>
        <dt>Phone</dt>
        <dd>
          <a href={`tel:${person.phone.replace(/\s/g, '')}`}>{person.phone}</a>
        </dd>
        <dt>Manager</dt>
        <dd>
          {person.manager ? <PersonLink person={person.manager} /> : 'None'}
        </dd>
        <dt>Direct reports</dt>
        <dd>
          {person.directReports.length === 0 ? (
            'None'
          ) : (
            <ul className={styles.inlineList}>
              {person.directReports.map((report) => (
                <li key={report.id}>
                  <PersonLink person={report} />
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt>Skills</dt>
        <dd>
          <ul className={styles.inlineList} aria-label="Skills">
            {person.skills.map((skill) => (
              <li key={skill} className={styles.tag}>
                {skill}
              </li>
            ))}
          </ul>
        </dd>
      </dl>
      {back}
    </section>
  );
}

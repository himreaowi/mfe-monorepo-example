import { Link } from 'react-router';
import { useRemotePath } from '@org/mf-runtime/remote';
import { RemoteFallback } from '@org/ui';
import type { ApiResult } from '@org/use-api';
import { announcementPath } from '@/core/constants/routePaths';
import { formatDate } from '@/core/utils/formatDate';
import type { AnnouncementSummary } from '../../types/announcement';
import styles from './AnnouncementList.module.scss';

/**
 * The announcements, newest first. Displays only: the page loads them (`useAnnouncements()`)
 * and passes the result down, "Try again" is its `reload` (docs/coding-conventions.md "Data
 * fetching").
 */
export function AnnouncementList({
  announcements,
}: {
  announcements: ApiResult<AnnouncementSummary[]>;
}) {
  const toPath = useRemotePath();
  return (
    <section className={styles.page} data-testid="announcement-list">
      <h1 className={styles.title}>Announcements</h1>
      <p className={styles.lead}>
        News about our services, fees and planned maintenance.
      </p>
      {announcements.status === 'loading' ? (
        <p role="status">Loading announcements…</p>
      ) : null}
      {announcements.status === 'error' ? (
        <RemoteFallback
          title="Could not load the announcements"
          reason={announcements.error.message}
          onRetry={announcements.reload}
        />
      ) : null}
      {announcements.status === 'success' && announcements.data.length === 0 ? (
        <p className={styles.meta}>There are no announcements right now.</p>
      ) : null}
      {announcements.status === 'success' && announcements.data.length > 0 ? (
        <ul className={styles.list} aria-label="Announcements">
          {announcements.data.map((item) => (
            <li
              key={item.id}
              className={styles.item}
              data-testid="announcement"
            >
              <h2>
                <Link to={toPath(announcementPath(item.id))}>{item.title}</Link>
              </h2>
              <p className={styles.meta}>
                <time dateTime={item.publishedAt}>
                  {formatDate(item.publishedAt)}
                </time>
                , {item.category}
              </p>
              <p>{item.summary}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

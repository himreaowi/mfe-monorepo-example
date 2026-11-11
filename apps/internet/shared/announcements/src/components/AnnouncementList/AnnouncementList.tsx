import { useRemotePath } from '@org/mf-runtime/remote';
import { Card, Link, RemoteFallback, Spinner } from '@org/ui';
import { announcementPath } from '@/core/constants/routePaths';
import { formatDate } from '@/core/utils/formatDate';
import type { AnnouncementsQuery } from '@/hooks/useAnnouncements';
import styles from './AnnouncementList.module.scss';

/**
 * The announcements, newest first. Displays only: the page loads them (`useAnnouncements()`)
 * and passes the result down, "Try again" is its `refetch` (docs/coding-conventions.md "Data
 * fetching").
 */
export function AnnouncementList({
  announcements,
}: {
  announcements: AnnouncementsQuery;
}) {
  const toPath = useRemotePath();
  return (
    <section className={styles.page} data-testid="announcement-list">
      <h1 className={styles.title}>Announcements</h1>
      <p className={styles.lead}>
        News about our services, fees and planned maintenance.
      </p>
      {announcements.status === 'pending' ? (
        <Spinner label="Loading announcements…" labelVisible />
      ) : null}
      {announcements.status === 'error' ? (
        <RemoteFallback
          title="Could not load the announcements"
          reason={announcements.error.message}
          onRetry={() => void announcements.refetch()}
        />
      ) : null}
      {announcements.status === 'success' && announcements.data.length === 0 ? (
        <p className={styles.meta}>There are no announcements right now.</p>
      ) : null}
      {announcements.status === 'success' && announcements.data.length > 0 ? (
        <ul className={styles.list} aria-label="Announcements">
          {announcements.data.map((item) => (
            <Card
              as="li"
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
            </Card>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

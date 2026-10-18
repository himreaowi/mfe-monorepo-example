import { Link } from 'react-router';
import { useRemotePath } from '@org/mf-runtime/remote';
import { RemoteFallback } from '@org/ui';
import { routePaths } from '@/core/constants/routePaths';
import { formatDate } from '@/core/utils/formatDate';
import { useAnnouncement } from '../../hooks/useAnnouncements';
import styles from './AnnouncementDetail.module.scss';

/** One announcement. The body is plain text paragraphs (no HTML from the API is rendered). */
export function AnnouncementDetail({ id }: { id: string }) {
  const toPath = useRemotePath();
  const announcement = useAnnouncement(id);
  const back = (
    <p>
      <Link className={styles.back} to={toPath(routePaths.list)}>
        Back to all announcements
      </Link>
    </p>
  );

  if (announcement.status !== 'success' || announcement.data === null) {
    const notFound =
      announcement.status === 'success' && announcement.data === null;
    return (
      <section className={styles.page} data-testid="announcement-detail">
        <h1 className={styles.title}>
          {notFound ? 'Announcement not found' : 'Announcement'}
        </h1>
        {announcement.status === 'loading' ? (
          <p role="status">Loading…</p>
        ) : null}
        {announcement.status === 'error' ? (
          <RemoteFallback
            title="Could not load this announcement"
            reason={announcement.error.message}
            onRetry={announcement.reload}
          />
        ) : null}
        {notFound ? <p>It may have been removed.</p> : null}
        {announcement.status === 'loading' ? null : back}
      </section>
    );
  }

  const item = announcement.data;
  return (
    <article className={styles.page} data-testid="announcement-detail">
      <h1 className={styles.title}>{item.title}</h1>
      <p className={styles.meta}>
        Published{' '}
        <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>,{' '}
        {item.category}
      </p>
      <div className={styles.body}>
        {item.body.map((paragraph, index) => (
          // paragraphs never reorder; the index is a stable key here
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {back}
    </article>
  );
}

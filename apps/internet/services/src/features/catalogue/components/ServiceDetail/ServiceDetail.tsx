import { Link } from 'react-router';
import { useRemotePath } from '@org/mf-runtime/remote';
import { RemoteFallback } from '@org/ui';
import { routePaths } from '@/core/constants/routePaths';
import { formatFee } from '@/core/utils/formatMoney';
import { useService } from '../../hooks/useCatalogue';
import styles from './ServiceDetail.module.scss';

/** One service: what it is, who can use it, what you need, the steps, fee and timing. */
export function ServiceDetail({ slug }: { slug: string }) {
  const toPath = useRemotePath();
  const service = useService(slug);
  const back = (
    <p>
      <Link className={styles.back} to={toPath(routePaths.catalogue)}>
        Back to all services
      </Link>
    </p>
  );

  if (service.status === 'loading') {
    return (
      <section className={styles.page} data-testid="service-detail">
        <h1 className={styles.title}>Service</h1>
        <p role="status">Loading…</p>
      </section>
    );
  }
  if (service.status === 'error' || service.data === null) {
    return (
      <section className={styles.page} data-testid="service-detail">
        <h1 className={styles.title}>
          {service.status === 'error' ? 'Service' : 'Service not found'}
        </h1>
        {service.status === 'error' ? (
          <RemoteFallback
            title="Could not load this service"
            reason={service.error.message}
            onRetry={service.reload}
          />
        ) : (
          <p>There is no service with this name. It may have moved.</p>
        )}
        {back}
      </section>
    );
  }

  const s = service.data;
  return (
    <article className={styles.page} data-testid="service-detail">
      <div>
        <p className={styles.muted}>{s.category}</p>
        <h1 className={styles.title}>{s.title}</h1>
        <p className={styles.lead}>{s.summary}</p>
      </div>
      <p>{s.description}</p>
      <dl className={styles.details}>
        <dt>Fee</dt>
        <dd>{formatFee(s.fee)}</dd>
        <dt>How long it takes</dt>
        <dd>{s.processingTime}</dd>
        <dt>Where</dt>
        <dd>{s.online ? 'Online' : 'In person or by phone'}</dd>
        <dt>Provided by</dt>
        <dd>{s.agency}</dd>
      </dl>
      <section className={styles.section} aria-labelledby="service-who">
        <h2 id="service-who">Who can use it</h2>
        <ul>
          {s.eligibility.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className={styles.section} aria-labelledby="service-need">
        <h2 id="service-need">What you need</h2>
        <ul>
          {s.documents.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className={styles.section} aria-labelledby="service-steps">
        <h2 id="service-steps">Steps</h2>
        <ol>
          {s.steps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
      {back}
    </article>
  );
}

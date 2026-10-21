import { useRemotePath } from '@org/mf-runtime/remote';
import { Badge, Card, Link } from '@org/ui';
import { servicePath } from '@/core/constants/routePaths';
import { formatFee } from '@/core/utils/formatMoney';
import type { ServiceSummary } from '../../types/service';
import styles from './ServiceCard.module.scss';

export function ServiceCard({ service }: { service: ServiceSummary }) {
  const toPath = useRemotePath();
  return (
    <Card as="li" className={styles.card} data-testid="service-card">
      <h2 className={styles.name}>
        <Link to={toPath(servicePath(service.slug))}>{service.title}</Link>
      </h2>
      <p>{service.summary}</p>
      <p className={styles.muted}>{service.agency}</p>
      <p className={styles.badges}>
        <Badge>{formatFee(service.fee)}</Badge>
        <Badge>{service.online ? 'Online' : 'In person'}</Badge>
      </p>
    </Card>
  );
}

import { Link } from 'react-router';
import { useRemotePath } from '@org/mf-runtime/remote';
import { servicePath } from '@/core/constants/routePaths';
import { formatFee } from '@/core/utils/formatMoney';
import type { ServiceSummary } from '../types/service';
import styles from './Catalogue.module.scss';

export function ServiceCard({ service }: { service: ServiceSummary }) {
  const toPath = useRemotePath();
  return (
    <li className={styles.card} data-testid="service-card">
      <h2 className={styles.name}>
        <Link to={toPath(servicePath(service.slug))}>{service.title}</Link>
      </h2>
      <p>{service.summary}</p>
      <p className={styles.muted}>{service.agency}</p>
      <p className={styles.badges}>
        <span className={styles.tag}>{formatFee(service.fee)}</span>
        <span className={styles.tag}>
          {service.online ? 'Online' : 'In person'}
        </span>
      </p>
    </li>
  );
}

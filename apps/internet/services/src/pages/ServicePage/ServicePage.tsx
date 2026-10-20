import { useParams } from 'react-router';
import { ServiceDetail, useService } from '@/features/catalogue';

/**
 * Page-level data fetching: the page loads the service of the URL, `ServiceDetail` displays
 * it. Another slug starts from a fresh loading state (`useApi` resets when its loader changes).
 */
export function ServicePage() {
  const { slug = '' } = useParams();
  const service = useService(slug);
  return (
    <div data-testid="service-page">
      <ServiceDetail service={service} />
    </div>
  );
}

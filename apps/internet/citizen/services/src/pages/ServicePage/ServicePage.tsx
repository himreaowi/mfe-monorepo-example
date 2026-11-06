import { useParams } from 'react-router';
import { ServiceDetail, useService } from '@/features/catalogue';

/**
 * Page-level data fetching: the page loads the service of the URL, `ServiceDetail` displays
 * it. Another slug has its own query key, so it starts from a fresh pending state.
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

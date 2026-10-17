import { useParams } from 'react-router';
import { ServiceDetail } from '@/features/catalogue';

export function ServicePage() {
  const { slug = '' } = useParams();
  return (
    <div data-testid="service-page">
      {/* key: another service starts from a fresh loading state */}
      <ServiceDetail key={slug} slug={slug} />
    </div>
  );
}

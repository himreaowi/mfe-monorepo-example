import { Link } from 'react-router';
import { routePaths } from '@/core/constants/routePaths';

export function NotFoundPage() {
  return (
    <section data-testid="not-found-page">
      <h1>Page not found</h1>
      <p>
        <Link to={routePaths.home}>Back to home</Link>
      </p>
    </section>
  );
}

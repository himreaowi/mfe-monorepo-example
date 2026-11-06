import { Link } from 'react-router';
import { useRemotePath } from '@org/mf-runtime/remote';

export function NotFoundPage() {
  const toPath = useRemotePath();
  return (
    <section data-testid="remote-not-found-page">
      <h1>Page not found</h1>
      <Link to={toPath('')}>Back to overview</Link>
    </section>
  );
}

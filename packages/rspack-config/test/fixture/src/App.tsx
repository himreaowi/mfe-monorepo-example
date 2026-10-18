import { lazy, Suspense } from 'react';
import styles from './Widget.module.scss';

// async chunk with its own CSS (extracted into its own hashed .css file in production)
const Lazy = lazy(() => import('./Lazy'));

// dev-only branch: must vanish from production bundles AND source maps
const devOnlyUrl =
  process.env.NODE_ENV !== 'production'
    ? 'http://localhost:3999/dev-only-marker.js'
    : undefined;

export default function App() {
  return (
    <div className={styles.widget} data-dev={devOnlyUrl}>
      remote
      <Suspense fallback={null}>
        <Lazy />
      </Suspense>
    </div>
  );
}

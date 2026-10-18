import styles from './Widget.module.scss';

// dev-only branch: must vanish from production bundles AND source maps
const devOnlyUrl =
  process.env.NODE_ENV !== 'production'
    ? 'http://localhost:3999/dev-only-marker.js'
    : undefined;

export default function App() {
  return (
    <div className={styles.widget} data-dev={devOnlyUrl}>
      remote
    </div>
  );
}

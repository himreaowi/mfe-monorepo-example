import { NavLink } from 'react-router';
import { routePaths } from '@/core/constants/routePaths';
import type { RemoteEntry } from '@/core/types/remotes';
import styles from './RemoteNav.module.scss';

function linkClass({ isActive }: { isActive: boolean }) {
  return isActive ? `${styles.link} ${styles.active}` : styles.link;
}

/** Header nav: Home + one link per registered remote. */
export function RemoteNav({ remotes }: { remotes: RemoteEntry[] }) {
  return (
    <ul className={styles.list} aria-label="Apps">
      <li>
        <NavLink to={routePaths.home} end className={linkClass}>
          Home
        </NavLink>
      </li>
      {remotes.map((remote) => (
        <li key={remote.name}>
          <NavLink
            to={remote.path}
            className={linkClass}
            data-access={remote.access}
          >
            {remote.title}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

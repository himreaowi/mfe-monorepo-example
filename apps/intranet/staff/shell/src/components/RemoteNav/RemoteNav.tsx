import { NavLink } from 'react-router';
import { routePaths } from '@/core/constants/routePaths';
import type { RemoteEntry } from '@/core/types/remotes';
import styles from './RemoteNav.module.scss';

function linkClass({ isActive }: { isActive: boolean }) {
  return isActive ? `${styles.link} ${styles.active}` : styles.link;
}

export type RemoteNavProps = {
  remotes: RemoteEntry[];
  /**
   * `horizontal` (default): links in a row (the header row of the "top" layout).
   * `vertical`: one link per row, the whole row clickable, the active one with a bar on its
   * left edge (the sidebar and drawer of the "side" layout).
   */
  orientation?: 'horizontal' | 'vertical';
};

/** The shell's nav: Home + one link per registered remote (remotes.json). */
export function RemoteNav({
  remotes,
  orientation = 'horizontal',
}: RemoteNavProps) {
  return (
    <ul
      className={
        orientation === 'vertical'
          ? `${styles.list} ${styles.vertical}`
          : styles.list
      }
      aria-label="Apps"
      data-orientation={orientation}
    >
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

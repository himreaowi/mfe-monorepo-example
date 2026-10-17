import { useEffect, useId, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { routePaths } from '@/core/constants/routePaths';
import type { RemoteEntry } from '@/core/types/remotes';
import styles from './RemoteNav.module.scss';

function linkClass({ isActive }: { isActive: boolean }) {
  return isActive ? `${styles.link} ${styles.active}` : styles.link;
}

/**
 * Header nav: Home + one link per registered remote. Below 40rem the links fold into a "Menu"
 * disclosure (a dropdown panel), so the header stays short on phones. It closes on
 * navigation and on Escape (focus back on the button).
 */
export function RemoteNav({ remotes }: { remotes: RemoteEntry[] }) {
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState('');
  const { pathname } = useLocation();
  const listId = useId();
  // closes after navigation (the panel belongs to the page it was opened on)
  const expanded = open && openedAt === pathname;

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      document.getElementById(`${listId}-button`)?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded, listId]);

  return (
    <div className={styles.wrapper}>
      <button
        id={`${listId}-button`}
        type="button"
        className={styles.menuButton}
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => {
          setOpen(!expanded);
          setOpenedAt(pathname);
        }}
      >
        <span aria-hidden="true" className={styles.icon} />
        Menu
      </button>
      <ul
        id={listId}
        className={expanded ? `${styles.list} ${styles.open}` : styles.list}
        aria-label="Apps"
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
    </div>
  );
}

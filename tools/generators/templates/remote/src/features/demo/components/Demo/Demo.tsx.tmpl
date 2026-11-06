import { useState, type ReactNode } from 'react';
import { useAuth } from '@org/auth';
import { useHostProps, useRemotePath } from '@org/mf-runtime/remote';
import { Button, Card, Link } from '@org/ui';
import { ModeBadge } from '@/components/ModeBadge/ModeBadge';
import { APP_TITLE } from '@/core/constants/app';
import { routePaths } from '@/core/constants/routePaths';
import styles from './Demo.module.scss';

/**
 * Sample feature (ported from starter-mfe demo/demoRemote): reads host props, keeps local state
 * (proves the shared React works across the federation boundary) and links to a sibling page.
 * `children`: more content of the panel (the overview page puts `DemoItems` there).
 * `user` comes from host props; `useAuth()` reads the shell's AuthProvider directly (@org/auth
 * is a shared singleton), "disabled" when standalone.
 */
export function Demo({ children }: { children?: ReactNode }) {
  const { embedded, title, user } = useHostProps();
  const auth = useAuth();
  const toPath = useRemotePath();
  const [count, setCount] = useState(0);

  return (
    <Card
      as="section"
      className={styles.panel}
      data-testid="demo-feature"
      data-embedded={embedded ? 'true' : 'false'}
    >
      <h1 className={styles.title}>{APP_TITLE}</h1>
      {typeof title === 'string' && title !== APP_TITLE ? (
        <p className={styles.hostTitle}>{title}</p>
      ) : null}
      <ModeBadge embedded={embedded} />
      <p className={styles.copy} data-testid="demo-user">
        Signed in as {user?.name ?? user?.id ?? 'nobody'}
      </p>
      <p className={styles.copy} data-testid="demo-session">
        Shell session (useAuth): {auth.status}
      </p>
      <div className={styles.row}>
        <Button onClick={() => setCount((c) => c + 1)}>
          Clicked {count} times
        </Button>
        <Link to={toPath(routePaths.details)}>Go to details</Link>
      </div>
      {children}
    </Card>
  );
}

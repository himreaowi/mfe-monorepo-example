import { Button } from '@org/ui';
import { useAuth } from './AuthProvider';
import styles from './UserMenu.module.scss';

/**
 * Header control: "Sign in" when signed out, the user's name + "Sign out" when signed in.
 * Renders nothing while loading or when auth is disabled. Pass it to `MainLayout`
 * `headerActions`.
 */
export function UserMenu() {
  const auth = useAuth();
  if (auth.status === 'signedIn' && auth.user) {
    return (
      <div className={styles.menu} data-testid="user-menu">
        <span className={styles.name} data-testid="user-name">
          {auth.user.name ?? auth.user.id}
        </span>
        <Button variant="ghost" onClick={() => void auth.signOut()}>
          Sign out
        </Button>
      </div>
    );
  }
  if (auth.status === 'signedOut') {
    return (
      <div className={styles.menu} data-testid="user-menu">
        <Button variant="secondary" onClick={() => void auth.signIn()}>
          Sign in
        </Button>
      </div>
    );
  }
  return null;
}

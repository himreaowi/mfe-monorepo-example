import { useHostProps } from '@org/mf-runtime/remote';
import { RemoteFallback } from '@org/ui';
import { useProfile } from '../hooks/useProfile';
import { PreferencesForm } from './PreferencesForm';
import { ProfileDetails } from './ProfileDetails';
import styles from './Profile.module.scss';

/**
 * The signed-in user's profile. Only rendered after sign-in: the shell wraps this private
 * remote in <RequireAuth> and does not even download it before.
 */
export function MyProfile() {
  const { user } = useHostProps();
  const profile = useProfile();
  return (
    <section className={styles.page} data-testid="my-profile">
      <div>
        <h1 className={styles.title}>My profile</h1>
        <p className={styles.lead}>
          Signed in as {user?.name ?? user?.id ?? 'unknown user'}.
        </p>
      </div>
      {profile.status === 'loading' ? (
        <p role="status">Loading your profile…</p>
      ) : null}
      {profile.status === 'error' ? (
        <RemoteFallback
          title="Could not load your profile"
          reason={profile.error.message}
          onRetry={profile.reload}
        />
      ) : null}
      {profile.status === 'success' ? (
        <>
          <ProfileDetails profile={profile.data} />
          <PreferencesForm initial={profile.data.preferences} />
        </>
      ) : null}
    </section>
  );
}

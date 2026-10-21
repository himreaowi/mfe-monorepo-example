import { useHostProps } from '@org/mf-runtime/remote';
import { RemoteFallback, Spinner } from '@org/ui';
import type { ApiResult, SubmitResult } from '@org/use-api';
import type { Preferences, Profile } from '../../types/profile';
import { PreferencesForm } from '../PreferencesForm/PreferencesForm';
import { ProfileDetails } from '../ProfileDetails/ProfileDetails';
import styles from './MyProfile.module.scss';

/**
 * The signed-in user's profile. Only rendered after sign-in: the shell wraps this private
 * remote in <RequireAuth> and does not even download it before. Displays only: the page loads
 * the profile (`useProfile()`) and provides the save (`useSavePreferences()`) for the form.
 */
export function MyProfile({
  profile,
  save,
}: {
  profile: ApiResult<Profile>;
  /** Saves the notification choices (`useSavePreferences()`, called by the page). */
  save: SubmitResult<Preferences, Profile>;
}) {
  const { user } = useHostProps();
  return (
    <section className={styles.page} data-testid="my-profile">
      <div>
        <h1 className={styles.title}>My profile</h1>
        <p className={styles.lead}>
          Signed in as {user?.name ?? user?.id ?? 'unknown user'}.
        </p>
      </div>
      {profile.status === 'loading' ? (
        <Spinner label="Loading your profile…" labelVisible />
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
          <PreferencesForm initial={profile.data.preferences} save={save} />
        </>
      ) : null}
    </section>
  );
}

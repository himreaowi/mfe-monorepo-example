import type { Profile } from '../../types/profile';
import styles from './ProfileDetails.module.scss';

function formatMemberSince(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat('en-SG', {
        month: 'long',
        year: 'numeric',
      }).format(date);
}

export function ProfileDetails({ profile }: { profile: Profile }) {
  const { address } = profile;
  return (
    <section className={styles.panel} aria-labelledby="profile-details-title">
      <h2 id="profile-details-title">Your details</h2>
      <dl className={styles.details} data-testid="profile-details">
        <dt>Name</dt>
        <dd>{profile.name}</dd>
        <dt>Email</dt>
        <dd>{profile.email}</dd>
        <dt>Mobile</dt>
        <dd>{profile.mobile}</dd>
        <dt>Mailing address</dt>
        <dd>
          {address.line1}
          {address.line2 ? (
            <>
              <br />
              {address.line2}
            </>
          ) : null}
          <br />
          Singapore {address.postalCode}
        </dd>
        <dt>Member since</dt>
        <dd>{formatMemberSince(profile.memberSince)}</dd>
      </dl>
      <p className={styles.muted}>To change these details, contact us.</p>
    </section>
  );
}

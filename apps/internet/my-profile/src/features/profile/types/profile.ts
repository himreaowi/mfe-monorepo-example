export type Preferences = {
  /** Email about service updates and announcements. */
  emailUpdates: boolean;
  /** SMS reminders (renewals, appointments). */
  smsReminders: boolean;
};

/**
 * The signed-in user's profile from the profile API (not from the session: the session only
 * carries id, name and roles, see docs/auth-contract.md).
 */
export type Profile = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  address: { line1: string; line2?: string; postalCode: string };
  /** `yyyy-MM-dd`. */
  memberSince: string;
  preferences: Preferences;
};

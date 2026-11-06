import type { HttpClient } from '@org/http-client';
import { apiRoutes } from '@/core/constants/apiRoutes';
import type { Preferences, Profile } from '../types/profile';

const NO_PREFERENCES: Preferences = {
  emailUpdates: false,
  smsReminders: false,
};

function normalise(profile: Profile): Profile {
  return {
    ...profile,
    preferences: { ...NO_PREFERENCES, ...profile.preferences },
  };
}

/** The signed-in user's profile. The API identifies the user from the session cookie. */
export async function getProfile(
  http: HttpClient,
  signal?: AbortSignal,
): Promise<Profile> {
  return normalise(
    await http.getJson<Profile>(apiRoutes.profile.me(), { signal }),
  );
}

/** Save notification choices (state-changing: needs the CSRF header). */
export async function updatePreferences(
  http: HttpClient,
  preferences: Preferences,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<Profile> {
  return normalise(
    await http.requestJson<Profile>(
      apiRoutes.profile.preferences(),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      },
      { signal, headers },
    ),
  );
}

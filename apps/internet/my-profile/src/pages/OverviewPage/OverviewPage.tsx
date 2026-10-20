import { MyProfile, useProfile, useSavePreferences } from '@/features/profile';

/**
 * Page-level data fetching: the page loads the profile and owns the "save preferences"
 * request; `MyProfile` and its form only display and call `save.submit` (docs/coding-conventions.md
 * "Data fetching").
 */
export function OverviewPage() {
  const profile = useProfile();
  const savePreferences = useSavePreferences();
  return (
    <div data-testid="overview-page">
      <MyProfile profile={profile} save={savePreferences} />
    </div>
  );
}

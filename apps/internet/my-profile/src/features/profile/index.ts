// The profile feature's public API: what pages (and other features) may use.
export { MyProfile } from './components/MyProfile/MyProfile';
// data hooks: called by pages, which pass data and callbacks down to the components
export { useProfile, useSavePreferences } from './hooks/useProfile';
export type { Preferences, Profile } from './types/profile';

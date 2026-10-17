/** Resolved colour scheme applied to the document. */
export type ThemeMode = 'light' | 'dark';

/** What the user chose: an explicit mode, or follow the OS (`prefers-color-scheme`). */
export type ThemePreference = ThemeMode | 'system';

/** localStorage key holding an explicit preference ('light' | 'dark'). Absent = system. */
export const THEME_STORAGE_KEY = 'mfe-theme';

export const THEME_LIGHT = 'light' as const;
export const THEME_DARK = 'dark' as const;

/** Attribute on `<html>` that selects the token set in tokens.css. */
export const THEME_ATTRIBUTE = 'data-theme';

/** Attribute on `<html>` with the owner's preference ('light' | 'dark' | 'system'). */
export const THEME_PREFERENCE_ATTRIBUTE = 'data-theme-preference';

/**
 * Attribute on `<html>` set by the ThemeProvider that owns the document theme.
 * A ThemeProvider that finds it already set (e.g. a remote that did not get the
 * shared @org/ui instance) follows instead of taking over.
 */
export const THEME_OWNER_ATTRIBUTE = 'data-theme-owner';

/**
 * DOM event (on `document`) a follower dispatches to ask the owner to change the
 * theme. `detail: { preference: ThemePreference }`.
 */
export const THEME_REQUEST_EVENT = 'mfe:theme-request';

export type ThemeRequestDetail = { preference: ThemePreference };

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === THEME_LIGHT || value === THEME_DARK;
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return isThemeMode(value) || value === 'system';
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  isThemeMode,
  isThemePreference,
  THEME_ATTRIBUTE,
  THEME_OWNER_ATTRIBUTE,
  THEME_PREFERENCE_ATTRIBUTE,
  THEME_REQUEST_EVENT,
  THEME_STORAGE_KEY,
  type ThemeMode,
  type ThemePreference,
  type ThemeRequestDetail,
} from '@org/design-tokens';

/**
 * - `root`: this provider owns the document theme (`data-theme` on `<html>`, localStorage).
 * - `follower`: another provider owns the document theme; this one mirrors it and forwards
 *   changes to the owner through a DOM event.
 */
export type ThemeRole = 'root' | 'follower';

export type ThemeContextValue = {
  theme: ThemeMode;
  preference: ThemePreference;
  setTheme: (mode: ThemeMode) => void;
  useSystemTheme: () => void;
  role: ThemeRole;
};

export type ThemeProviderProps = {
  children: ReactNode;
  /**
   * `auto` (default):
   * 1. inside another ThemeProvider (same @org/ui instance, e.g. a remote in a shell that
   *    shares @org/ui as a singleton) → render children only, reuse the parent theme;
   * 2. else, if another provider already owns `<html>` (`data-theme-owner` is set, e.g. a
   *    remote with its own copy of @org/ui) → `follower`;
   * 3. else → `root`.
   */
  mode?: 'auto' | ThemeRole;
  /** localStorage key for the explicit preference (root only). */
  storageKey?: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
ThemeContext.displayName = 'ThemeContext';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function hasDocument(): boolean {
  return typeof document !== 'undefined';
}

function systemTheme(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function readStoredPreference(storageKey: string): ThemePreference | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (isThemeMode(raw)) return raw;
  } catch {
    /* storage unavailable */
  }
  return null;
}

function writeStoredPreference(storageKey: string, value: ThemePreference) {
  try {
    if (value === 'system') localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, value);
  } catch {
    /* storage unavailable */
  }
}

function readDocumentTheme(): ThemeMode {
  const value = hasDocument()
    ? document.documentElement.getAttribute(THEME_ATTRIBUTE)
    : null;
  return isThemeMode(value) ? value : systemTheme();
}

function readDocumentPreference(): ThemePreference {
  const value = hasDocument()
    ? document.documentElement.getAttribute(THEME_PREFERENCE_ATTRIBUTE)
    : null;
  return isThemePreference(value) ? value : 'system';
}

function documentHasOwner(): boolean {
  return (
    hasDocument() &&
    document.documentElement.hasAttribute(THEME_OWNER_ATTRIBUTE)
  );
}

/** Owns the document theme. Ported from starter-mfe ThemeProvider. */
function RootThemeProvider({
  children,
  storageKey,
}: {
  children: ReactNode;
  storageKey: string;
}) {
  const ownerId = useId();
  const [preference, setPreference] = useState<ThemePreference>(
    () => readStoredPreference(storageKey) ?? 'system',
  );
  const [system, setSystem] = useState<ThemeMode>(systemTheme);

  const theme: ThemeMode = preference === 'system' ? system : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, theme);
    root.setAttribute(THEME_PREFERENCE_ATTRIBUTE, preference);
  }, [theme, preference]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(THEME_OWNER_ATTRIBUTE, ownerId);
    return () => {
      if (root.getAttribute(THEME_OWNER_ATTRIBUTE) === ownerId) {
        root.removeAttribute(THEME_OWNER_ATTRIBUTE);
      }
    };
  }, [ownerId]);

  useEffect(() => {
    if (preference !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => setSystem(systemTheme());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const choose = useCallback(
    (next: ThemePreference) => {
      writeStoredPreference(storageKey, next);
      setSystem(systemTheme());
      setPreference(next);
    },
    [storageKey],
  );

  // Followers (providers from another @org/ui copy) ask us to change the theme.
  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<ThemeRequestDetail>).detail;
      if (detail && isThemePreference(detail.preference)) {
        choose(detail.preference);
      }
    };
    document.addEventListener(THEME_REQUEST_EVENT, onRequest);
    return () => document.removeEventListener(THEME_REQUEST_EVENT, onRequest);
  }, [choose]);

  const setTheme = useCallback((mode: ThemeMode) => choose(mode), [choose]);
  const useSystemTheme = useCallback(() => choose('system'), [choose]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, preference, setTheme, useSystemTheme, role: 'root' }),
    [theme, preference, setTheme, useSystemTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Mirrors a theme owned by another provider; never writes to `<html>` or storage. */
function FollowerThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readDocumentTheme);
  const [preference, setPreferenceState] = useState<ThemePreference>(
    readDocumentPreference,
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeState(readDocumentTheme());
      setPreferenceState(readDocumentPreference());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [THEME_ATTRIBUTE, THEME_PREFERENCE_ATTRIBUTE],
    });
    return () => observer.disconnect();
  }, []);

  const request = useCallback((next: ThemePreference) => {
    document.dispatchEvent(
      new CustomEvent<ThemeRequestDetail>(THEME_REQUEST_EVENT, {
        detail: { preference: next },
      }),
    );
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => request(mode), [request]);
  const useSystemTheme = useCallback(() => request('system'), [request]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, preference, setTheme, useSystemTheme, role: 'follower' }),
    [theme, preference, setTheme, useSystemTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

function IndependentThemeProvider({
  children,
  mode,
  storageKey,
}: {
  children: ReactNode;
  mode: 'auto' | ThemeRole;
  storageKey: string;
}) {
  // Decided once at mount: switching role later would fight the owner.
  const [role] = useState<ThemeRole>(() =>
    mode === 'auto' ? (documentHasOwner() ? 'follower' : 'root') : mode,
  );
  return role === 'root' ? (
    <RootThemeProvider storageKey={storageKey}>{children}</RootThemeProvider>
  ) : (
    <FollowerThemeProvider>{children}</FollowerThemeProvider>
  );
}

/**
 * Light/dark theme provider (sets `data-theme` on `<html>`, which selects the token set in
 * `@org/design-tokens/tokens.css`).
 *
 * Safe to render in both a shell and the remotes it loads: only one provider ever owns the
 * document theme. See `ThemeProviderProps.mode` and packages/ui/README.md.
 */
export function ThemeProvider({
  children,
  mode = 'auto',
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  const parent = useContext(ThemeContext);
  if (parent && mode === 'auto') {
    return <>{children}</>;
  }
  return (
    <IndependentThemeProvider mode={mode} storageKey={storageKey}>
      {children}
    </IndependentThemeProvider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

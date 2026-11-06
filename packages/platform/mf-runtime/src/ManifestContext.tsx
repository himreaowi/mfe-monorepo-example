import { createContext, useContext, type ReactNode } from 'react';
import type { MfeManifest } from './manifest/manifest';

const ManifestContext = createContext<MfeManifest | null>(null);
ManifestContext.displayName = 'MfeManifestContext';
const UnauthorizedContext = createContext<(() => void) | undefined>(undefined);
UnauthorizedContext.displayName = 'MfeUnauthorizedContext';

/** Makes the loaded manifest available to `<RemoteApp>` (per-remote props, settings, retry). */
export function MfeManifestProvider({
  manifest,
  onUnauthorized,
  children,
}: {
  manifest: MfeManifest;
  /** An API call of the shell (`useApiClient()`) answered 401: re-check the session. */
  onUnauthorized?: () => void;
  children: ReactNode;
}) {
  return (
    <ManifestContext.Provider value={manifest}>
      <UnauthorizedContext.Provider value={onUnauthorized}>
        {children}
      </UnauthorizedContext.Provider>
    </ManifestContext.Provider>
  );
}

/** The manifest from `MfeManifestProvider`, or `null`. */
export function useMfeManifest(): MfeManifest | null {
  return useContext(ManifestContext);
}

/** `onUnauthorized` of `MfeManifestProvider`. */
export function useUnauthorizedHandler(): (() => void) | undefined {
  return useContext(UnauthorizedContext);
}

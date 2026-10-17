import { createContext, useContext, type ReactNode } from 'react';
import type { MfeManifest } from './manifest/manifest';

const ManifestContext = createContext<MfeManifest | null>(null);
ManifestContext.displayName = 'MfeManifestContext';

/** Makes the loaded manifest available to `<RemoteApp>` (per-remote props, settings, retry). */
export function MfeManifestProvider({
  manifest,
  children,
}: {
  manifest: MfeManifest;
  children: ReactNode;
}) {
  return (
    <ManifestContext.Provider value={manifest}>
      {children}
    </ManifestContext.Provider>
  );
}

/** The manifest from `MfeManifestProvider`, or `null`. */
export function useMfeManifest(): MfeManifest | null {
  return useContext(ManifestContext);
}

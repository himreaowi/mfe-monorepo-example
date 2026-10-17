import { registerRemotes } from '@module-federation/enhanced/runtime';
import { resolveRemoteEntry, type MfeManifest } from './manifest/manifest';

export type RegisteredRemote = { name: string; entry: string };

/**
 * Register every remote in the manifest with the Module Federation runtime of this build
 * (`registerRemotes`, NOT `createInstance`: a separate instance would not share the shell's
 * singletons and React could load twice).
 *
 * Call once in the shell bootstrap, after the async import boundary. Remotes are downloaded only
 * when first rendered (`<RemoteApp>` → `loadRemote`).
 */
export function initRemotes(
  manifest: MfeManifest,
  options: { force?: boolean } = {},
): RegisteredRemote[] {
  const remotes = Object.entries(manifest.remotes).map(([name, remote]) => ({
    name,
    entry: resolveRemoteEntry(remote.entry),
  }));
  registerRemotes(remotes, { force: options.force });
  return remotes;
}

/** Re-register one remote so the next loadRemote fetches its entry again (used by retry). */
export function resetRemote(remote: RegisteredRemote): void {
  registerRemotes([remote], { force: true });
}

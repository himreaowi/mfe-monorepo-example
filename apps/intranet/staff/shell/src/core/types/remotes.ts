/** One entry of remotes.json (the shell's registry, managed by `pnpm gen:remote`). */
export type RemoteEntry = {
  /** Folder name in apps/intranet/ (kebab-case). */
  name: string;
  /** Nav label. */
  title: string;
  /** One sentence for the home page card (optional). */
  description?: string;
  /** Mount path in the shell (`/staff-directory`); the remote owns `<path>/*`. */
  path: string;
  /** Module Federation name = key in mfe-manifest.json `remotes`. */
  federationName: string;
  /** Workspace package name (for tooling only; the shell never imports it). */
  package: string;
  /** `private` remotes are wrapped in `<RequireAuth>` (not downloaded before sign-in). */
  access: 'public' | 'private';
  /** `external` = adapter remote that mounts a vendor module (docs/external-modules.md). */
  kind: 'react' | 'external';
};

import registry from '../../remotes.json';
import type { RemoteEntry } from '@/core/types/remotes';

/** Remotes of this shell, from remotes.json (managed by `pnpm gen:remote`). */
export const remotes: RemoteEntry[] = registry.remotes as RemoteEntry[];

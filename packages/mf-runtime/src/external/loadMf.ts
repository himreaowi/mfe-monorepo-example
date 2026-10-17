import {
  loadRemote,
  registerRemotes,
} from '@module-federation/enhanced/runtime';
import type { ExternalModuleConfig } from './config';

/**
 * Format `mf`: register the vendor's Module Federation remote at runtime and load its exposed
 * mount module (default `./mount`). The vendor remote must not declare `shared` modules: it
 * brings its own framework (e.g. another React major) and nothing is negotiated with the host.
 */
export async function loadMfExternalModule(
  config: ExternalModuleConfig,
): Promise<unknown> {
  if (!config.remoteName) {
    throw new Error('format "mf" needs "remoteName".');
  }
  // force: a retry (new URL) replaces a failed registration
  registerRemotes([{ name: config.remoteName, entry: config.url }], {
    force: true,
  });
  const expose = (config.expose ?? './mount').replace(/^\.\//, '');
  return loadRemote(`${config.remoteName}/${expose}`);
}

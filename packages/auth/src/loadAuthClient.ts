import { createAuthClient, type CreateAuthClientOptions } from './client';
import type { AuthClient, ManifestAuthConfig } from './types';

/**
 * Pick the auth client for the shell from mfe-manifest.json `auth`:
 *
 * | `auth`                                   | development build     | production build                  |
 * | ---------------------------------------- | --------------------- | --------------------------------- |
 * | missing                                  | `null` (disabled)     | `null` (disabled)                 |
 * | `{ "mock": true }`                       | mock client           | `null` + console error (disabled) |
 * | `{ sessionUrl, loginUrl, logoutUrl, … }` | BFF client            | BFF client                        |
 *
 * The mock module is imported dynamically inside a `process.env.NODE_ENV !== 'production'`
 * branch. Rspack replaces `process.env.NODE_ENV` and removes the branch (and the chunk) from
 * production builds. Disabled auth fails closed: `<RequireAuth>` never shows its children.
 */
export async function loadAuthClient(
  config: ManifestAuthConfig | undefined,
  options: CreateAuthClientOptions = {},
): Promise<AuthClient | null> {
  if (!config) return null;
  if (config.mock) {
    if (process.env.NODE_ENV !== 'production') {
      const { createMockAuthClient } = await import('./mock');
      return createMockAuthClient();
    }
    console.error(
      '[auth] mfe-manifest.json has "auth": { "mock": true }, which production builds ignore. Sign-in is disabled; configure the BFF URLs (docs/auth-contract.md).',
    );
    return null;
  }
  const { sessionUrl, loginUrl, logoutUrl } = config;
  if (!sessionUrl || !loginUrl || !logoutUrl) {
    console.error(
      '[auth] mfe-manifest.json "auth" needs sessionUrl, loginUrl and logoutUrl. Sign-in is disabled.',
    );
    return null;
  }
  return createAuthClient(
    { ...config, sessionUrl, loginUrl, logoutUrl },
    options,
  );
}

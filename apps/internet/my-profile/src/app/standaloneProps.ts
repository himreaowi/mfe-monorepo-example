import type { HostProps } from '@org/mf-runtime/remote';

/**
 * Mock host props for standalone mode (what the shell would pass after sign-in). The API base
 * URL is the dev mock API (tools/mock-api); production builds drop it, embedded mode always
 * uses the shell's manifest settings.
 */
export const standaloneProps: Partial<HostProps> = {
  title: 'My profile',
  user: { id: 'mock-user-1', name: 'Dev User (mock)' },
  settings:
    process.env.NODE_ENV !== 'production'
      ? { apiBaseUrl: 'http://localhost:3920/api' }
      : {},
};

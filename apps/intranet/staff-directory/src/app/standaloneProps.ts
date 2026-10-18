import type { HostProps } from '@org/mf-runtime/remote';

/**
 * Mock host props for standalone mode (what the shell would pass). The API base URL is the
 * dev mock API (tools/mock-api); production builds drop it, embedded mode always uses the
 * shell's manifest settings.
 */
export const standaloneProps: Partial<HostProps> = {
  title: 'Staff directory',
  user: { id: 'dev-user', name: 'Dev User' },
  settings:
    process.env.NODE_ENV !== 'production'
      ? { apiBaseUrl: 'http://localhost:3190/api' }
      : {},
};

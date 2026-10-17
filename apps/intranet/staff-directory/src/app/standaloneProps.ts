import type { HostProps } from '@org/mf-runtime/remote';

/** Mock host props for standalone mode (what the shell would pass). */
export const standaloneProps: Partial<HostProps> = {
  title: 'Staff Directory',
  user: { id: 'dev-user', name: 'Dev User' },
  settings: {},
};

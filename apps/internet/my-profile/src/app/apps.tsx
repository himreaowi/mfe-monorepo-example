// The exposed module ('./App', rspack.config.js default): the shell renders its default export
// with HostProps; src/main.tsx renders StandaloneApp when this remote runs on its own. Nothing
// reachable from here may import global styles or register a service worker: the shell owns
// the page (apps.test.tsx checks it).
import { createRemoteApp, type HostProps } from '@org/mf-runtime/remote';
import { StandaloneLayout } from '@/layouts/StandaloneLayout/StandaloneLayout';
import { routes } from './routes';

/**
 * Mock host props for standalone mode (what the shell would pass after sign-in). The API base
 * URL is the dev mock API (tools/mock-api); production builds drop it, embedded mode always
 * uses the shell's manifest settings.
 */
const standaloneProps: Partial<HostProps> = {
  title: 'My profile',
  user: { id: 'mock-user-1', name: 'Dev User (mock)' },
  settings:
    process.env.NODE_ENV !== 'production'
      ? { apiBaseUrl: 'http://localhost:3290/api' }
      : {},
};

const { EmbeddedApp, StandaloneApp } = createRemoteApp({
  routes,
  standaloneProps,
  StandaloneLayout,
});

/** Rendered by the shell (`<RemoteApp>`), below the remote's mount path. */
export default EmbeddedApp;
/** Rendered by src/main.tsx in standalone mode (`pnpm dev` in this folder). */
export { StandaloneApp };

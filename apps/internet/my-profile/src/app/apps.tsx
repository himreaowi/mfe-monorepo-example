import { createRemoteApp } from '@org/mf-runtime/remote';
import { StandaloneLayout } from '@/layouts/StandaloneLayout';
import { routes } from './routes';
import { standaloneProps } from './standaloneProps';

/** EmbeddedApp: rendered by the shell. StandaloneApp: rendered by src/bootstrap.tsx. */
export const { EmbeddedApp, StandaloneApp } = createRemoteApp({
  routes,
  standaloneProps,
  StandaloneLayout,
});

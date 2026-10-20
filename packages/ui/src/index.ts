// Makes the *.module.scss declarations visible to apps that type-check this package's source.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./styles.d.ts" />
//
// Building blocks only: each shell owns its layout (src/layouts/ShellLayout, copied from a
// starter by `pnpm gen:shell`) and composes it from these. See README.md.
// This file is the package's public API; component folders have no index.ts of their own.
export { Brand } from './components/Brand/Brand';
export type { BrandProps } from './components/Brand/types';
export { Button } from './components/Button/Button';
export type { ButtonProps } from './components/Button/types';
export { SkipLink } from './components/SkipLink/SkipLink';
export type { SkipLinkProps } from './components/SkipLink/types';
export { ThemeToggle } from './components/ThemeToggle/ThemeToggle';
export type { ThemeToggleProps } from './components/ThemeToggle/types';
export { RemoteFallback } from './components/RemoteFallback/RemoteFallback';
export type { RemoteFallbackProps } from './components/RemoteFallback/types';
export {
  ConnectionRequired,
  type ConnectionRequiredProps,
} from './components/ConnectionRequired/ConnectionRequired';
export {
  FIT_HYSTERESIS_PX,
  decideFitLayout,
  measureFit,
  useFitLayout,
  type FitLayout,
  type FitLayoutOptions,
} from './hooks/useFitLayout/useFitLayout';
export {
  useMenuDisclosure,
  type MenuButtonProps,
  type MenuDisclosure,
  type MenuPanelProps,
} from './hooks/useMenuDisclosure/useMenuDisclosure';
export {
  ThemeProvider,
  useTheme,
  type ThemeContextValue,
  type ThemeProviderProps,
  type ThemeRole,
} from './providers/ThemeProvider/ThemeProvider';
export type { ThemeMode, ThemePreference } from '@org/design-tokens';

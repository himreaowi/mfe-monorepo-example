// Makes the *.module.scss declarations visible to apps that type-check this package's source.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./styles.d.ts" />
//
// Building blocks only: each shell owns its layout (src/layouts/ShellLayout, copied from a
// starter by `pnpm gen:shell`) and composes it from these. See README.md.
export { Brand, type BrandProps } from './components/Brand';
export { Button, type ButtonProps } from './components/Button';
export { SkipLink, type SkipLinkProps } from './components/SkipLink';
export { ThemeToggle, type ThemeToggleProps } from './components/ThemeToggle';
export {
  RemoteFallback,
  type RemoteFallbackProps,
} from './components/RemoteFallback';
export {
  ConnectionRequired,
  type ConnectionRequiredProps,
} from './components/ConnectionRequired';
export {
  FIT_HYSTERESIS_PX,
  decideFitLayout,
  measureFit,
  useFitLayout,
  type FitLayout,
  type FitLayoutOptions,
} from './hooks/useFitLayout';
export {
  useMenuDisclosure,
  type MenuButtonProps,
  type MenuDisclosure,
  type MenuPanelProps,
} from './hooks/useMenuDisclosure';
export {
  ThemeProvider,
  useTheme,
  type ThemeContextValue,
  type ThemeProviderProps,
  type ThemeRole,
} from './providers/ThemeProvider';
export type { ThemeMode, ThemePreference } from '@org/design-tokens';

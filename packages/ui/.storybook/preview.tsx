import { useLayoutEffect, type ReactNode } from 'react';
import type { Decorator, Preview } from '@storybook/react-webpack5';
import { THEME_ATTRIBUTE, isThemeMode } from '@org/design-tokens';
// The app shell's global styles: tokens (light/dark) + reset, as on every page.
import '@org/design-tokens/global.scss';
import './preview.scss';

/** Sets `data-theme` on <html>, like the shell's ThemeProvider (tokens.css switches on it). */
function Themed({ theme, children }: { theme: unknown; children: ReactNode }) {
  const mode = isThemeMode(theme) ? theme : 'light';
  useLayoutEffect(() => {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, mode);
  }, [mode]);
  return children;
}

const withTheme: Decorator = (Story, context) => (
  <Themed theme={context.globals.theme}>
    <Story />
  </Themed>
);

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Design-token theme (data-theme on <html>)',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
  },
};

export default preview;

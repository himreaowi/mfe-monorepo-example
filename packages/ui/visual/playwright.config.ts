// Accessibility (axe, WCAG 2.2 AA) and screenshot tests of every @org/ui story, light and dark,
// against the static Storybook build. `pnpm test:ui` (builds Storybook first, Nx cached);
// `pnpm test:ui:update` writes new baselines. See packages/ui/README.md.
import { defineConfig, devices } from '@playwright/test';
import { toolPort } from '../.storybook/tool-port.js';

const port = toolPort('storybookTest');

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: '../test-results/visual',
  reporter: [['list']],
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: Boolean(process.env.CI),
  // Baselines per platform: fonts render differently on macOS, Linux and Windows.
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{arg}{ext}',
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 800, height: 600 },
    baseURL: `http://127.0.0.1:${port}`,
    reducedMotion: 'reduce',
  },
  webServer: {
    command: `node serve.js ${port}`,
    cwd: import.meta.dirname,
    url: `http://127.0.0.1:${port}/index.json`,
    reuseExistingServer: false,
  },
});

import { expect, test } from '@org/playwright-config/test';
import { DEEP_LINK, openStandalone, zone } from './helpers';

// Every remote also runs on its own dev server with mock host props (`pnpm dev` in its folder).
for (const remote of zone.remotes) {
  test(`${remote.title} runs standalone (${remote.standaloneUrl})`, async ({
    page,
  }) => {
    await openStandalone(page, remote);
    // standalone = own chrome (the remote's StandaloneLayout: header with a theme toggle) and
    // own document theme
    await expect(
      page.getByRole('banner').getByRole('button', { name: 'Use dark theme' }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      /^(light|dark)$/,
    );
    await openStandalone(page, remote, DEEP_LINK);
  });
}

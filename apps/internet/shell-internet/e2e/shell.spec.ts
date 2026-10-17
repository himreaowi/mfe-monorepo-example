import { expect, test } from '@org/playwright-config/test';
import { escapeRegExp, expectRemoteRendered, openNav, zone } from './helpers';

test.describe('Citizen Portal shell', () => {
  test('home page lists every remote in the nav', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('shell-welcome')).toBeVisible();
    const nav = await openNav(page);
    await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
    for (const remote of zone.remotes) {
      await expect(
        nav.getByRole('link', { name: remote.title, exact: true }),
      ).toHaveAttribute('href', remote.path);
    }
    if (zone.remotes.length === 0) {
      await expect(page.getByTestId('no-remotes')).toBeVisible();
    }
  });

  test('the nav opens every remote without a page reload', async ({ page }) => {
    await page.goto('/');
    // a full page load would drop this marker
    await page.evaluate(() => {
      (window as unknown as { __e2eSpa: boolean }).__e2eSpa = true;
    });
    for (const remote of zone.remotes) {
      // the Menu (375 px) closes after each navigation
      const nav = await openNav(page);
      await nav.getByRole('link', { name: remote.title, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${escapeRegExp(remote.path)}$`));
      if (remote.access === 'private') {
        await expect(page.getByTestId('sign-in-prompt')).toBeVisible();
      } else {
        await expectRemoteRendered(page, remote);
      }
    }
    await (await openNav(page)).getByRole('link', { name: 'Home' }).click();
    await expect(page.getByTestId('shell-welcome')).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { __e2eSpa?: boolean }).__e2eSpa,
      ),
    ).toBe(true);
  });

  test('unknown paths show the 404 page', async ({ page }) => {
    await page.goto('/e2e-no-such-page');
    await expect(page.getByTestId('not-found-page')).toBeVisible();
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page.getByTestId('shell-welcome')).toBeVisible();
  });

  test('theme choice persists across reloads and applies to remotes', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: 'Use dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const publicRemote = zone.remotes.find((r) => r.access === 'public');
    if (publicRemote) {
      await page.goto(publicRemote.path);
      await expectRemoteRendered(page, publicRemote);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    }
    await page.getByRole('button', { name: 'Use system theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('offline: shows the connection banner', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByTestId('shell-welcome')).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByTestId('connection-required')).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByTestId('connection-required')).toHaveCount(0);
  });
});

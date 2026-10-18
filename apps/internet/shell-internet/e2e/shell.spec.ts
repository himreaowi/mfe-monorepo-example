import { expect, test } from '@org/playwright-config/test';
import {
  escapeRegExp,
  expectRemoteRendered,
  openHeaderMenu,
  openNav,
  zone,
} from './helpers';

/** Widths the header must stay one row at (phone, tablet, small and common laptop). */
const HEADER_WIDTHS = [375, 800, 1024, 1280];

test.describe('Citizen Portal', () => {
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
      // on phones the menu closes after each navigation: open it every time
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
    await (
      await openHeaderMenu(page)
    )
      .getByRole('button', { name: 'Use dark theme' })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const publicRemote = zone.remotes.find((r) => r.access === 'public');
    if (publicRemote) {
      await page.goto(publicRemote.path);
      await expectRemoteRendered(page, publicRemote);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    }
    await (
      await openHeaderMenu(page)
    )
      .getByRole('button', { name: 'Use system theme' })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('header: one compact row on phones with a Menu disclosure', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile',
      'phone disclosure; desktop widths: next test',
    );
    await page.goto('/');
    await expect(page.getByTestId('shell-welcome')).toBeVisible();
    const menu = page.getByRole('button', { name: 'Menu' });
    const nav = page.getByRole('list', { name: 'Apps' });
    const header = page.getByTestId('main-header');
    await expect(header).toHaveAttribute('data-layout', 'compact');
    const box = await header.boundingBox();
    expect(
      box?.height ?? 0,
      'collapsed header height at 375 px',
    ).toBeLessThanOrEqual(64);
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(nav).toBeHidden();
    // aria-controls points at the panel
    expect(await menu.getAttribute('aria-controls')).toBe(
      await page.getByTestId('header-panel').getAttribute('id'),
    );
    // open, Escape closes and returns focus
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(nav).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeFocused();
    // a click outside the header (below the open panel) closes it
    await menu.click();
    const viewport = page.viewportSize() ?? { width: 375, height: 812 };
    await page.mouse.click(8, viewport.height - 8);
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    // following a link closes
    const first = zone.remotes[0];
    if (first) {
      await (
        await openNav(page)
      )
        .getByRole('link', { name: first.title, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`${escapeRegExp(first.path)}$`));
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
    }
  });

  for (const signedIn of [false, true]) {
    test(`header: one row at every width (${signedIn ? 'signed in' : 'signed out'})`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop',
        'sets its own viewport sizes',
      );
      test.skip(
        signedIn && !zone.authMock,
        'signs in with the dev mock: needs "auth": { "mock": true }',
      );
      await page.goto('/');
      await expect(page.getByTestId('shell-welcome')).toBeVisible();
      if (signedIn) {
        await (
          await openHeaderMenu(page)
        )
          .getByRole('button', { name: 'Sign in' })
          .click();
        await expect(page.getByTestId('user-name')).toBeAttached();
        // the panel may still be open (compact header): close it
        const menu = page.getByRole('button', { name: 'Menu' });
        if (
          (await menu.isVisible()) &&
          (await menu.getAttribute('aria-expanded')) === 'true'
        ) {
          await page.keyboard.press('Escape');
          await expect(menu).toHaveAttribute('aria-expanded', 'false');
        }
      }
      const header = page.getByTestId('main-header');
      const menu = page.getByRole('button', { name: 'Menu' });
      const nav = page.getByRole('list', { name: 'Apps' });
      for (const width of HEADER_WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        // MainLayout measures the row: wide when brand, nav and actions fit, else compact
        await expect(header).toHaveAttribute('data-layout', /^(wide|compact)$/);
        const maxHeight = width < 640 ? 64 : 80;
        await expect
          .poll(
            async () => Math.round((await header.boundingBox())?.height ?? 0),
            {
              message: `header height at ${width} px (one row ≤ ${maxHeight} px)`,
            },
          )
          .toBeLessThanOrEqual(maxHeight);
        if ((await header.getAttribute('data-layout')) === 'wide') {
          await expect(menu).toBeHidden();
          await expect(nav).toBeVisible();
        } else {
          await expect(menu).toBeVisible();
          await expect(nav).toBeHidden();
        }
        // no horizontal page scrolling at any width
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          `no horizontal scroll at ${width} px`,
        ).toBe(true);
      }
    });
  }

  test('offline: shows the connection banner', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByTestId('shell-welcome')).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByTestId('connection-required')).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByTestId('connection-required')).toHaveCount(0);
  });
});

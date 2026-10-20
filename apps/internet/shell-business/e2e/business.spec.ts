import { expect, test } from '@org/playwright-config/test';
import {
  expectRemoteRendered,
  openHeaderMenu,
  remotePage,
  signInWithMock,
  zone,
} from './helpers';

// The business shell of the internet zone: /business on the same origin as /citizen (zone dev
// proxy), side layout, Corppass-style mock sign-in (mfe.devManifest.auth.mockUser), its own
// remote (business-licences) and the shared announcements remote.
const announcements = zone.remotes.find((r) => r.name === 'announcements')!;
const licences = zone.remotes.find((r) => r.name === 'business-licences')!;
const BUSINESS_USER = 'Lim Wei Ling (Acme Trading Pte Ltd)';

test.describe('Business Portal under /business', () => {
  test('brand and side layout at /business', async ({ page }) => {
    await page.goto(zone.home);
    expect(zone.home).toBe('/business/');
    await expect(page.getByTestId('header-brand')).toHaveText(
      'Business Portal',
    );
    await expect(page.getByTestId('main-header')).toHaveAttribute(
      'data-nav-placement',
      'side',
    );
  });

  test('announcements (shared with /citizen) loads here too, deep link + reload', async ({
    page,
  }) => {
    const url = `${announcements.path}/a-2026-031`;
    expect(url).toBe('/business/announcements/a-2026-031');
    await page.goto(url);
    await expectRemoteRendered(page, announcements);
    await page.reload();
    await expect(page).toHaveURL(`${zone.origin}${url}`);
    await expect(
      remotePage(page, announcements).getByRole('heading', {
        level: 1,
        name: 'Online services maintenance on 25 October',
      }),
    ).toBeVisible();
    // the brand stays the business shell's
    await expect(page.getByTestId('header-brand')).toHaveText(
      'Business Portal',
    );
  });

  test('Corppass mock sign-in shows the business user; /citizen keeps its own session', async ({
    page,
  }) => {
    await page.goto(licences.path);
    await signInWithMock(page);
    await expectRemoteRendered(page, licences);
    const panel = await openHeaderMenu(page);
    await expect(panel.getByTestId('user-name')).toHaveText(BUSINESS_USER);

    // same origin, other shell: its mock user has its own session (like a cookie with
    // Path=/business), so the citizen shell is still signed out
    await page.goto('/citizen/');
    const citizenPanel = await openHeaderMenu(page);
    await expect(
      citizenPanel.getByRole('button', { name: 'Sign in' }),
    ).toBeVisible();
    await expect(page.getByTestId('user-name')).toHaveCount(0);
  });
});

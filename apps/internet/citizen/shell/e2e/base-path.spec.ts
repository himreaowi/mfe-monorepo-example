import { expect, test } from '@org/playwright-config/test';
import { expectRemoteRendered, remotePage, zone } from './helpers';

// The internet zone has two shells on one origin (the zone's dev proxy, like the production
// reverse proxy): this one at /citizen (Singpass, top layout), the business shell at /business.
const announcements = zone.remotes.find((r) => r.name === 'announcements')!;

test.describe('Citizen Portal under /citizen', () => {
  test('the zone root redirects to the default shell (/citizen/)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(`${zone.origin}/citizen/`);
    await expect(page.getByTestId('header-brand')).toHaveText('Citizen Portal');
  });

  test('brand and top layout at /citizen', async ({ page }) => {
    await page.goto(zone.home);
    await expect(page.getByTestId('header-brand')).toHaveText('Citizen Portal');
    await expect(page.getByTestId('main-header')).toHaveAttribute(
      'data-nav-placement',
      'top',
    );
  });

  test('a deep link below the base path survives a reload', async ({
    page,
  }) => {
    const url = `${announcements.path}/a-2026-031`;
    expect(url).toBe('/citizen/announcements/a-2026-031');
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
  });
});

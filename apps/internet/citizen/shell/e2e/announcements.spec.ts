import { expect, test } from '@org/playwright-config/test';
import { openRemote, remotePage, zone } from './helpers';

const remote = zone.remotes.find((r) => r.name === 'announcements')!;

test.describe('Announcements', () => {
  test('list newest first, open the detail, go back', async ({ page }) => {
    await openRemote(page, remote);
    const container = remotePage(page, remote);
    const first = container.getByTestId('announcement').first();
    await expect(first).toContainText(
      'Online services maintenance on 25 October',
    );
    await expect(container.getByTestId('announcement')).toHaveCount(5);

    await first
      .getByRole('link', { name: 'Online services maintenance on 25 October' })
      .click();
    await expect(page).toHaveURL(/\/announcements\/a-2026-031$/);
    await expect(
      container.getByRole('heading', {
        level: 1,
        name: 'Online services maintenance on 25 October',
      }),
    ).toBeVisible();
    await expect(
      container.getByText(/Published 16 October 2026/),
    ).toBeVisible();
    await expect(
      container.getByText(/upgrading our systems on Sunday 25 October/),
    ).toBeVisible();

    await container
      .getByRole('link', { name: 'Back to all announcements' })
      .click();
    await expect(page).toHaveURL(/\/announcements$/);
    await expect(container.getByTestId('announcement')).toHaveCount(5);
  });
});

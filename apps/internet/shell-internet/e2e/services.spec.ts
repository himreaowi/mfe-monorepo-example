import { expect, test } from '@org/playwright-config/test';
import { openRemote, remotePage, settle, zone } from './helpers';

const remote = zone.remotes.find((r) => r.name === 'services')!;

test.describe('Services catalogue', () => {
  test('search, open a service, filter by topic', async ({ page }) => {
    await openRemote(page, remote);
    const container = remotePage(page, remote);
    await expect(container.getByTestId('service-count')).toHaveText(
      '10 services',
    );

    await container
      .getByRole('searchbox', { name: 'Search services' })
      .fill('dog');
    await expect(container.getByTestId('service-count')).toHaveText(
      '1 service',
    );
    await container.getByRole('link', { name: 'Renew a dog licence' }).click();
    await expect(page).toHaveURL(/\/services\/renew-dog-licence$/);
    await expect(
      container.getByRole('heading', { level: 1, name: 'Renew a dog licence' }),
    ).toBeVisible();
    await expect(container.getByText('SGD 15.00')).toBeVisible();
    await expect(
      container.getByRole('region', { name: 'Steps' }).getByRole('listitem'),
    ).toHaveCount(4);

    await container.getByRole('link', { name: 'Back to all services' }).click();
    await settle(page);
    await container
      .getByRole('combobox', { name: 'Topic' })
      .selectOption('Transport');
    await expect(container.getByTestId('service-count')).toHaveText(
      '3 services',
    );
  });
});

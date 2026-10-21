import { expect, test } from '@org/playwright-config/test';
import { openRemote, remotePage, settle, zone } from './helpers';

const remote = zone.remotes.find((r) => r.name === 'leave-requests')!;

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A Monday at least two weeks ahead and the Friday before it (local time like the browser). */
function futureWeek(): { monday: string; fridayBefore: string } {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  while (date.getDay() !== 1) date.setDate(date.getDate() + 1);
  const friday = new Date(date);
  friday.setDate(friday.getDate() - 3);
  return { monday: isoDate(date), fridayBefore: isoDate(friday) };
}

test.describe('Leave requests', () => {
  test('balance and requests are shown', async ({ page }) => {
    await openRemote(page, remote);
    const container = remotePage(page, remote);
    await expect(container.getByTestId('leave-balance')).toHaveCount(4);
    await expect(
      container
        .getByTestId('leave-balance')
        .filter({ hasText: 'Annual leave' }),
    ).toContainText('days left');
    await expect(container.getByTestId('leave-request').first()).toBeVisible();
  });

  test('submit with validation errors, then a valid request', async ({
    page,
  }) => {
    await openRemote(page, remote);
    const container = remotePage(page, remote);
    await container.getByRole('link', { name: 'Request leave' }).click();
    await expect(page).toHaveURL(/\/leave-requests\/new$/);
    await settle(page);

    // 1. nothing filled in: error summary, focused, linked to the fields
    await container.getByRole('button', { name: 'Send request' }).click();
    const summary = container.getByTestId('error-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary).toContainText('Choose a leave type');
    await expect(summary).toContainText('Enter a start date');
    await summary.getByRole('link', { name: 'Choose a leave type' }).click();
    const type = container.getByRole('combobox', { name: 'Leave type' });
    await expect(type).toBeFocused();
    await expect(type).toHaveAttribute('aria-invalid', 'true');

    // 2. last day before the first day
    const { monday, fridayBefore } = futureWeek();
    await type.selectOption({ label: 'No-pay leave' });
    await container.getByLabel('First day').fill(monday);
    await container.getByLabel('Last day').fill(fridayBefore);
    await container.getByRole('button', { name: 'Send request' }).click();
    await expect(summary).toContainText(
      'The end date must be on or after the start date',
    );

    // 3. valid: one working day
    await container.getByLabel('Last day').fill(monday);
    await expect(container.getByTestId('leave-days')).toHaveText(
      '1 day of leave (working days, Monday to Friday).',
    );
    const reason = `e2e ${test.info().project.name} ${Date.now()}`;
    await container.getByLabel('Reason (optional)').fill(reason);
    await container.getByRole('button', { name: 'Send request' }).click();

    await expect(page).toHaveURL(/\/leave-requests$/);
    const confirmation = container.getByTestId('leave-created');
    await expect(confirmation).toContainText(/Request LR-\d{4} sent: 1 day/);
    await expect(confirmation).toBeFocused();
    await expect(
      container.getByTestId('leave-request').filter({ hasText: reason }),
    ).toContainText('Waiting for approval');
  });
});

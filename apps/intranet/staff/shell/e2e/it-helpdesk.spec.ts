import { expect, test } from '@org/playwright-config/test';
import {
  escapeRegExp,
  openHeaderMenu,
  openRemote,
  remotePage,
  zone,
} from './helpers';

const remote = zone.remotes.find((r) => r.name === 'it-helpdesk')!;

test.describe('IT helpdesk (vendor module, no React)', () => {
  test('lists tickets; report a problem with validation; the host sees the event', async ({
    page,
  }) => {
    await openRemote(page, remote);
    const container = remotePage(page, remote);
    // the vendor renders in an open shadow root: normal locators reach it
    const widget = container.getByTestId('helpdesk-widget');
    await expect(widget.getByTestId('helpdesk-ticket').first()).toBeVisible();

    await widget.getByRole('button', { name: 'Report a problem' }).click();
    await expect(page).toHaveURL(
      new RegExp(`${escapeRegExp(remote.path)}/new$`),
    );
    await expect(
      widget.getByRole('heading', { name: 'Report a problem' }),
    ).toBeFocused();

    await widget.getByRole('button', { name: 'Send ticket' }).click();
    await expect(widget.getByRole('alert').first()).toContainText(
      'There is a problem',
    );
    await expect(
      widget.getByRole('link', { name: 'Choose a category' }),
    ).toBeFocused();
    await expect(widget.getByLabel('Category')).toHaveAttribute(
      'aria-invalid',
      'true',
    );

    const summary = `Docking station ${test.info().project.name} ${Date.now()}`;
    await widget.getByLabel('Category').selectOption('hardware');
    await widget.getByLabel('Summary').fill(summary);
    await widget.getByLabel('Details (optional)').fill('No display output.');
    await widget.getByRole('button', { name: 'Send ticket' }).click();

    await expect(page).toHaveURL(
      new RegExp(`${escapeRegExp(remote.path)}/tickets/HD-\\d+$`),
    );
    await expect(widget.getByTestId('helpdesk-ticket-detail')).toContainText(
      summary,
    );
    await expect(widget.getByTestId('helpdesk-notice')).toContainText(
      /Ticket HD-\d+ created/,
    );
    await expect(container.getByTestId('vendor-events')).toContainText(
      `created: ${summary}`,
    );

    await widget.getByRole('link', { name: 'Back to your tickets' }).click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(remote.path)}$`));
    await expect(
      widget.getByTestId('helpdesk-ticket').filter({ hasText: summary }),
    ).toContainText('Open');
  });

  test('the shell theme reaches the vendor module (update())', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openRemote(page, remote);
    const vendor = remotePage(page, remote).locator(
      '[data-vendor="acme-service-desk"]',
    );
    await expect(vendor).toHaveAttribute('data-theme', 'light');
    // the theme toggle sits in the header panel (behind "Menu" at 375 px)
    const header = await openHeaderMenu(page);
    await header.getByRole('button', { name: 'Use dark theme' }).click();
    await expect(vendor).toHaveAttribute('data-theme', 'dark');
    await expect(vendor.getByTestId('helpdesk-ticket').first()).toBeVisible();
  });
});

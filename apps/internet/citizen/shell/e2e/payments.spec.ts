import { expect, test } from '@org/playwright-config/test';
import {
  escapeRegExp,
  openHeaderMenu,
  openRemote,
  remotePage,
  zone,
} from './helpers';

const remote = zone.remotes.find((r) => r.name === 'payments')!;

test.describe('Payments (vendor web component, no React)', () => {
  test('pay: validation, then the payment event reaches the host', async ({
    page,
  }) => {
    await openRemote(page, remote);
    const container = remotePage(page, remote);
    // <bright-checkout> renders in an open shadow root: normal locators reach it
    const checkout = container.getByTestId('bright-checkout');
    await expect(checkout.getByTestId('bright-amount')).toHaveText('SGD 15.00');
    await expect(checkout).toContainText('Paying as a guest');

    await checkout.getByRole('button', { name: 'Pay SGD 15.00' }).click();
    await expect(checkout.getByRole('alert')).toHaveText(
      'Choose how you want to pay',
    );
    await expect(checkout.getByRole('radio', { name: /PayNow/ })).toBeFocused();

    await checkout.getByRole('radio', { name: /PayNow/ }).check();
    await checkout.getByRole('button', { name: 'Pay SGD 15.00' }).click();

    // host side: the adapter validated the vendor's payment:completed event
    const confirmation = container.getByTestId('payment-confirmation');
    await expect(confirmation).toContainText(
      'Payment received: SGD 15.00 for Dog licence renewal 2027.',
    );
    const reference = /Reference (BP-\d{8}-\d{4})/.exec(
      (await confirmation.textContent()) ?? '',
    )?.[1];
    expect(reference).toBeTruthy();

    // vendor side: its router moved to the receipt through the shell URL
    await expect(page).toHaveURL(
      new RegExp(`${escapeRegExp(remote.path)}/receipt/${reference}$`),
    );
    const receipt = container.getByTestId('bright-receipt');
    await expect(receipt.getByTestId('bright-reference')).toHaveText(
      reference!,
    );
    await receipt.getByRole('button', { name: 'Make another payment' }).click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(remote.path)}$`));
  });

  test('the shell theme and the signed-in user reach the vendor', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openRemote(page, remote);
    const element = remotePage(page, remote).locator('bright-checkout');
    await expect(element).toHaveAttribute('data-theme', 'light');
    // theme toggle and user menu sit in the header panel (behind "Menu" at 375 px); the
    // panel stays open after a button press (only links close it)
    const header = await openHeaderMenu(page);
    await header.getByRole('button', { name: 'Use dark theme' }).click();
    await expect(element).toHaveAttribute('data-theme', 'dark');
    await header.getByRole('button', { name: 'Sign in' }).click();
    await expect(element.getByTestId('bright-checkout')).toContainText(
      'Paying as Dev User (mock)',
    );
  });
});

import { expect, test } from '@org/playwright-config/test';
import {
  DEEP_LINK,
  escapeRegExp,
  expectRemoteRendered,
  openRemote,
  remotePage,
  signInWithMock,
  zone,
} from './helpers';

// One block per remote in remotes.json.
for (const remote of zone.remotes) {
  test.describe(`${remote.title} in the shell (${remote.access}, ${remote.kind})`, () => {
    test('renders from a deep link and after a reload', async ({ page }) => {
      await openRemote(page, remote, DEEP_LINK);
      await expect(page).toHaveURL(
        new RegExp(`${escapeRegExp(`${remote.path}/${DEEP_LINK}`)}$`),
      );
      await expect(page.getByTestId('not-found-page')).toHaveCount(0);
      await page.reload();
      await expectRemoteRendered(page, remote);
    });

    if (remote.kind === 'react') {
      test('links inside the remote navigate client-side', async ({ page }) => {
        await openRemote(page, remote);
        const links = remotePage(page, remote).locator(
          `a[href^="${remote.path}/"]`,
        );
        test.skip(
          (await links.count()) === 0,
          'the remote has no internal links',
        );
        const href = (await links.first().getAttribute('href')) ?? '';
        await page.evaluate(() => {
          (window as unknown as { __e2eSpa: boolean }).__e2eSpa = true;
        });
        await links.first().click();
        await expect(page).toHaveURL(new RegExp(`${escapeRegExp(href)}$`));
        await expectRemoteRendered(page, remote);
        expect(
          await page.evaluate(
            () => (window as unknown as { __e2eSpa?: boolean }).__e2eSpa,
          ),
        ).toBe(true);
      });
    }

    if (remote.access === 'private') {
      test('signed out: sign-in guard, nothing downloaded before sign-in', async ({
        page,
      }) => {
        test.skip(
          !zone.authMock,
          'needs "auth": { "mock": true } in mfe-manifest.dev.json',
        );
        const requests: string[] = [];
        page.on('request', (request) => {
          if (request.url().startsWith(remote.origin)) {
            requests.push(request.url());
          }
        });
        await page.goto(remote.path);
        await expect(page.getByTestId('sign-in-prompt')).toBeVisible();
        expect(requests, 'requests to the remote before sign-in').toEqual([]);

        await signInWithMock(page);
        await expectRemoteRendered(page, remote);
        expect(requests.some((url) => url.endsWith('/mf-manifest.json'))).toBe(
          true,
        );

        await page.getByRole('button', { name: 'Sign out' }).click();
        await expect(page.getByTestId('sign-in-prompt')).toBeVisible();
      });
    }

    if (remote.kind === 'external') {
      test('mounts the vendor module; vendor navigation and theme go through the shell', async ({
        page,
      }) => {
        await openRemote(page, remote);
        test.skip(
          !remote.mockVendor,
          'vendor-specific checks are written for the mock vendor',
        );
        const vendor = remotePage(page, remote).getByTestId('mock-vendor');
        await expect(vendor.getByTestId('mock-vendor-path')).toHaveText(
          '(root)',
        );
        await vendor.getByRole('button', { name: 'View receipt' }).click();
        await expect(page).toHaveURL(
          new RegExp(`${escapeRegExp(remote.path)}/receipt/`),
        );
        await expect(vendor.getByTestId('mock-vendor-receipt')).toBeVisible();
        await page.getByRole('button', { name: 'Use dark theme' }).click();
        await expect(vendor.getByTestId('mock-vendor-theme')).toHaveText(
          'dark',
        );
      });
    }
  });
}

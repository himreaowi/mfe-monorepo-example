import { expect, test } from '@org/playwright-config/test';
import {
  DEEP_LINK,
  escapeRegExp,
  expectRemoteRendered,
  expectVendorMounted,
  openHeaderMenu,
  openNav,
  openRemote,
  remotePage,
  settle,
  signInWithMock,
  signOut,
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
        // data-driven pages render their links after the API answered: count only then
        await settle(page);
        const links = remotePage(page, remote).locator(
          `a[href^="${remote.path}/"]`,
        );
        test.skip(
          (await links.count()) === 0,
          `${remote.title} renders no internal links (a[href^="${remote.path}/"]) after loading`,
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
          'needs "auth": { "mock": true } (the shell\'s package.json mfe.devManifest → mfe-manifest.dev.json)',
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

        await signOut(page);
        await expect(page.getByTestId('sign-in-prompt')).toBeVisible();
      });
    }

    if (remote.kind === 'external') {
      // Works with ANY vendor (mock or real, any format): it only relies on the mount contract.
      test('mounts the vendor module: vendor content, no fallback, no console errors; unmounts on leave', async ({
        page,
      }) => {
        await openRemote(page, remote);
        await settle(page);
        const container = remotePage(page, remote);
        await expectVendorMounted(container);
        // console errors / failed requests fail the test (fixture of @org/playwright-config)
        await (await openNav(page)).getByRole('link', { name: 'Home' }).click();
        await expect(page.getByTestId('shell-welcome')).toBeVisible();
        await expect(page.getByTestId('external-module-root')).toHaveCount(0);
      });

      // Vendor-specific checks, written against tools/mock-vendor's demo widget.
      test('mock vendor: vendor routing goes through the shell URL, theme reaches the vendor', async ({
        page,
      }) => {
        test.skip(
          !remote.mockVendor,
          `props.vendor of ${remote.federationName} is not the dev mock vendor (${String(
            (remote.vendor as { url?: unknown } | undefined)?.url ?? 'no url',
          )}); add checks for your vendor in a spec of its own`,
        );
        await openRemote(page, remote);
        const vendor = remotePage(page, remote).getByTestId('mock-vendor');
        await expect(vendor.getByTestId('mock-vendor-path')).toHaveText(
          '(root)',
        );
        await vendor.getByRole('button', { name: 'Open details' }).click();
        await expect(page).toHaveURL(
          new RegExp(`${escapeRegExp(remote.path)}/details/`),
        );
        await expect(vendor.getByTestId('mock-vendor-details')).toBeVisible();
        const header = await openHeaderMenu(page);
        await header.getByRole('button', { name: 'Use dark theme' }).click();
        await expect(vendor.getByTestId('mock-vendor-theme')).toHaveText(
          'dark',
        );
      });
    }
  });
}

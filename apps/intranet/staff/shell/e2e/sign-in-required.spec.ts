import type { Page } from '@playwright/test';
import { checkA11y, expect, test, useTheme } from '@org/playwright-config/test';
import {
  DEEP_LINK,
  SIGN_IN_MODE,
  SIGN_IN_REQUIRED,
  escapeRegExp,
  expectRemoteRendered,
  settle,
  signOut,
  zone,
} from './helpers';

/**
 * Sign-in for the whole portal (SIGN_IN_REQUIRED in src/core/constants/signIn.ts, set by
 * `pnpm gen:shell --sign-in-required`). Skipped for an open portal. Signs in with the dev mock
 * (`"auth": { "mock": true }`): it signs in without leaving the page, so "back to the address
 * first requested" is checked as "still on it, now with the portal".
 */
test.skip(!SIGN_IN_REQUIRED, 'the portal is open (SIGN_IN_REQUIRED is false)');
test.skip(
  !zone.authMock,
  'needs "auth": { "mock": true } (the shell\'s package.json mfe.devManifest → mfe-manifest.dev.json)',
);

const landing = SIGN_IN_MODE === 'landing';
/** First remote's deep link, or an unknown path (404 page) when the zone has no remote. */
const remote = zone.remotes.at(0);
const deepLink = remote
  ? `${remote.path}/${DEEP_LINK}`
  : `${zone.home}e2e-no-such-page`;

/** Signed out: brand-only header, no nav, no Menu, no theme toggle, no sign-in in the header. */
async function expectSignedOutView(page: Page): Promise<void> {
  const header = page.getByTestId('main-header');
  await expect(header).toHaveAttribute('data-layout', 'signed-out');
  await expect(page.getByTestId('header-brand')).toBeVisible();
  await expect(header.locator('button, a, input')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByTestId('landing-page')).toBeVisible();
}

/** Every request to a remote's origin (its mf-manifest.json, remoteEntry, chunks). */
function remoteRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (zone.remotes.some((r) => url.startsWith(r.origin))) requests.push(url);
  });
  return requests;
}

test.describe('sign-in required for the whole portal', () => {
  test('landing page: brand-only header, nothing of the portal', async ({
    page,
  }) => {
    test.skip(!landing, 'SIGN_IN_MODE is redirect');
    await page.goto(zone.home);
    await expectSignedOutView(page);
    await expect(page.getByTestId('shell-welcome')).toHaveCount(0);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`landing page: WCAG 2.2 AA, ${theme} theme`, async ({ page }) => {
      test.skip(!landing, 'SIGN_IN_MODE is redirect');
      await useTheme(page, theme);
      await page.goto(zone.home);
      await expectSignedOutView(page);
      await settle(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await checkA11y(page);
    });
  }

  test('deep link → sign in → lands on the deep link', async ({ page }) => {
    await page.goto(deepLink);
    if (landing) {
      await expectSignedOutView(page);
      await page.getByTestId('landing-sign-in').click();
    }
    await expect(page.getByTestId('user-name')).toBeAttached();
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(deepLink)}$`));
    if (remote) await expectRemoteRendered(page, remote);
    else await expect(page.getByTestId('not-found-page')).toBeVisible();
  });

  test('no remote requests before sign-in; sign-out shows the landing page', async ({
    page,
  }) => {
    test.skip(
      !landing,
      'redirect: the dev mock signs in before anything can be checked',
    );
    test.skip(!remote, 'the zone has no remote yet');
    if (!remote) return;
    const requests = remoteRequests(page);
    await page.goto(remote.path);
    await expectSignedOutView(page);
    await settle(page);
    expect(requests, 'requests to a remote before sign-in').toEqual([]);

    await page.getByTestId('landing-sign-in').click();
    await expectRemoteRendered(page, remote);
    expect(requests.length, 'the remote loads after sign-in').toBeGreaterThan(
      0,
    );

    await signOut(page);
    await expectSignedOutView(page);
    await expect(page.getByTestId(`remote-page-${remote.name}`)).toHaveCount(0);
  });
});
